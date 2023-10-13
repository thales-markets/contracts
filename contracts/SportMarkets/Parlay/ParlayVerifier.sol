// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// interfaces
import "./ParlayMarket.sol";
import "../../interfaces/IParlayMarketsAMM.sol";
import "../../interfaces/ISportsAMM.sol";
import "../../interfaces/IParlayMarketData.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/ISportPositionalMarketManager.sol";
import "../../interfaces/IStakingThales.sol";
import "../../interfaces/IReferrals.sol";
import "../../interfaces/ICurveSUSD.sol";
import "../../interfaces/ITherundownConsumer.sol";
import "../../interfaces/IParlayPolicy.sol";

// import "hardhat/console.sol";

contract ParlayVerifier {
    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;

    uint private constant TAG_F1 = 9445;
    uint private constant TAG_MOTOGP = 9497;
    uint private constant TAG_GOLF = 100121;
    uint private constant TAG_NUMBER_SPREAD = 10001;
    uint private constant TAG_NUMBER_TOTAL = 10002;
    uint private constant DOUBLE_CHANCE_TAG = 10003;
    uint private constant PLAYER_PROPS_TAG = 10010;

    struct InitialQuoteParameters {
        address[] sportMarkets;
        uint[] positions;
        uint totalSUSDToPay;
        uint parlaySize;
        uint defaultONE;
        uint[] sgpFees;
        ISportsAMM sportsAMM;
        address parlayAMM;
    }

    struct FinalQuoteParameters {
        address[] sportMarkets;
        uint[] positions;
        uint[] buyQuoteAmounts;
        ISportsAMM sportsAmm;
        uint sUSDAfterFees;
        uint defaultONE;
        uint[] sgpFees;
    }

    struct VerifyMarket {
        address[] sportMarkets;
        uint[] positions;
        ISportsAMM sportsAMM;
        address parlayAMM;
    }

    struct CachedMarket {
        bytes32 gameId;
        uint gameCounter;
    }

    struct CheckSGP {
        address[] sportMarkets;
        uint[] positions;
        uint[] tag1;
        uint[] tag2;
        IParlayPolicy parlayPolicy;
    }

    /// @notice Verifying if given parlay is able to be created given the policies in state
    /// @param params VerifyMarket parameters
    /// @return eligible if the parlay can be created
    /// @return odds the odds for each position
    /// @return sgpFees the fees applied per position in case of SameGameParlay
    function _verifyMarkets(VerifyMarket memory params)
        internal
        view
        returns (
            bool eligible,
            uint[] memory odds,
            uint[] memory sgpFees
        )
    {
        eligible = true;
        uint[] memory tags1;
        uint[] memory tags2;
        IParlayPolicy parlayPolicy = IParlayPolicy(IParlayMarketsAMM(params.parlayAMM).parlayPolicy());
        (tags1, tags2) = _obtainAllTags(params.sportMarkets, parlayPolicy);
        (odds, sgpFees) = _checkSGPAndGetOdds(CheckSGP(params.sportMarkets, params.positions, tags1, tags2, parlayPolicy));
    }

    /// @notice Obtain all the tags for each position and calculate unique ones
    /// @param sportMarkets the sport markets for the parlay
    /// @param _parlayPolicy the parlay policy contract
    /// @return tag1 all the tags 1 per market
    /// @return tag2 all the tags 2 per market
    ////TODO: IIRC we said that we dont need this
    function _obtainAllTags(address[] memory sportMarkets, IParlayPolicy _parlayPolicy)
        internal
        view
        returns (uint[] memory tag1, uint[] memory tag2)
    {
        tag1 = new uint[](sportMarkets.length);
        tag2 = new uint[](sportMarkets.length);
        address sportMarket;
        for (uint i = 0; i < sportMarkets.length; i++) {
            // 1. Get all tags for a sport market (tag1, tag2)
            sportMarket = sportMarkets[i];
            tag1[i] = ISportPositionalMarket(sportMarket).tags(0);
            tag2[i] = ISportPositionalMarket(sportMarket).getTagsLength() > 1
                ? ISportPositionalMarket(sportMarket).tags(1)
                : 0;
            for (uint j = 0; j < i; j++) {
                if (sportMarkets[i] == sportMarkets[j]) {
                    tag1 = new uint[](0);
                    tag2 = new uint[](0);
                    return (tag1, tag2);
                }
            }
        }
    }

    /// @notice Check the names, check if any markets are SGPs, obtain odds and apply fees if needed
    /// @param params all the parameters to calculate the fees and odds per position
    /// @return odds all the odds per position
    /// @return sgpFees all the fees per position
    function _checkSGPAndGetOdds(CheckSGP memory params) internal view returns (uint[] memory odds, uint[] memory sgpFees) {
        odds = new uint[](params.sportMarkets.length);
        sgpFees = new uint[](odds.length);
        bool[] memory alreadyInSGP = new bool[](sgpFees.length);
        for (uint i = 0; i < params.sportMarkets.length; i++) {
            for (uint j = 0; j < i; j++) {
                if (params.sportMarkets[j] != params.sportMarkets[i]) {
                    if (!alreadyInSGP[j] && params.tag1[j] == params.tag1[i] && (params.tag2[i] > 0 || params.tag2[j] > 0)) {
                        address parentI = address(ISportPositionalMarket(params.sportMarkets[i]).parentMarket());
                        address parentJ = address(ISportPositionalMarket(params.sportMarkets[j]).parentMarket());
                        if (
                            (params.tag2[j] > 0 && parentJ == params.sportMarkets[i]) ||
                            (params.tag2[i] > 0 && parentI == params.sportMarkets[j]) ||
                            // the following line is for totals + spreads or totals + playerProps
                            (params.tag2[i] > 0 && params.tag2[j] > 0 && parentI == parentJ)
                        ) {
                            uint sgpFee = params.parlayPolicy.getSgpFeePerCombination(
                                IParlayPolicy.SGPData(
                                    params.tag1[i],
                                    params.tag2[i],
                                    params.tag2[j],
                                    params.positions[i],
                                    params.positions[j]
                                )
                            );
                            if (sgpFee == 0) {
                                revert("SameTeamOnParlay");
                            } else {
                                alreadyInSGP[i] = true;
                                alreadyInSGP[j] = true;
                                if (params.tag2[j] > 0) {
                                    (odds[i], odds[j], sgpFees[i], sgpFees[j]) = _getSGPSingleOdds(
                                        params.parlayPolicy.getMarketDefaultOdds(
                                            params.sportMarkets[i],
                                            params.positions[i]
                                        ),
                                        params.parlayPolicy.getMarketDefaultOdds(
                                            params.sportMarkets[j],
                                            params.positions[j]
                                        ),
                                        params.positions[j],
                                        sgpFee,
                                        params.parlayPolicy.getChildMarketTotalLine(params.sportMarkets[j])
                                    );
                                } else {
                                    (odds[j], odds[i], sgpFees[j], sgpFees[i]) = _getSGPSingleOdds(
                                        params.parlayPolicy.getMarketDefaultOdds(
                                            params.sportMarkets[j],
                                            params.positions[j]
                                        ),
                                        params.parlayPolicy.getMarketDefaultOdds(
                                            params.sportMarkets[i],
                                            params.positions[i]
                                        ),
                                        params.positions[i],
                                        sgpFee,
                                        params.parlayPolicy.getChildMarketTotalLine(params.sportMarkets[i])
                                    );
                                }
                            }
                        }
                    }
                } else {
                    revert("SameTeamOnParlay");
                }
            }
            if (odds[i] == 0) {
                odds[i] = params.parlayPolicy.getMarketDefaultOdds(params.sportMarkets[i], params.positions[i]);
            }
        }
    }

    function getSPGOdds(
        uint odds1,
        uint odds2,
        uint position2,
        uint sgpFee,
        uint totalsLine
    )
        external
        pure
        returns (
            uint resultOdds1,
            uint resultOdds2,
            uint sgpFee1,
            uint sgpFee2
        )
    {
        (resultOdds1, resultOdds2, sgpFee1, sgpFee2) = _getSGPSingleOdds(odds1, odds2, position2, sgpFee, totalsLine);
    }

    /// @notice Calculate the sgpFees for the positions of two sport markets, given their odds and default sgpfee
    /// @param odds1 the odd of position 1 (usually the moneyline odd)
    /// @param odds2 the odd of position 2 (usually the totals/spreads odd)
    /// @param sgpFee the default sgp fee
    /// @return resultOdds1 the odd1
    /// @return resultOdds2 the odd2
    /// @return sgpFee1 the fee for position 1 or odd1
    /// @return sgpFee2 the fee for position 2 or odd2
    function _getSGPSingleOdds(
        uint odds1,
        uint odds2,
        uint position2,
        uint sgpFee,
        uint totalsLine
    )
        internal
        pure
        returns (
            uint resultOdds1,
            uint resultOdds2,
            uint sgpFee1,
            uint sgpFee2
        )
    {
        // The default odds are obtained during the function call
        // This way they are stored for further usage
        resultOdds1 = odds1;
        resultOdds2 = odds2;

        if (odds1 > 0 && odds2 > 0) {
            // for 2 options SGPs use the default SGPfee
            if (totalsLine == 2) {
                sgpFee2 = sgpFee;

                // if the totals position is OVER
                // The cases are purely empirical chosen by correction and trial/error from multiple games
                // ONLY over 50 percent case is generated by a logical behavior in such cases
            } else if (totalsLine == 250) {
                if (position2 == 0) {
                    if (odds1 < (6 * ONE_PERCENT) && odds2 < (70 * ONE_PERCENT)) {
                        sgpFee2 = sgpFee - (ONE - sgpFee);
                    } else if (odds1 >= (99 * ONE_PERCENT)) {
                        sgpFee2 = sgpFee + ((ONE - sgpFee) - 1 * ONE_PERCENT);
                    } else if (odds1 >= (96 * ONE_PERCENT)) {
                        sgpFee2 = sgpFee + ((ONE - sgpFee) * 90 * ONE_PERCENT) / ONE;
                    } else if (odds1 >= (93 * ONE_PERCENT)) {
                        sgpFee2 = sgpFee + ((ONE - sgpFee) * 75 * ONE_PERCENT) / ONE;
                    } else if (odds1 >= (90 * ONE_PERCENT) && odds2 >= (65 * ONE_PERCENT)) {
                        sgpFee2 = sgpFee + ((ONE - sgpFee) * 90 * ONE_PERCENT) / ONE;
                    } else if (odds1 >= (83 * ONE_PERCENT) && odds2 >= (98 * ONE_PERCENT)) {
                        sgpFee2 = sgpFee + (5 * ONE_PERCENT);
                    } else if (odds1 >= (83 * ONE_PERCENT) && odds2 >= (52 * ONE_PERCENT)) {
                        sgpFee2 = sgpFee + ((ONE - sgpFee) * 30 * ONE_PERCENT) / ONE;
                    } else if (odds1 >= (80 * ONE_PERCENT) && odds2 >= (70 * ONE_PERCENT)) {
                        sgpFee2 = sgpFee + ((ONE - sgpFee) * 50 * ONE_PERCENT) / ONE;
                    } else if (odds1 >= (80 * ONE_PERCENT) && odds2 >= (60 * ONE_PERCENT)) {
                        sgpFee2 = sgpFee + ((ONE - sgpFee) * 30 * ONE_PERCENT) / ONE;
                    } else if (odds1 >= (80 * ONE_PERCENT) && odds2 >= (50 * ONE_PERCENT)) {
                        sgpFee2 = sgpFee + ((ONE - sgpFee) * 90 * ONE_PERCENT) / ONE;
                    } else if (odds2 >= (52 * ONE_PERCENT)) {
                        if (odds1 <= (46 * ONE_PERCENT)) {
                            sgpFee2 = sgpFee + (((5 * ONE_PERCENT) * (ONE - odds1)) / ONE);
                            // sgpFee2 = ONE;
                        } else {
                            sgpFee2 = sgpFee;
                        }
                    } else if (odds2 >= (50 * ONE_PERCENT)) {
                        if (odds1 < (10 * ONE_PERCENT)) {
                            // sgpFee2 = ONE + odds1;
                            sgpFee2 = ONE;
                        } else {
                            // Logical behaviour case (which is very limited, but was an initial refactor)
                            // If the odds difference is higher the sgpFee is lowered significantly
                            // If the odds difference is lower, the sgpFee is lowered by a small amount
                            uint oddsDiff = odds2 > odds1 ? odds2 - odds1 : odds1 - odds2;
                            if (oddsDiff > 0) {
                                oddsDiff = (oddsDiff - (5 * ONE_PERCENT) / (90 * ONE_PERCENT));
                                oddsDiff = ((ONE - sgpFee) * oddsDiff) / ONE;
                                sgpFee2 = (sgpFee * (ONE + oddsDiff)) / ONE;
                            } else {
                                sgpFee2 = sgpFee;
                            }
                        }
                    } else if (odds2 >= (43 * ONE_PERCENT)) {
                        if (odds2 <= (46 * ONE_PERCENT)) {
                            sgpFee2 = sgpFee > 5 * ONE_PERCENT ? sgpFee - (2 * ONE_PERCENT) : sgpFee;
                        }
                        uint oddsDiff = odds2 > odds1 ? odds2 - odds1 : odds1 - odds2;
                        if (oddsDiff > 0) {
                            oddsDiff = (oddsDiff - (5 * ONE_PERCENT) / (90 * ONE_PERCENT));
                            oddsDiff = ((ONE - sgpFee + (ONE - sgpFee) / 2) * oddsDiff) / ONE;

                            sgpFee2 = (sgpFee * (ONE + oddsDiff)) / ONE;
                        } else {
                            sgpFee2 = sgpFee;
                        }
                    } else if (odds2 >= (35 * ONE_PERCENT)) {
                        if (odds1 <= (46 * ONE_PERCENT)) {
                            sgpFee2 = sgpFee - (((ONE - sgpFee) * (ONE - odds1)) / ONE);
                        } else {
                            sgpFee2 = sgpFee > 5 * ONE_PERCENT ? sgpFee - (2 * ONE_PERCENT) : sgpFee;
                        }
                    } else if (odds2 < (35 * ONE_PERCENT)) {
                        if (odds1 <= (46 * ONE_PERCENT)) {
                            sgpFee2 = sgpFee + ((ONE - sgpFee) * 90 * ONE_PERCENT) / ONE;
                        } else {
                            sgpFee2 = sgpFee > 5 * ONE_PERCENT ? sgpFee - (2 * ONE_PERCENT) : sgpFee;
                        }
                    }
                    // case when the totals odd is UNDER
                } else {
                    if (odds2 >= (56 * ONE_PERCENT)) {
                        if (odds1 >= 76 * ONE_PERCENT) {
                            // sgpFee2 = (ONE + (15 * ONE_PERCENT) + (odds1 * 15 * ONE_PERCENT) / ONE);
                            sgpFee2 = ONE;
                        } else if (odds1 >= 60 * ONE_PERCENT) {
                            // sgpFee2 = ONE + (ONE - sgpFee);
                            sgpFee2 = ONE;
                        } else {
                            // sgpFee2 = (ONE + (15 * ONE_PERCENT) + (odds1 * 10 * ONE_PERCENT) / ONE);
                            sgpFee2 = ONE;
                        }
                    } else if (odds2 <= (38 * ONE_PERCENT) && odds1 >= (80 * ONE_PERCENT)) {
                        // sgpFee2 = ONE + (ONE - sgpFee + 5 * ONE_PERCENT);
                        sgpFee2 = ONE;
                    } else if (odds2 <= (38 * ONE_PERCENT) && odds1 >= (50 * ONE_PERCENT)) {
                        // sgpFee2 = ONE + (ONE - sgpFee + 5 * ONE_PERCENT);
                        sgpFee2 = ONE;
                    } else if (odds2 <= (38 * ONE_PERCENT) && odds1 >= (30 * ONE_PERCENT)) {
                        // sgpFee2 = ONE + (2 * (ONE - sgpFee));
                        sgpFee2 = ONE;
                    } else if (odds2 <= (38 * ONE_PERCENT) && odds1 >= (70 * ONE_PERCENT)) {
                        // sgpFee2 = ONE + (ONE - sgpFee + 10 * ONE_PERCENT);
                        sgpFee2 = ONE;
                    } else if (odds2 <= (38 * ONE_PERCENT) && odds1 >= (66 * ONE_PERCENT)) {
                        // sgpFee2 = ONE + (ONE - sgpFee + 25 * ONE_PERCENT);
                        sgpFee2 = ONE;
                    } else if (odds2 <= (45 * ONE_PERCENT) && odds1 >= (70 * ONE_PERCENT)) {
                        // sgpFee2 = ONE + (2 * (ONE - sgpFee));
                        sgpFee2 = ONE;
                    } else if (odds2 <= (45 * ONE_PERCENT) && odds1 >= (40 * ONE_PERCENT)) {
                        sgpFee2 = sgpFee + ((ONE - sgpFee) * 80 * ONE_PERCENT) / ONE;
                    } else if (odds2 <= (45 * ONE_PERCENT) && odds1 >= (20 * ONE_PERCENT)) {
                        sgpFee2 = sgpFee + ((ONE - sgpFee) * 50 * ONE_PERCENT) / ONE;
                    } else if (odds2 <= (45 * ONE_PERCENT) && odds1 < (20 * ONE_PERCENT)) {
                        sgpFee2 = sgpFee + ((ONE - sgpFee) * 30 * ONE_PERCENT) / ONE;
                    } else if (odds2 <= (48 * ONE_PERCENT) && odds1 <= (11 * ONE_PERCENT)) {
                        sgpFee2 = (sgpFee * 95 * ONE_PERCENT) / ONE;
                    } else if (odds2 < (54 * ONE_PERCENT) && odds1 >= (74 * ONE_PERCENT)) {
                        // sgpFee2 = ONE + (ONE - sgpFee);
                        sgpFee2 = ONE;
                    } else if (odds2 < (54 * ONE_PERCENT) && odds1 >= (58 * ONE_PERCENT)) {
                        // sgpFee2 = ONE + (ONE - sgpFee + 10 * ONE_PERCENT);
                        sgpFee2 = ONE;
                    } else if (odds2 < (54 * ONE_PERCENT) && odds1 >= (20 * ONE_PERCENT)) {
                        // sgpFee2 = ONE + (ONE - sgpFee);
                        sgpFee2 = ONE;
                    } else if (odds2 < (54 * ONE_PERCENT) && odds1 < (20 * ONE_PERCENT)) {
                        // sgpFee2 = ONE + ((ONE - sgpFee) * 50 * ONE_PERCENT) / ONE;
                        sgpFee2 = ONE;
                    } else if (odds2 < (56 * ONE_PERCENT) && odds1 >= (82 * ONE_PERCENT)) {
                        // sgpFee2 = ONE + ((ONE - sgpFee) * 50 * ONE_PERCENT) / ONE;
                        sgpFee2 = ONE;
                    } else if (odds2 < (56 * ONE_PERCENT) && odds1 >= (40 * ONE_PERCENT)) {
                        // sgpFee2 = ONE + (ONE - sgpFee);
                        sgpFee2 = ONE;
                    } else if (odds2 < (56 * ONE_PERCENT) && odds1 >= (10 * ONE_PERCENT)) {
                        // sgpFee2 = ONE + (ONE - sgpFee);
                        sgpFee2 = ONE;
                    } else {
                        sgpFee2 = sgpFee;
                    }
                }
            } else {
                sgpFee2 = sgpFee;
            }
            // Recalculation of the SGP fee in case it results in lower than the initial quotes
            if (sgpFee2 > 0) {
                uint totalQuote = (odds1 * odds2) / ONE;
                uint totalQuoteWSGP = ((totalQuote * ONE * ONE) / sgpFee2) / ONE;
                if (totalQuoteWSGP > odds1 && odds1 < odds2) {
                    sgpFee2 = odds2 + (4 * 1e15);
                } else if (totalQuoteWSGP > odds2 && odds2 <= odds1) {
                    sgpFee2 = odds1 + (4 * 1e15);
                }
            }
        }
    }

    function calculateInitialQuotesForParlay(InitialQuoteParameters memory params)
        external
        view
        returns (
            uint totalQuote,
            uint totalBuyAmount,
            uint skewImpact,
            uint[] memory finalQuotes,
            uint[] memory amountsToBuy
        )
    {
        uint numOfMarkets = params.sportMarkets.length;
        uint inverseSum;
        bool eligible;
        uint[] memory marketOdds;
        (eligible, marketOdds, params.sgpFees) = _verifyMarkets(
            VerifyMarket(params.sportMarkets, params.positions, params.sportsAMM, params.parlayAMM)
        );
        if (eligible && numOfMarkets == params.positions.length && numOfMarkets > 0 && numOfMarkets <= params.parlaySize) {
            finalQuotes = new uint[](numOfMarkets);
            amountsToBuy = new uint[](numOfMarkets);
            for (uint i = 0; i < numOfMarkets; i++) {
                if (params.positions[i] > 2) {
                    totalQuote = 0;
                    break;
                }
                if (marketOdds.length == 0) {
                    totalQuote = 0;
                    break;
                }
                finalQuotes[i] = (params.defaultONE * marketOdds[i]);
                totalQuote = totalQuote == 0 ? finalQuotes[i] : (totalQuote * finalQuotes[i]) / ONE;
                skewImpact = skewImpact + finalQuotes[i];
                // use as inverseQuotes
                finalQuotes[i] = ONE - finalQuotes[i];
                inverseSum = inverseSum + finalQuotes[i];
                if (totalQuote == 0) {
                    totalQuote = 0;
                    break;
                }
            }
            if (totalQuote > 0) {
                for (uint i = 0; i < finalQuotes.length; i++) {
                    // use finalQuotes as inverseQuotes in equation
                    // skewImpact is sumOfQuotes
                    // inverseSum is sum of InverseQuotes
                    amountsToBuy[i] =
                        ((ONE * finalQuotes[i] * params.totalSUSDToPay * skewImpact)) /
                        (totalQuote * inverseSum * skewImpact);
                }
                (totalQuote, totalBuyAmount, skewImpact, finalQuotes, amountsToBuy) = calculateFinalQuotes(
                    FinalQuoteParameters(
                        params.sportMarkets,
                        params.positions,
                        amountsToBuy,
                        params.sportsAMM,
                        params.totalSUSDToPay,
                        params.defaultONE,
                        params.sgpFees
                    )
                );
            }
        }
    }

    function calculateFinalQuotes(FinalQuoteParameters memory params)
        internal
        view
        returns (
            uint totalQuote,
            uint totalBuyAmount,
            uint skewImpact,
            uint[] memory finalQuotes,
            uint[] memory buyAmountPerMarket
        )
    {
        uint[] memory buyQuoteAmountPerMarket = new uint[](params.sportMarkets.length);
        buyAmountPerMarket = params.buyQuoteAmounts;
        finalQuotes = new uint[](params.sportMarkets.length);
        uint feesIncluded;
        for (uint i = 0; i < params.sportMarkets.length; i++) {
            totalBuyAmount += params.buyQuoteAmounts[i];
            // buyQuote always calculated with added SportsAMM fees
            buyQuoteAmountPerMarket[i] = (params.defaultONE *
                params.sportsAmm.buyFromAmmQuote(
                    params.sportMarkets[i],
                    obtainSportsAMMPosition(params.positions[i]),
                    params.buyQuoteAmounts[i]
                ));
            if (buyQuoteAmountPerMarket[i] == 0) {
                totalQuote = 0;
                totalBuyAmount = 0;
            }
        }
        for (uint i = 0; i < params.sportMarkets.length; i++) {
            finalQuotes[i] = ((buyQuoteAmountPerMarket[i] * ONE * ONE) / params.buyQuoteAmounts[i]) / ONE;
            // where the SGP fee is actually applied
            if (params.sgpFees[i] > 0) {
                finalQuotes[i] = ((finalQuotes[i] * ONE * ONE) / params.sgpFees[i]) / ONE;
                feesIncluded += params.sgpFees[i] > ONE ? params.sgpFees[i] - ONE : (ONE - params.sgpFees[i]);
            }
            totalQuote = (i == 0) ? finalQuotes[i] : (totalQuote * finalQuotes[i]) / ONE;
        }
        if (totalQuote > 0) {
            if (totalQuote < IParlayMarketsAMM(params.sportsAmm.parlayAMM()).maxSupportedOdds()) {
                totalQuote = IParlayMarketsAMM(params.sportsAmm.parlayAMM()).maxSupportedOdds();
            }
            uint expectedPayout = ((params.sUSDAfterFees * ONE * ONE) / totalQuote) / ONE;
            skewImpact = expectedPayout > totalBuyAmount
                ? (((ONE * expectedPayout) - (ONE * totalBuyAmount)) / (totalBuyAmount))
                : (((ONE * totalBuyAmount) - (ONE * expectedPayout)) / (totalBuyAmount));
            buyAmountPerMarket = _applySkewImpactBatch(buyAmountPerMarket, skewImpact, (expectedPayout > totalBuyAmount));
            totalBuyAmount = _applySkewImpact(totalBuyAmount, skewImpact, (expectedPayout > totalBuyAmount));
            _calculateRisk(params.sportMarkets, (totalBuyAmount - params.sUSDAfterFees), params.sportsAmm.parlayAMM());
            if (feesIncluded > 0) {
                if (skewImpact > feesIncluded) {
                    skewImpact = skewImpact - feesIncluded;
                } else {
                    skewImpact = feesIncluded - skewImpact;
                }
            }
        } else {
            totalBuyAmount = 0;
        }
    }

    function _applySkewImpact(
        uint _value,
        uint _skewImpact,
        bool _addition
    ) internal pure returns (uint newValue) {
        newValue = _addition ? (((ONE + _skewImpact) * _value) / ONE) : (((ONE - _skewImpact) * _value) / ONE);
    }

    function _applySkewImpactBatch(
        uint[] memory _values,
        uint _skewImpact,
        bool _addition
    ) internal pure returns (uint[] memory newValues) {
        newValues = new uint[](_values.length);
        for (uint i = 0; i < _values.length; i++) {
            newValues[i] = _applySkewImpact(_values[i], _skewImpact, _addition);
        }
    }

    function obtainSportsAMMPosition(uint _position) public pure returns (ISportsAMM.Position) {
        if (_position == 0) {
            return ISportsAMM.Position.Home;
        } else if (_position == 1) {
            return ISportsAMM.Position.Away;
        }
        return ISportsAMM.Position.Draw;
    }

    function _calculateRisk(
        address[] memory _sportMarkets,
        uint _sUSDInRisky,
        address _parlayAMM
    ) internal view returns (bool riskFree) {
        require(_checkRisk(_sportMarkets, _sUSDInRisky, _parlayAMM), "RiskPerComb exceeded");
        riskFree = true;
    }

    function _checkRisk(
        address[] memory _sportMarkets,
        uint _sUSDInRisk,
        address _parlayAMM
    ) internal view returns (bool riskFree) {
        if (_sportMarkets.length > 1 && _sportMarkets.length <= IParlayMarketsAMM(_parlayAMM).parlaySize()) {
            uint riskCombination = IParlayMarketsAMM(_parlayAMM).riskPerPackedGamesCombination(
                _calculateCombinationKey(_sportMarkets)
            );
            riskFree = (riskCombination + _sUSDInRisk) <= IParlayMarketsAMM(_parlayAMM).maxAllowedRiskPerCombination();
        }
    }

    function _calculateCombinationKey(address[] memory _sportMarkets) internal pure returns (bytes32) {
        address[] memory sortedAddresses = new address[](_sportMarkets.length);
        sortedAddresses = _sort(_sportMarkets);
        return keccak256(abi.encodePacked(sortedAddresses));
    }

    function _sort(address[] memory data) internal pure returns (address[] memory) {
        _quickSort(data, int(0), int(data.length - 1));
        return data;
    }

    function _quickSort(
        address[] memory arr,
        int left,
        int right
    ) internal pure {
        int i = left;
        int j = right;
        if (i == j) return;
        address pivot = arr[uint(left + (right - left) / 2)];
        while (i <= j) {
            while (arr[uint(i)] < pivot) i++;
            while (pivot < arr[uint(j)]) j--;
            if (i <= j) {
                (arr[uint(i)], arr[uint(j)]) = (arr[uint(j)], arr[uint(i)]);
                i++;
                j--;
            }
        }
        if (left < j) _quickSort(arr, left, j);
        if (i < right) _quickSort(arr, i, right);
    }

    function sort(address[] memory data) external pure returns (address[] memory) {
        _quickSort(data, int(0), int(data.length - 1));
        return data;
    }

    function applySkewImpact(
        uint _value,
        uint _skewImpact,
        bool _addition
    ) external pure returns (uint newValue) {
        newValue = _applySkewImpact(_value, _skewImpact, _addition);
    }

    function calculateCombinationKey(address[] memory _sportMarkets) external pure returns (bytes32) {
        return _calculateCombinationKey(_sportMarkets);
    }
}

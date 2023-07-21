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

import "hardhat/console.sol";

contract ParlayVerifier {
    uint private constant ONE = 1e18;

    uint private constant TAG_F1 = 9445;
    uint private constant TAG_MOTOGP = 9497;
    uint private constant TAG_GOLF = 100121;
    uint private constant TAG_NUMBER_SPREAD = 10001;
    uint private constant TAG_NUMBER_TOTAL = 10002;
    uint private constant DOUBLE_CHANCE_TAG = 10003;

    struct InitialQuoteParameters {
        address[] sportMarkets;
        uint[] positions;
        uint totalSUSDToPay;
        uint parlaySize;
        uint defaultONE;
        uint sgpFee;
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
        uint sgpFee;
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
        uint tag1;
        uint tag2;
    }

    struct ParlayGameData {
        uint tag1;
        uint tag2;
        uint posiiton;
        uint odds;
        bytes32 homeId;
        bytes32 awayId;
    }

    // ISportsAMM sportsAmm;

    function _obtainTagsAndOdds(VerifyMarket memory params) internal view returns (ParlayGameData[] memory parlay) {
        // ITherundownConsumer consumer = ITherundownConsumer(params.sportsAMM.theRundownConsumer());
        // uint numOfParlays = params.sportMarkets.length;
        // parlay = new ParlayGameData[](numOfParlays);
        // uint[] memory defaultOdds;
        // for (uint i = 0; i < numOfParlays; i++) {
        //     (parlay[i].homeId, parlay[i].awayId) = _getGameIds(consumer, params.sportMarkets[i]);
        //     parlay[i].tag1 = ISportPositionalMarket(params.sportMarkets[i]).tags(0);
        //     parlay[i].tag2 = consumer.isChildMarket(params.sportMarkets[i])
        //         ? ISportPositionalMarket(params.sportMarkets[i]).tags(1)
        //         : 0;
        //     defaultOdds = params.sportsAMM.getMarketDefaultOdds(params.sportMarkets[i], false);
        //     parlay[i].odds = defaultOdds[params.positions[i]];
        //     parlay[i].posiiton = params.positions[i];
        // }
        // uint gasFinal = gasleft();
        // console.log(">>>>>> GAS consumed: ", (gasFinal-gasInitial));
    }

    function _obtainAllTags(address[] memory sportMarkets, IParlayPolicy _parlayPolicy)
        internal
        view
        returns (uint[] memory tag1, uint[] memory tag2)
    {
        tag1 = new uint[](sportMarkets.length);
        tag2 = new uint[](sportMarkets.length);
        uint[] memory uniqueTags = new uint[](sportMarkets.length);
        uint[] memory uniqueTagsCount = new uint[](sportMarkets.length);
        uint uniqueTagsCounter;
        address sportMarket;
        bool eligible;
        bool oldUnique;
        for (uint i = 0; i < sportMarkets.length; i++) {
            sportMarket = sportMarkets[i];
            tag1[i] = ISportPositionalMarket(sportMarket).tags(0);
            tag2[i] = ISportPositionalMarket(sportMarket).getTagsLength() > 1
                ? ISportPositionalMarket(sportMarket).tags(1)
                : 0;
            console.log(">>> start tag1: ", tag1[i]);
            console.log(">>> start tag2: ", tag2[i]);
            for (uint j = 0; j < i; j++) {
                if (sportMarkets[i] == sportMarkets[j]) {
                    tag1 = new uint[](0);
                    tag2 = new uint[](0);
                    return (tag1, tag2);
                }
            }
            if (i == 0) {
                uniqueTags[uniqueTagsCounter] = tag1[i];
                ++uniqueTagsCount[uniqueTagsCounter];
                ++uniqueTagsCounter;
            } else {
                oldUnique = false;
                for (uint j = 0; j < uniqueTagsCounter; j++) {
                    if (uniqueTags[j] == tag1[i]) {
                        ++uniqueTagsCount[j];
                        oldUnique = true;
                    }
                }
                if (!oldUnique) {
                    uniqueTags[uniqueTagsCounter] = tag1[i];
                    ++uniqueTagsCount[uniqueTagsCounter];
                    ++uniqueTagsCounter;
                }
            }
        }
        eligible = _getRestrictedCounts(uniqueTags, uniqueTagsCount, uniqueTagsCounter, _parlayPolicy);
        console.log(">>>> eligible tags: ", eligible);
        if (!eligible) {
            tag1 = new uint[](0);
            tag2 = new uint[](0);
        }
    }

    function _getRestrictedCounts(
        uint[] memory _uniqueTags,
        uint[] memory _uniqueTagsCount,
        uint _uniqueTagsCounter,
        IParlayPolicy _parlayPolicyAddress
    ) internal view returns (bool eligible) {
        eligible = true;
        if (_uniqueTagsCounter > 0) {
            uint restrictedCount;
            for (uint i = 0; i < _uniqueTagsCounter; i++) {
                restrictedCount = _parlayPolicyAddress.restrictedMarketsCount(_uniqueTags[i]);
                console.log(">>> tag, count, restricted", _uniqueTags[i], _uniqueTagsCount[i], restrictedCount);
                if (restrictedCount > 0 && restrictedCount < _uniqueTagsCount[i]) {
                    eligible = false;
                }
                if (eligible && i > 0) {
                    for (uint j = 0; j < i; j++) {
                        console.log(">>> j: ", j);
                        if (_parlayPolicyAddress.restrictedTagCombination(_uniqueTags[i], _uniqueTags[j])) {
                            eligible = _parlayPolicyAddress.isRestrictedComboEligible(
                                _uniqueTags[i],
                                _uniqueTags[j],
                                _uniqueTagsCount[i],
                                _uniqueTagsCount[j]
                            );
                            console.log("eligible: ", eligible);
                        }
                    }
                }
            }
        }
    }

    function _getOdds(
        uint[] memory _tag1,
        uint[] memory _tag2,
        uint[] memory _positions,
        address[] memory _sportMarkets,
        address _parlayAMM,
        ISportsAMM _sportsAMM
    ) internal view returns (uint[] memory odds) {
        odds = new uint[](_tag1.length);
        uint sgpFee;
        bool isSGP;
        address[] memory parentMarket = new address[](_tag1.length);
        uint[] memory parentsCount = new uint[](_tag1.length);
        (isSGP, parentMarket) = _checkNamesAndGetParent(
            _sportMarkets,
            _tag1,
            ITherundownConsumer(_sportsAMM.theRundownConsumer())
        );
        // for (uint i = 0; i < parentMarket.length; i++) {
        //     parentMarket[i] = address(ISportPositionalMarket(_sportMarkets[i]).parentMarket());
        // }
        for (uint i = 1; i < _tag1.length; i++) {
            for (uint j = 0; j < i; j++) {
                if (_tag1[j] == _tag1[i]) {
                    console.log(">>>> ---> same tag1");
                    if (_sportMarkets[j] != _sportMarkets[i]) {
                        console.log(">>>> ---> different game");
                        isSGP = false;
                        console.log(">>>> ---> tag2_j: ", _tag2[j]);
                        console.log(">>>> ---> tag2_i: ", _tag2[i]);
                        if (_tag2[i] > 0 && _tag2[j] > 0) {
                            isSGP = parentMarket[i] == parentMarket[j];
                            parentsCount[i]++;
                        } else if (_tag2[i] > 0) {
                            // address parent = address(ISportPositionalMarket(_sportMarkets[i]).parentMarket());
                            // console.log(">>>> ----> parent i: ", parent);
                            isSGP = parentMarket[i] == _sportMarkets[j];
                            parentsCount[i]++;
                        } else if (_tag2[j] > 0) {
                            // address parent = address(ISportPositionalMarket(_sportMarkets[j]).parentMarket());
                            // console.log(">>>> ----> parent j: ", parent);
                            isSGP = parentMarket[j] == _sportMarkets[i];
                            parentsCount[i]++;
                        }
                        console.log(">>>> ---> ===> parentsCount: ", parentsCount[i]);
                        if (parentsCount[i] > 2) {
                            odds = new uint[](0);
                            return odds;
                        }
                        console.log(">>>> ---> isSGP: ", isSGP);
                        if (isSGP) {
                            sgpFee = IParlayMarketsAMM(_parlayAMM).getSgpFeePerCombination(_tag1[i], _tag2[i], _tag2[j]);
                            if (sgpFee > 0) {
                                //get odds
                                console.log(">>>> sgpOdds>>>> odds1: ", odds[i]);
                                console.log(">>>> sgpOdds>>>> odds2: ", odds[j]);
                                (odds[i], odds[j]) = _getSGPOdds(
                                    _sportsAMM.getMarketDefaultOdds(_sportMarkets[i], false)[_positions[i]],
                                    _sportsAMM.getMarketDefaultOdds(_sportMarkets[j], false)[_positions[j]],
                                    sgpFee
                                );
                                console.log(">>>> sgpOdds>>>> resultOdds1: ", odds[i]);
                                console.log(">>>> sgpOdds>>>> resultOdds2: ", odds[j]);
                            } else {
                                odds = new uint[](0);
                                return odds;
                            }
                        }
                    }
                }
            }
        }
        for (uint i = 0; i < odds.length; i++) {
            if (odds[i] == 0) {
                odds[i] = _sportsAMM.getMarketDefaultOdds(_sportMarkets[i], false)[_positions[i]];
            }
            console.log(">>> >>>> odds: ", odds[i]);
        }
    }

    function _checkNamesAndGetParent(
        address[] memory _sportMarkets,
        uint[] memory _tag1,
        ITherundownConsumer consumer
    ) internal view returns (bool eligible, address[] memory parentMarket) {
        bytes32[] memory cachedTeams = new bytes32[](_sportMarkets.length * 2);
        parentMarket = new address[](_sportMarkets.length);
        bytes32 homeId;
        bytes32 awayId;
        uint lastCachedIdx;
        eligible = true;
        for (uint i = 0; i < _sportMarkets.length; i++) {
            (homeId, awayId) = _getGameIds(consumer, _sportMarkets[i]);
            for (uint j = 0; j < lastCachedIdx; j++) {
                if (cachedTeams[j] == homeId || cachedTeams[j] == awayId) {
                    if (_sportMarkets[i] != _sportMarkets[j / 2]) {
                        if (_tag1[i] == _tag1[j / 2]) {
                            eligible = false;
                        } else {
                            //todo check if it is allowed
                            console.log(">>>> CHECK if it is ALLOWED");
                        }
                    }
                }
                if (eligible) {
                    parentMarket[i] = address(ISportPositionalMarket(_sportMarkets[i]).parentMarket());
                }
            }
        }
    }

    function _getSGPOdds(
        uint odds1,
        uint odds2,
        uint sgpFee
    ) internal pure returns (uint resultOdds1, uint resultOdds2) {
        uint multiplied = (odds1 * odds2) / ONE;
        uint discountedQuote = ((multiplied * ONE * ONE) / sgpFee) / ONE;
        if (odds1 > odds2) {
            resultOdds1 = odds1;
            resultOdds2 = ((discountedQuote * ONE * ONE) / odds1) / ONE;
        } else {
            resultOdds1 = ((discountedQuote * ONE * ONE) / odds2) / ONE;
            resultOdds2 = odds2;
        }
    }

    function _verifyMarkets(VerifyMarket memory params) internal view returns (bool eligible, uint[] memory odds) {
        uint[] memory tags1;
        uint[] memory tags2;
        // IParlayPolicy parlayPolicyAddress = IParlayPolicy(IParlayMarketsAMM(params.parlayAMM).parlayPolicy());
        (tags1, tags2) = _obtainAllTags(
            params.sportMarkets,
            IParlayPolicy(IParlayMarketsAMM(params.parlayAMM).parlayPolicy())
        );
        // _obtainAllTags(params.sportMarkets, params.parlayAMM);
        odds = _getOdds(tags1, tags2, params.positions, params.sportMarkets, params.parlayAMM, params.sportsAMM);
        eligible = true;
        // ITherundownConsumer consumer = ITherundownConsumer(params.sportsAMM.theRundownConsumer());
        // CachedMarket[] memory cachedTeams = new CachedMarket[](params.sportMarkets.length * 2);
        // uint lastCachedIdx = 0;
        // bytes32 gameIdHome;
        // bytes32 gameIdAway;
        // uint tag1;
        // uint tag2;
        // address sportMarket;
        // uint motoCounter = 0;
        // for (uint i = 0; i < params.sportMarkets.length; i++) {
        //     sportMarket = params.sportMarkets[i];
        //     (gameIdHome, gameIdAway) = _getGameIds(consumer, sportMarket);
        //     tag1 = ISportPositionalMarket(sportMarket).tags(0);
        //     tag2 = consumer.isChildMarket(sportMarket) ? ISportPositionalMarket(sportMarket).tags(1) : 0;
        //     motoCounter = (tag1 == TAG_F1 || tag1 == TAG_MOTOGP || tag1 == TAG_GOLF) ? ++motoCounter : motoCounter;
        // require(motoCounter <= 1, "2xMotosport");
        // // check if game IDs already exist
        // for (uint j = 0; j < lastCachedIdx; j++) {
        //     if (
        //         (cachedTeams[j].gameId == gameIdHome ||
        //             (j > 1 && cachedTeams[j].gameId == gameIdAway && cachedTeams[j - 1].gameId != gameIdHome))
        //         // && cachedTeams[j].tag1 == tag1
        //     ) {
        //         uint feeToApply = IParlayMarketsAMM(params.parlayAMM).getSgpFeePerCombination(
        //             tag1,
        //             tag2,
        //             cachedTeams[j].tag2,
        //             100 + (10 * position[i] + position[j / 2])
        //         );
        //         if (cachedTeams[j].gameCounter > 0 || feeToApply == 0) {
        //             revert("SameTeamOnParlay");
        //         }
        //         cachedTeams[j].gameCounter += 1;
        //         sgpFee = sgpFee > 0 ? (sgpFee * feeToApply) / ONE : feeToApply;
        //     }
        // }

        //     (cachedTeams[lastCachedIdx].tag1, cachedTeams[lastCachedIdx].tag2) = (tag1, tag2);
        //     cachedTeams[lastCachedIdx++].gameId = gameIdHome;
        //     (cachedTeams[lastCachedIdx].tag1, cachedTeams[lastCachedIdx].tag2) = (tag1, tag2);
        //     cachedTeams[lastCachedIdx++].gameId = gameIdAway;
        // }
    }

    function _calculateRisk(
        address[] memory _sportMarkets,
        uint _sUSDInRisky,
        address _parlayAMM
    ) internal view returns (bool riskFree) {
        // address[] memory sortedAddresses = new address[](_sportMarkets.length);
        // sortedAddresses = _sort(_sportMarkets);
        require(_checkRisk(_sportMarkets, _sUSDInRisky, _parlayAMM), "RiskPerComb exceeded");
        riskFree = true;
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
        (eligible, marketOdds) = _verifyMarkets(
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
                // marketOdds = params.sportsAMM.getMarketDefaultOdds(params.sportMarkets[i], false);
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
                        params.sgpFee
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
            totalQuote = (i == 0) ? finalQuotes[i] : (totalQuote * finalQuotes[i]) / ONE;
        }
        if (totalQuote > 0) {
            // totalQuote = params.sgpFee > 0 ? ((totalQuote * ONE * ONE) / params.sgpFee) / ONE : totalQuote;
            if (totalQuote < IParlayMarketsAMM(params.sportsAmm.parlayAMM()).maxSupportedOdds()) {
                totalQuote = IParlayMarketsAMM(params.sportsAmm.parlayAMM()).maxSupportedOdds();
            }
            uint expectedPayout = ((params.sUSDAfterFees * ONE * ONE) / totalQuote) / ONE;
            skewImpact = expectedPayout > totalBuyAmount
                ? (((ONE * expectedPayout) - (ONE * totalBuyAmount)) / (totalBuyAmount))
                : (((ONE * totalBuyAmount) - (ONE * expectedPayout)) / (totalBuyAmount));
            buyAmountPerMarket = _applySkewImpactBatch(buyAmountPerMarket, skewImpact, (expectedPayout > totalBuyAmount));
            totalBuyAmount = applySkewImpact(totalBuyAmount, skewImpact, (expectedPayout > totalBuyAmount));
            _calculateRisk(params.sportMarkets, (totalBuyAmount - params.sUSDAfterFees), params.sportsAmm.parlayAMM());
        } else {
            totalBuyAmount = 0;
        }
    }

    function applySkewImpact(
        uint _value,
        uint _skewImpact,
        bool _addition
    ) public pure returns (uint newValue) {
        newValue = _addition ? (((ONE + _skewImpact) * _value) / ONE) : (((ONE - _skewImpact) * _value) / ONE);
    }

    function _applySkewImpactBatch(
        uint[] memory _values,
        uint _skewImpact,
        bool _addition
    ) internal pure returns (uint[] memory newValues) {
        newValues = new uint[](_values.length);
        for (uint i = 0; i < _values.length; i++) {
            newValues[i] = applySkewImpact(_values[i], _skewImpact, _addition);
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

    function calculateCombinationKey(address[] memory _sportMarkets) public pure returns (bytes32) {
        address[] memory sortedAddresses = new address[](_sportMarkets.length);
        sortedAddresses = _sort(_sportMarkets);
        return keccak256(abi.encodePacked(sortedAddresses));
    }

    function getSkewImpact(
        address[] memory _sportMarkets,
        uint[] memory _positions,
        uint _sUSDAfterFees,
        ISportsAMM _sportsAMM,
        address _parlayAMM,
        uint _totalBuyAmount,
        uint _totalQuote,
        uint _oldSkew
    ) external view returns (uint resultSkewImpact) {
        uint newBuyAmount;
        //todo refactor this part
        uint sgpFee = 5 * 1e16;
        // (, uint sgpFee) = _verifyMarkets(VerifyMarket(_sportMarkets, _positions, ISportsAMM(_sportsAMM), _parlayAMM));
        if (sgpFee > 0) {
            _totalQuote = (_totalQuote * sgpFee) / ONE;
            newBuyAmount = ((_sUSDAfterFees * ONE * ONE) / _totalQuote) / ONE;
        } else {
            newBuyAmount = ((_sUSDAfterFees * ONE * ONE) / (_totalQuote)) / ONE;
        }
        resultSkewImpact = newBuyAmount > _totalBuyAmount
            ? (((ONE * newBuyAmount) - (ONE * _totalBuyAmount)) / (_totalBuyAmount))
            : (((ONE * _totalBuyAmount) - (ONE * newBuyAmount)) / (_totalBuyAmount));
        resultSkewImpact = _oldSkew > resultSkewImpact ? _oldSkew - resultSkewImpact : 0;
    }

    function _checkRisk(
        address[] memory _sportMarkets,
        uint _sUSDInRisk,
        address _parlayAMM
    ) internal view returns (bool riskFree) {
        if (_sportMarkets.length > 1 && _sportMarkets.length <= IParlayMarketsAMM(_parlayAMM).parlaySize()) {
            uint riskCombination = IParlayMarketsAMM(_parlayAMM).riskPerPackedGamesCombination(
                calculateCombinationKey(_sportMarkets)
            );
            riskFree = (riskCombination + _sUSDInRisk) <= IParlayMarketsAMM(_parlayAMM).maxAllowedRiskPerCombination();
        }
    }

    function sort(address[] memory data) external pure returns (address[] memory) {
        _quickSort(data, int(0), int(data.length - 1));
        return data;
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

    function _getGameIds(ITherundownConsumer consumer, address sportMarket)
        internal
        view
        returns (bytes32 home, bytes32 away)
    {
        ITherundownConsumer.GameCreate memory game = consumer.getGameCreatedById(consumer.gameIdPerMarket(sportMarket));

        home = keccak256(abi.encodePacked(game.homeTeam));
        away = keccak256(abi.encodePacked(game.awayTeam));
    }

    function _sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}

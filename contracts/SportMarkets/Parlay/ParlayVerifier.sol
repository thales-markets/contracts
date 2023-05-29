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

contract ParlayVerifier {
    uint private constant ONE = 1e18;

    uint private constant TAG_F1 = 9445;
    uint private constant TAG_MOTOGP = 9497;
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
        ISportsAMM sportsAMM;
        address parlayAMM;
    }

    struct CachedMarket {
        bytes32 gameId;
        uint gameCounter;
        uint tag1;
        uint tag2;
    }

    // ISportsAMM sportsAmm;

    function _verifyMarkets(VerifyMarket memory params)
        internal
        view
        returns (
            // address[] memory _sportMarkets,
            // uint[] memory _positions,
            // uint _totalSUSDToPay,
            // ISportsAMM _sportsAMM,
            // address _parlayAMM
            bool eligible,
            uint sgpFee
        )
    {
        eligible = true;
        ITherundownConsumer consumer = ITherundownConsumer(params.sportsAMM.theRundownConsumer());
        // bytes32[] memory cachedTeams = new bytes32[](_sportMarkets.length * 2);
        CachedMarket[] memory cachedTeams = new CachedMarket[](params.sportMarkets.length * 2);
        uint lastCachedIdx = 0;
        bytes32 gameIdHome;
        bytes32 gameIdAway;
        uint tag1;
        uint tag2;
        uint motoCounter = 0;
        for (uint i = 0; i < params.sportMarkets.length; i++) {
            address sportMarket = params.sportMarkets[i];
            (gameIdHome, gameIdAway) = _getGameIds(consumer, sportMarket);
            tag1 = ISportPositionalMarket(sportMarket).tags(0);
            tag2 = consumer.isChildMarket(sportMarket) ? ISportPositionalMarket(sportMarket).tags(1) : 0;
            motoCounter = (tag1 == TAG_F1 || tag1 == TAG_MOTOGP) ? ++motoCounter : motoCounter;
            require(motoCounter <= 1, "2xMotosport");
            // check if game IDs already exist
            for (uint j = 0; j < lastCachedIdx; j++) {
                if (
                    (cachedTeams[j].gameId == gameIdHome ||
                        (j > 1 && cachedTeams[j].gameId == gameIdAway && cachedTeams[j - 1].gameId != gameIdHome)) &&
                    cachedTeams[j].tag1 == tag1
                ) {
                    uint feeToApply = IParlayMarketsAMM(params.parlayAMM).getSgpFeePerCombination(
                        tag1,
                        tag2,
                        cachedTeams[j].tag2
                    );
                    if (cachedTeams[j].gameCounter > 0 || feeToApply == 0) {
                        revert("SameTeamOnParlay");
                    }
                    cachedTeams[j].gameCounter += 1;

                    sgpFee = sgpFee > 0 ? (sgpFee * feeToApply) / ONE : feeToApply;
                }
            }

            (cachedTeams[lastCachedIdx].tag1, cachedTeams[lastCachedIdx].tag2) = (tag1, tag2);
            cachedTeams[lastCachedIdx++].gameId = gameIdHome;
            (cachedTeams[lastCachedIdx].tag1, cachedTeams[lastCachedIdx].tag2) = (tag1, tag2);
            cachedTeams[lastCachedIdx++].gameId = gameIdAway;
        }
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
        (eligible, params.sgpFee) = _verifyMarkets(VerifyMarket(params.sportMarkets, params.sportsAMM, params.parlayAMM));
        if (eligible && numOfMarkets == params.positions.length && numOfMarkets > 0 && numOfMarkets <= params.parlaySize) {
            finalQuotes = new uint[](numOfMarkets);
            amountsToBuy = new uint[](numOfMarkets);
            uint[] memory marketOdds;
            for (uint i = 0; i < numOfMarkets; i++) {
                if (params.positions[i] > 2) {
                    totalQuote = 0;
                    break;
                }
                marketOdds = params.sportsAMM.getMarketDefaultOdds(params.sportMarkets[i], false);
                if (marketOdds.length == 0) {
                    totalQuote = 0;
                    break;
                }
                finalQuotes[i] = (params.defaultONE * marketOdds[params.positions[i]]);
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
            totalQuote = params.sgpFee > 0 ? ((totalQuote * ONE * ONE) / params.sgpFee) / ONE : totalQuote;
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
        uint _sUSDAfterFees,
        ISportsAMM _sportsAMM,
        address _parlayAMM,
        uint _totalBuyAmount,
        uint _totalQuote,
        uint _oldSkew
    ) external view returns (uint resultSkewImpact) {
        uint newBuyAmount;
        (, uint sgpFee) = _verifyMarkets(VerifyMarket(_sportMarkets, ISportsAMM(_sportsAMM), _parlayAMM));
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
}

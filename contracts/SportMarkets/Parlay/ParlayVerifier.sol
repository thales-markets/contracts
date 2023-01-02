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

contract ParlayVerifier {
    uint private constant ONE = 1e18;

    // ISportsAMM sportsAmm;

    function verifyMarkets(
        address[] memory _sportMarkets,
        uint[] memory _positions,
        uint _totalSUSDToPay,
        ISportsAMM _sportsAMM,
        address _parlayAMM
    ) external view returns (bool eligible) {
        eligible = true;
        uint motoCounter = 0;
        for (uint i = 0; i < _sportMarkets.length; i++) {
            if (!_verifyMarket(_sportMarkets, i, _sportsAMM)) {
                eligible = false;
                break;
            }
            uint marketTag = ISportPositionalMarket(_sportMarkets[i]).tags(0);
            if (marketTag == 9100 || marketTag == 9101) {
                if (motoCounter > 0) {
                    eligible = false;
                    break;
                }
                motoCounter++;
            }
        }
    }

    function _calculateRisk(
        address[] memory _sportMarkets,
        uint _sUSDInRisky,
        address _parlayAMM
    ) internal view returns (bool riskFree) {
        address[] memory sortedAddresses = new address[](_sportMarkets.length);
        sortedAddresses = _sort(_sportMarkets);
        require(_checkRisk(sortedAddresses, _sUSDInRisky, _parlayAMM), "RiskPerComb exceeded");
        riskFree = true;
    }

    function calculateInitialQuotesForParlay(
        address[] memory _sportMarkets,
        uint[] memory _positions,
        uint _totalSUSDToPay,
        uint _parlaySize,
        ISportsAMM _sportsAMM
    )
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
        uint numOfMarkets = _sportMarkets.length;
        uint inverseSum;
        if (_totalSUSDToPay < ONE) {
            _totalSUSDToPay = ONE;
        }
        if (numOfMarkets == _positions.length && numOfMarkets > 0 && numOfMarkets <= _parlaySize) {
            finalQuotes = new uint[](numOfMarkets);
            amountsToBuy = new uint[](numOfMarkets);
            uint[] memory marketOdds;
            for (uint i = 0; i < numOfMarkets; i++) {
                if (_positions[i] > 2) {
                    totalQuote = 0;
                    break;
                }
                marketOdds = _sportsAMM.getMarketDefaultOdds(_sportMarkets[i], false);
                if (marketOdds.length == 0) {
                    totalQuote = 0;
                    break;
                }
                finalQuotes[i] = marketOdds[_positions[i]];
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
                        ((ONE * finalQuotes[i] * _totalSUSDToPay * skewImpact)) /
                        (totalQuote * inverseSum * skewImpact);
                }
                (totalQuote, totalBuyAmount, skewImpact, finalQuotes, amountsToBuy) = calculateFinalQuotes(
                    _sportMarkets,
                    _positions,
                    amountsToBuy,
                    _sportsAMM,
                    _totalSUSDToPay
                );
            }
        }
    }

    function calculateFinalQuotes(
        address[] memory _sportMarkets,
        uint[] memory _positions,
        uint[] memory _buyQuoteAmounts,
        ISportsAMM sportsAmm,
        uint sUSDAfterFees
    )
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
        uint[] memory buyQuoteAmountPerMarket = new uint[](_sportMarkets.length);
        buyAmountPerMarket = _buyQuoteAmounts;
        finalQuotes = new uint[](_sportMarkets.length);
        for (uint i = 0; i < _sportMarkets.length; i++) {
            totalBuyAmount += _buyQuoteAmounts[i];
            // buyQuote always calculated with added SportsAMM fees
            buyQuoteAmountPerMarket[i] = sportsAmm.buyFromAmmQuote(
                _sportMarkets[i],
                obtainSportsAMMPosition(_positions[i]),
                _buyQuoteAmounts[i]
            );
            if (buyQuoteAmountPerMarket[i] == 0) {
                totalQuote = 0;
                totalBuyAmount = 0;
            }
        }
        for (uint i = 0; i < _sportMarkets.length; i++) {
            finalQuotes[i] = ((buyQuoteAmountPerMarket[i] * ONE * ONE) / _buyQuoteAmounts[i]) / ONE;
            totalQuote = (i == 0) ? finalQuotes[i] : (totalQuote * finalQuotes[i]) / ONE;
        }
        if (totalQuote > 0) {
            if (totalQuote < IParlayMarketsAMM(sportsAmm.parlayAMM()).maxSupportedOdds()) {
                totalQuote = IParlayMarketsAMM(sportsAmm.parlayAMM()).maxSupportedOdds();
            }
            uint expectedPayout = ((sUSDAfterFees * ONE * ONE) / totalQuote) / ONE;
            skewImpact = expectedPayout > totalBuyAmount
                ? (((ONE * expectedPayout) - (ONE * totalBuyAmount)) / (totalBuyAmount))
                : (((ONE * totalBuyAmount) - (ONE * expectedPayout)) / (totalBuyAmount));
            buyAmountPerMarket = _applySkewImpactBatch(buyAmountPerMarket, skewImpact, (expectedPayout > totalBuyAmount));
            totalBuyAmount = applySkewImpact(totalBuyAmount, skewImpact, (expectedPayout > totalBuyAmount));
            _calculateRisk(_sportMarkets, (totalBuyAmount - sUSDAfterFees), sportsAmm.parlayAMM());
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
        uint totalAmount;
        newValues = new uint[](_values.length);
        for (uint i = 0; i < _values.length; i++) {
            newValues[i] = applySkewImpact(_values[i], _skewImpact, _addition);
            totalAmount += newValues[i];
        }
    }

    function obtainSportsAMMPosition(uint _position) public pure returns (ISportsAMM.Position position) {
        if (_position == 0) {
            position = ISportsAMM.Position.Home;
        } else {
            position = _position == 1 ? ISportsAMM.Position.Away : ISportsAMM.Position.Draw;
        }
    }

    function _checkRisk(
        address[] memory _sportMarkets,
        uint _sUSDInRisk,
        address _parlayAMM
    ) internal view returns (bool riskFree) {
        if (_sportMarkets.length > 1 && _sportMarkets.length < 9) {
            address first = _sportMarkets[0];
            address second = _sportMarkets[1];
            address third = _sportMarkets.length > 2 ? _sportMarkets[2] : address(0);
            address fourth = _sportMarkets.length > 3 ? _sportMarkets[3] : address(0);
            address fifth = _sportMarkets.length > 4 ? _sportMarkets[4] : address(0);
            address sixth = _sportMarkets.length > 5 ? _sportMarkets[5] : address(0);
            address seventh = _sportMarkets.length > 6 ? _sportMarkets[6] : address(0);
            address eight = _sportMarkets.length > 7 ? _sportMarkets[7] : address(0);
            uint riskCombination = IParlayMarketsAMM(_parlayAMM).riskPerGameCombination(
                first,
                second,
                third,
                fourth,
                fifth,
                sixth,
                seventh,
                eight
            );
            riskFree = (riskCombination + _sUSDInRisk) <= IParlayMarketsAMM(_parlayAMM).maxAllowedRiskPerCombination();
        }
    }

    function _verifyMarket(
        address[] memory _sportMarkets,
        uint _index,
        ISportsAMM _sportsAMM
    ) internal view returns (bool) {
        ITherundownConsumer consumer = ITherundownConsumer(_sportsAMM.theRundownConsumer());
        bytes32 game1IdHome;
        bytes32 game1IdAway;
        bytes32 game2IdHome;
        bytes32 game2IdAway;
        for (uint j = 0; j < _index; j++) {
            if (_sportMarkets[_index] == _sportMarkets[j]) {
                return false;
            }
            game1IdHome = keccak256(
                abi.encodePacked(consumer.getGameCreatedById(consumer.gameIdPerMarket(_sportMarkets[_index])).homeTeam)
            );
            game1IdAway = keccak256(
                abi.encodePacked(consumer.getGameCreatedById(consumer.gameIdPerMarket(_sportMarkets[_index])).awayTeam)
            );
            game2IdHome = keccak256(
                abi.encodePacked(consumer.getGameCreatedById(consumer.gameIdPerMarket(_sportMarkets[j])).homeTeam)
            );
            game2IdAway = keccak256(
                abi.encodePacked(consumer.getGameCreatedById(consumer.gameIdPerMarket(_sportMarkets[j])).awayTeam)
            );
            if (
                game1IdHome == game2IdHome ||
                game1IdHome == game2IdAway ||
                game1IdAway == game2IdHome ||
                game1IdAway == game2IdAway
            ) {
                revert("SameTeamOnParlay");
            }
        }
        return true;
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
}

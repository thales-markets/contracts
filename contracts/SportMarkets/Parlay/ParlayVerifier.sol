// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// interfaces
import "./ParlayMarket.sol";
import "../../interfaces/ISportsAMM.sol";
import "../../interfaces/IParlayMarketData.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/ISportPositionalMarketManager.sol";
import "../../interfaces/IStakingThales.sol";
import "../../interfaces/IReferrals.sol";
import "../../interfaces/ICurveSUSD.sol";

// import "hardhat/console.sol";

contract ParlayVerifier {
    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant DEFAULT_PARLAY_SIZE = 4;
    uint private constant MAX_APPROVAL = type(uint256).max;

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
            uint totalResultQuote,
            uint sumQuotes,
            uint inverseSum,
            uint[] memory marketQuotes,
            uint[] memory inverseQuotes,
            uint totalAmount
        )
    {
        uint numOfMarkets = _sportMarkets.length;
        if (_totalSUSDToPay < ONE) {
            _totalSUSDToPay = ONE;
        }
        if (numOfMarkets == _positions.length && numOfMarkets > 0 && numOfMarkets <= _parlaySize) {
            marketQuotes = new uint[](numOfMarkets);
            inverseQuotes = new uint[](numOfMarkets);
            uint[] memory marketOdds;
            for (uint i = 0; i < numOfMarkets; i++) {
                if (_positions[i] > 2) {
                    totalResultQuote = 0;
                    break;
                }
                marketOdds = _sportsAMM.getMarketDefaultOdds(_sportMarkets[i], false);
                if (marketOdds.length == 0) {
                    totalResultQuote = 0;
                    break;
                }
                marketQuotes[i] = marketOdds[_positions[i]];
                totalResultQuote = totalResultQuote == 0 ? marketQuotes[i] : (totalResultQuote * marketQuotes[i]) / ONE;
                inverseQuotes[i] = ONE - marketQuotes[i];
                inverseSum = inverseSum + inverseQuotes[i];
                sumQuotes = sumQuotes + marketQuotes[i];
                if (totalResultQuote == 0) {
                    totalResultQuote = 0;
                    break;
                }
                // two markets can't be equal:
                for (uint j = 0; j < i; j++) {
                    if (!_verifyMarket(_sportMarkets, i)) {
                        totalResultQuote = 0;
                        break;
                    }
                }
            }
            totalAmount = totalResultQuote > 0 ? ((_totalSUSDToPay * ONE * ONE) / totalResultQuote) / ONE : 0;
        }
    }

    function calculateBuyQuoteAmounts(
        uint _totalQuote,
        uint _sumOfQuotes,
        uint _inverseSum,
        uint _sUSDPaid,
        uint[] memory _marketQuotes
    ) external pure returns (uint totalAmount, uint[] memory buyQuoteAmounts) {
        buyQuoteAmounts = new uint[](_marketQuotes.length);
        for (uint i = 0; i < _marketQuotes.length; i++) {
            buyQuoteAmounts[i] =
                ((ONE * _marketQuotes[i] * _sUSDPaid * _sumOfQuotes)) /
                (_totalQuote * _inverseSum * _sumOfQuotes);
            totalAmount += buyQuoteAmounts[i];
        }
    }

    function calculateFinalQuotes(
        address[] memory _sportMarkets,
        uint[] memory _positions,
        uint[] memory _buyQuoteAmounts,
        ISportsAMM sportsAmm
    )
        external
        view
        returns (
            uint totalQuote,
            uint totalBuyAmount,
            uint[] memory finalQuotes,
            uint[] memory buyAmountPerMarket
        )
    {
        buyAmountPerMarket = new uint[](_sportMarkets.length);
        finalQuotes = new uint[](_sportMarkets.length);
        for (uint i = 0; i < _sportMarkets.length; i++) {
            totalBuyAmount += _buyQuoteAmounts[i];
            // buyQuote always calculated with added SportsAMM fees
            buyAmountPerMarket[i] = sportsAmm.buyFromAmmQuote(
                _sportMarkets[i],
                obtainSportsAMMPosition(_positions[i]),
                _buyQuoteAmounts[i]
            );
            if (buyAmountPerMarket[i] == 0) {
                totalQuote = 0;
                totalBuyAmount = 0;
                break;
            }
        }
        for (uint i = 0; i < _sportMarkets.length; i++) {
            finalQuotes[i] = ((buyAmountPerMarket[i] * ONE * ONE) / _buyQuoteAmounts[i]) / ONE;
            totalQuote = totalQuote == 0 ? finalQuotes[i] : (totalQuote * finalQuotes[i]) / ONE;
        }
    }

    function applySkewImpact(
        uint _value,
        uint _skewImpact,
        bool _addition
    ) public pure returns (uint newValue) {
        newValue = _addition ? (((ONE + _skewImpact) * _value) / ONE) : (((ONE - _skewImpact) * _value) / ONE);
    }

    function applySkewImpactBatch(
        uint[] memory _values,
        uint _skewImpact,
        bool _addition
    ) external pure returns (uint[] memory newValues) {
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

    function _verifyMarket(address[] memory _sportMarkets, uint _index) internal pure returns (bool) {
        for (uint j = 0; j < _index; j++) {
            if (_sportMarkets[_index] == _sportMarkets[j]) {
                return false;
            }
        }
        return true;
    }
}

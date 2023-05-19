// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@prb/math/contracts/PRBMathUD60x18.sol";

import "../interfaces/IThalesAMM.sol";
import "../interfaces/IPositionalMarket.sol";

/// @title An AMM using BlackScholes odds algorithm to provide liqudidity for traders of UP or DOWN positions
contract ThalesAMMUtils {
    using PRBMathUD60x18 for uint256;

    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;

    struct PriceImpactParams {
        uint amount;
        uint balanceOtherSide;
        uint balancePosition;
        uint balanceOtherSideAfter;
        uint balancePositionAfter;
        uint availableToBuyFromAMM;
        uint max_spread;
    }

    struct DiscountParams {
        uint balancePosition;
        uint balanceOtherSide;
        uint amount;
        uint availableToBuyFromAMM;
        uint max_spread;
    }

    // IThalesAMM public thalesAMM;

    // constructor(address _thalesAMM) {
    //     thalesAMM = IThalesAMM(_thalesAMM);
    // }

    /// @notice get the algorithmic odds of market being in the money, taken from JS code https://gist.github.com/aasmith/524788/208694a9c74bb7dfcb3295d7b5fa1ecd1d662311
    /// @param _price current price of the asset
    /// @param strike price of the asset
    /// @param timeLeftInDays when does the market mature
    /// @param volatility implied yearly volatility of the asset
    /// @return result odds of market being in the money
    function calculateOdds(
        uint _price,
        uint strike,
        uint timeLeftInDays,
        uint volatility
    ) public view returns (uint result) {
        uint vt = ((volatility / (100)) * (sqrt(timeLeftInDays / (365)))) / (1e9);
        bool direction = strike >= _price;
        uint lnBase = strike >= _price ? (strike * (ONE)) / (_price) : (_price * (ONE)) / (strike);
        uint d1 = (PRBMathUD60x18.ln(lnBase) * (ONE)) / (vt);
        uint y = (ONE * (ONE)) / (ONE + ((d1 * (2316419)) / (1e7)));
        uint d2 = (d1 * (d1)) / (2) / (ONE);
        if (d2 < 130 * ONE) {
            uint z = (_expneg(d2) * (3989423)) / (1e7);

            uint y5 = (powerInt(y, 5) * (1330274)) / (1e6);
            uint y4 = (powerInt(y, 4) * (1821256)) / (1e6);
            uint y3 = (powerInt(y, 3) * (1781478)) / (1e6);
            uint y2 = (powerInt(y, 2) * (356538)) / (1e6);
            uint y1 = (y * (3193815)) / (1e7);
            uint x1 = y5 + (y3) + (y1) - (y4) - (y2);
            uint x = ONE - ((z * (x1)) / (ONE));
            result = ONE * (1e2) - (x * (1e2));
            if (direction) {
                return result;
            } else {
                return ONE * (1e2) - result;
            }
        } else {
            result = direction ? 0 : ONE * 1e2;
        }
    }

    function _expneg(uint x) internal view returns (uint result) {
        result = (ONE * ONE) / _expNegPow(x);
    }

    function _expNegPow(uint x) internal view returns (uint result) {
        uint e = 2718280000000000000;
        result = PRBMathUD60x18.pow(e, x);
    }

    function powerInt(uint A, int8 B) internal pure returns (uint result) {
        result = ONE;
        for (int8 i = 0; i < B; i++) {
            result = (result * (A)) / (ONE);
        }
    }

    function sqrt(uint y) internal pure returns (uint z) {
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

    function calculateDiscount(DiscountParams memory params) public view returns (int) {
        uint currentBuyImpactOtherSide = buyPriceImpactImbalancedSkew(
            PriceImpactParams(
                params.amount,
                params.balancePosition,
                params.balanceOtherSide,
                params.balanceOtherSide > ONE
                    ? params.balancePosition
                    : params.balancePosition + (ONE - params.balanceOtherSide),
                params.balanceOtherSide > ONE ? params.balanceOtherSide - ONE : 0,
                params.availableToBuyFromAMM,
                params.max_spread
            )
        );

        uint startDiscount = currentBuyImpactOtherSide;
        uint tempMultiplier = params.balancePosition - params.amount;
        uint finalDiscount = ((startDiscount / 2) * ((tempMultiplier * ONE) / params.balancePosition + ONE)) / ONE;

        return -int(finalDiscount);
    }

    function buyPriceImpactImbalancedSkew(PriceImpactParams memory params) public view returns (uint) {
        uint maxPossibleSkew = params.balanceOtherSide + params.availableToBuyFromAMM - params.balancePosition;
        uint skew = params.balanceOtherSideAfter - (params.balancePositionAfter);
        uint newImpact = (params.max_spread * ((skew * ONE) / (maxPossibleSkew))) / ONE;
        if (params.balancePosition > 0 && params.amount > params.balancePosition) {
            uint newPriceForMintedOnes = newImpact / (2);
            uint tempMultiplier = (params.amount - params.balancePosition) * (newPriceForMintedOnes);
            return (tempMultiplier * ONE) / (params.amount) / ONE;
        } else {
            uint previousSkew = params.balanceOtherSide;
            uint previousImpact = (params.max_spread * ((previousSkew * ONE) / (maxPossibleSkew))) / ONE;
            return (newImpact + previousImpact) / (2);
        }
    }

    function sellPriceImpactImbalancedSkew(
        uint amount,
        uint balanceOtherSide,
        uint _balancePosition,
        uint balanceOtherSideAfter,
        uint balancePositionAfter,
        uint available,
        uint max_spread
    ) public view returns (uint _sellImpactReturned) {
        uint maxPossibleSkew = _balancePosition + (available) - (balanceOtherSide);
        uint skew = balancePositionAfter - (balanceOtherSideAfter);
        uint newImpact = (max_spread * ((skew * ONE) / (maxPossibleSkew))) / ONE;

        if (balanceOtherSide > 0 && amount > _balancePosition) {
            uint newPriceForMintedOnes = newImpact / (2);
            uint tempMultiplier = (amount - _balancePosition) * (newPriceForMintedOnes);
            _sellImpactReturned = tempMultiplier / (amount);
        } else {
            uint previousSkew = _balancePosition;
            uint previousImpact = (max_spread * ((previousSkew * ONE) / (maxPossibleSkew))) / ONE;
            _sellImpactReturned = (newImpact + previousImpact) / (2);
        }
    }

    function balanceOfPositionOnMarket(
        address market,
        IThalesAMM.Position position,
        address addressToCheck
    ) public view returns (uint balance) {
        (IPosition up, IPosition down) = IPositionalMarket(market).getOptions();
        balance = position == IThalesAMM.Position.Up ? up.getBalanceOf(addressToCheck) : down.getBalanceOf(addressToCheck);
    }

    function balanceOfPositionsOnMarket(
        address market,
        IThalesAMM.Position position,
        address addressToCheck
    ) public view returns (uint balance, uint balanceOtherSide) {
        (IPosition up, IPosition down) = IPositionalMarket(market).getOptions();
        balance = position == IThalesAMM.Position.Up ? up.getBalanceOf(addressToCheck) : down.getBalanceOf(addressToCheck);
        balanceOtherSide = position == IThalesAMM.Position.Up
            ? down.getBalanceOf(addressToCheck)
            : up.getBalanceOf(addressToCheck);
    }

    function getBalanceOfPositionsOnMarket(address market, address addressToCheck)
        public
        view
        returns (uint upBalance, uint downBalance)
    {
        (IPosition up, IPosition down) = IPositionalMarket(market).getOptions();
        upBalance = up.getBalanceOf(addressToCheck);
        downBalance = down.getBalanceOf(addressToCheck);
    }
}

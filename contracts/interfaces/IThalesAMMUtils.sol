// SPDX-License-Identifier: MIT
pragma solidity >=0.5.16;

import "../interfaces/IThalesAMM.sol";

interface IThalesAMMUtils {
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

    function calculateOdds(
        uint _price,
        uint strike,
        uint timeLeftInDays,
        uint volatility
    ) external view returns (uint);

    function calculateDiscount(DiscountParams memory params) external view returns (int);

    function buyPriceImpactImbalancedSkew(PriceImpactParams memory params) external view returns (uint);

    function sellPriceImpactImbalancedSkew(
        uint amount,
        uint balanceOtherSide,
        uint _balancePosition,
        uint balanceOtherSideAfter,
        uint balancePositionAfter,
        uint available,
        uint max_spread
    ) external view returns (uint _sellImpactReturned);

    function balanceOfPositionOnMarket(
        address market,
        IThalesAMM.Position position,
        address addressToCheck
    ) external view returns (uint balance);

    function balanceOfPositionsOnMarket(
        address market,
        IThalesAMM.Position position,
        address addressToCheck
    ) external view returns (uint balance, uint balanceOtherSide);

    function getBalanceOfPositionsOnMarket(address market, address addressToCheck)
        external
        view
        returns (uint upBalance, uint downBalance);
}

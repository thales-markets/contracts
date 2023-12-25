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

    struct BuyUtilsPriceImpactParams {
        address market;
        IThalesAMM.Position position;
        uint amount;
        uint _availableToBuyFromAMM;
        uint _availableToBuyFromAMMOtherSide;
        address roundPool;
        uint basePrice;
        uint max_spread;
        uint impliedVolPerAsset;
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

    function sellPriceImpact(
        address market,
        IThalesAMM.Position position,
        uint amount,
        uint available,
        address liquidityPoolAddress,
        uint max_spread
    ) external view returns (uint _sellImpact);

    function price(
        address market,
        IThalesAMM.Position position,
        uint impliedVolPerAsset
    ) external view returns (uint priceToReturn);

    function availableToSellToAMM(
        address market,
        IThalesAMM.Position position,
        uint basePrice,
        address liquidityPoolAddress,
        uint capOnMarket,
        uint spentOnMarket,
        uint sellMaxPrice
    ) external view returns (uint _available);

    function availableToBuyFromAMMWithBasePrice(
        address market,
        IThalesAMM.Position position,
        uint basePrice,
        address liquidityPoolAddress,
        uint capOnMarket,
        uint spentOnMarket,
        uint max_spread,
        uint min_spread
    ) external view returns (uint availableAmount);

    function buyPriceImpact(BuyUtilsPriceImpactParams memory params) external view returns (int priceImpact);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IParlayPolicy {
    struct SGPData {
        uint tag1;
        uint tag2_1;
        uint tag2_2;
        uint position1;
        uint position2;
    }

    /* ========== VIEWS / VARIABLES ========== */
    function consumer() external view returns (address);

    function getSgpFeePerCombination(SGPData memory params) external view returns (uint sgpFee);

    function getMarketDefaultOdds(address _sportMarket, uint _position) external view returns (uint odd);

    function areEligiblePropsMarkets(
        address _childMarket1,
        address _childMarket2,
        uint _tag1
    ) external view returns (bool samePlayerDifferentProp);

    function getChildMarketTotalLine(address _sportMarket) external view returns (uint childTotalsLine);
}

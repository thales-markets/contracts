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

    function restrictedMarketsCount(uint tag) external view returns (uint);

    function isRestrictedToBeCombined(uint tag) external view returns (bool);

    function restrictedTagCombination(uint tag1, uint tag2) external view returns (bool);

    function isTags1ComboRestricted(uint tag1, uint tag2) external view returns (bool isRestricted);

    function isRestrictedComboEligible(
        uint tag1,
        uint tag2,
        uint tag1Count,
        uint tag2Count
    ) external view returns (bool eligible);

    function getSgpFeePerCombination(SGPData memory params) external view returns (uint sgpFee);

    function getMarketDefaultOdds(address _sportMarket, uint _position) external view returns (uint odd);
}

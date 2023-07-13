// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IParlayPolicy {
    /* ========== VIEWS / VARIABLES ========== */
    function restrictedMarketsCount(uint tag) external view returns (uint);

    function isRestrictedToBeCombined(uint tag) external view returns (bool);

    function restrictedTagCombination(uint tag1, uint tag2) external view returns (bool);
}

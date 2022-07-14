// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISportsAMM {
    /* ========== VIEWS / VARIABLES ========== */

    function getMarketDefaultOdds(address _market, bool isSell) external view returns (uint[] memory);
}

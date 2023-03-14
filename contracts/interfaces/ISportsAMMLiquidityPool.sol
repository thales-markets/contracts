// SPDX-License-Identifier: MIT
pragma solidity >=0.5.16;

interface ISportsAMMLiquidityPool {
    /* ========== VIEWS / VARIABLES ========== */

    function isUserLPing(address user) external view returns (bool isUserInLP);
}

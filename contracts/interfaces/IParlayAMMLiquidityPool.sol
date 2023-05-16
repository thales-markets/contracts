// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IParlayAMMLiquidityPool {
    function commitTrade(address market, uint amountToMint) external;
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IVault {
    function balancesPerRound(uint _round, address user) external view returns (uint);

    function round() external view returns (uint);
}

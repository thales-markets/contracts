// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

interface IThalesStakingRewardsPool {
    function addToEscrow(address account, uint amount) external;
}

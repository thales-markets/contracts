// SPDX-License-Identifier: MIT

pragma solidity >=0.5.16;

interface IStakingThalesBettingProxy {
    function numOfActiveTicketsPerUser(address _user) external view returns (uint);
}

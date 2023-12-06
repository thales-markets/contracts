// SPDX-License-Identifier: MIT

pragma solidity >=0.5.16;

interface ICCIPCollector {
    function sendOnClosePeriod(
        uint _totalStakedLastPeriodEnd,
        uint _totalEscrowedLastPeriodEnd,
        uint _totalBonusPointsInRound,
        uint _revShare
    ) external;

    function pullExtraFunds(uint _amount) external;

    function decimals() external view returns (uint);
}

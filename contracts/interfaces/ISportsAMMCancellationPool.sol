// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ISportsAMMCancellationPool {
    function cancellationPayout(
        address market,
        uint position,
        uint payout
    ) external view returns (uint);

    function newCancellationActive() external view returns (bool);

    function updateCancellationMultiplier(
        address _market,
        uint8 position,
        uint _paidAmount,
        uint _amount
    ) external;

    function sendFunds(
        address _account,
        uint _cancellationPayout,
        address _sUSD
    ) external;
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ISportsAMMCancellationPool {
    function cancellationPayout(address account, uint cancellationPayout) external;
}

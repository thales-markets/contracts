// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// Inheritance
import "./PositionalMarket.sol";

contract PositionalMarketMastercopy is PositionalMarket {
    constructor() OwnedWithInit() {
        // Freeze mastercopy on deployment so it can never be initialized with real arguments
        initialized = true;
    }
}

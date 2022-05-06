// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "./SportPositionalMarket.sol";

contract SportPositionalMarketMastercopy is SportPositionalMarket {
    constructor() OwnedWithInit() {
        // Freeze mastercopy on deployment so it can never be initialized with real arguments
        initialized = true;
    }
}

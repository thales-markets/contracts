// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "./RangedMarket.sol";

contract RangedMarketMastercopy is RangedMarket {
    constructor() {
        // Freeze mastercopy on deployment so it can never be initialized with real arguments
        initialized = true;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "./SpeedRoyaleMarket.sol";

contract SpeedRoyaleMarketMastercopy is SpeedRoyaleMarket {
    constructor() {
        // Freeze mastercopy on deployment so it can never be initialized with real arguments
        initialized = true;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "./OutPosition.sol";

contract OutPositionMastercopy is OutPosition {
    constructor() {
        // Freeze mastercopy on deployment so it can never be initialized with real arguments
        initialized = true;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Internal references
import "./ParlayAMMLiquidityPoolRound.sol";

contract ParlayAMMLiquidityPoolRoundMastercopy is ParlayAMMLiquidityPoolRound {
    constructor() {
        // Freeze mastercopy on deployment so it can never be initialized with real arguments
        initialized = true;
    }
}

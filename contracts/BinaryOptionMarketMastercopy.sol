pragma solidity ^0.5.16;

// Inheritance
import "./BinaryOptionMarket.sol";

contract BinaryOptionMarketMastercopy is BinaryOptionMarket {
    constructor() public MinimalProxyFactory() OwnedWithInit() {
        // Freeze mastercopy on deployment so it can never be initialized with real arguments
        initialized = true;
    }
}

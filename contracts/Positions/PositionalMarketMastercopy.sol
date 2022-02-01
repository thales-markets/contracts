pragma solidity >=0.5.16 <0.8.4;
pragma experimental ABIEncoderV2;

// Inheritance
import "./PositionalMarket.sol";

contract PositionalMarketMastercopy is PositionalMarket {
    constructor() public OwnedWithInit() {
        // Freeze mastercopy on deployment so it can never be initialized with real arguments
        initialized = true;
    }
}

pragma solidity >=0.5.16 <0.8.4;

// Internal references
import "./BinaryOption.sol";

contract BinaryOptionMastercopy is BinaryOption {
    constructor() public {
        // Freeze mastercopy on deployment so it can never be initialized with real arguments
        initialized = true;
    }
}

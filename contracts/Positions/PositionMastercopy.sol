pragma solidity >=0.5.16 <0.8.4;

// Internal references
import "./Position.sol";

contract PositionMastercopy is Position {
    constructor() public {
        // Freeze mastercopy on deployment so it can never be initialized with real arguments
        initialized = true;
    }
}

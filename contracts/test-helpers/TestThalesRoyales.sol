pragma solidity ^0.5.16;

import "../interfaces/IThalesRoyale.sol";

contract TestThalesRoyale is IThalesRoyale {

    bool public participatedInLastRoyale;
    constructor() public {}
    /* ========== VIEWS / VARIABLES ========== */

    function hasParticipatedInCurrentOrLastRoyale(address player) external view returns (bool){
        return participatedInLastRoyale;
    }

    function setParticipatedInLastRoyale(bool _participated) external {
        participatedInLastRoyale = _participated;
    }
   
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IThalesRoyale.sol";

contract TestThalesRoyale is IThalesRoyale {

    bool public participatedInLastRoyale;
    constructor() {}
    /* ========== VIEWS / VARIABLES ========== */

    function hasParticipatedInCurrentOrLastRoyale(address player) external view override returns (bool){
        return participatedInLastRoyale;
    }

    function setParticipatedInLastRoyale(bool _participated) external {
        participatedInLastRoyale = _participated;
    }
   
}

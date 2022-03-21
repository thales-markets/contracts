// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IThalesRoyale.sol";

abstract contract TestThalesRoyale is IThalesRoyale {

    bool public participatedInLastRoyale;
    uint public buyInAmount;
    uint public override season;

    mapping(uint => uint) public override roundInASeason;
    mapping(uint => mapping(address => mapping(uint256 => uint256))) public override positionInARoundPerSeason;
    mapping(uint => mapping(uint => uint)) public override roundResultPerSeason;
    mapping(uint => mapping(address => uint256)) public playerSignedUpPerSeason;

    constructor() {}
    /* ========== VIEWS / VARIABLES ========== */

    function hasParticipatedInCurrentOrLastRoyale(address player) external view override returns (bool){
        return participatedInLastRoyale;
    }

    function setParticipatedInLastRoyale(bool _participated) external {
        participatedInLastRoyale = _participated;
    }

    function getBuyInAmount() external view override returns (uint){
        return buyInAmount;
    }

    function setBuyInAmount(uint _buyIn) external {
        buyInAmount = _buyIn;
    }

    function isPlayerAliveInASpecificSeason(address player, uint _season) external view override returns (bool) {
        if (roundInASeason[_season] > 1) {
            return (positionInARoundPerSeason[_season][player][roundInASeason[_season] - 1] ==
                roundResultPerSeason[_season][roundInASeason[_season] - 1]);
        } else {
            return playerSignedUpPerSeason[_season][player] != 0;
        }
    }
   
}

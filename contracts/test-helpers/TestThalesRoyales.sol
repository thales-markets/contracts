// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IThalesRoyale.sol";

contract TestThalesRoyale is IThalesRoyale { 

    bool public participatedInLastRoyale;
    uint public buyInAmount;
    uint public override season;

    mapping(uint => uint) public override roundInASeason;
    mapping(uint => uint) public override tokenSeason;
    mapping(uint => bool) public override seasonFinished;
    mapping(uint => mapping(uint => uint)) public override roundResultPerSeason;
    mapping(uint => mapping(address => uint256)) public playerSignedUpPerSeason;
    mapping(uint => mapping(uint => uint256)) public tokensMintedPerSeason;
    mapping(uint => mapping(uint => uint)) public totalTokensPerRoundPerSeason;
    mapping(uint => mapping(uint256 => uint256)) public tokenPositionInARoundPerSeason;
    mapping(uint => IPassportPosition.Position[]) public tokenPositions;

    constructor() {}
    /* ========== VIEWS / VARIABLES ========== */

    function hasParticipatedInCurrentOrLastRoyale(address player) external view override returns (bool){
        // to silence compiler warning
        player = player;
        return participatedInLastRoyale;
    }

    function isTokenAliveInASpecificSeason(uint tokenId, uint _season) external view override returns (bool) {
        if (roundInASeason[_season] > 1) {
            return (tokenPositionInARoundPerSeason[tokenId][roundInASeason[_season] - 1] ==
                roundResultPerSeason[_season][roundInASeason[_season] - 1]);
        } else {
            return tokensMintedPerSeason[_season][tokenId] != 0;
        }
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

    function getTokenPositions(uint tokenId) public override view returns (IPassportPosition.Position[] memory) {
        return tokenPositions[tokenId];
    }
   
}

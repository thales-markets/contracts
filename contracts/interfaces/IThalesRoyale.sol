// SPDX-License-Identifier: MIT
pragma solidity >=0.5.16;

interface IThalesRoyale {
    /* ========== VIEWS / VARIABLES ========== */
    function getBuyInAmount() external view returns (uint);
    function season() external view returns (uint);
    function tokenSeason(uint tokenId) external view returns (uint);
    function roundInASeason(uint _round) external view returns (uint);
    function roundResultPerSeason(uint _season, uint round) external view returns (uint);
    function positionInARoundPerSeason(uint _season, address player, uint round) external view returns (uint);
    function getLastRoundAliveInASpecificSeason(address player, uint _season) external view returns (uint);
    function isPlayerAlive(address player) external view returns (bool);
    function isPlayerAliveInASpecificSeason(address player, uint _season) external view returns (bool);
    function isTokenAliveInASpecificSeason(uint tokenId, uint _season) external view returns (bool);
    function hasParticipatedInCurrentOrLastRoyale(address _player) external view returns (bool);
    function transferPassport(address from, address to, uint passportId, uint _season) external;
}

// SPDX-License-Identifier: MIT
pragma solidity >=0.5.16;

interface IThalesRoyale {
    /* ========== VIEWS / VARIABLES ========== */
    function getBuyInAmount() external view returns (uint);
    function season() external view returns (uint);
    function tokenSeason(uint tokenId) external view returns (uint);
    function roundInASeason(uint _round) external view returns (uint);
    function roundResultPerSeason(uint _season, uint round) external view returns (uint);
    function isTokenAliveInASpecificSeason(uint tokenId, uint _season) external view returns (bool);
    function hasParticipatedInCurrentOrLastRoyale(address _player) external view returns (bool);

    function getTokenPositions(uint tokenId) external view returns (uint[] memory);
}

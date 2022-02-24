// SPDX-License-Identifier: MIT
pragma solidity >=0.5.16;

interface IThalesRoyale {
    /* ========== VIEWS / VARIABLES ========== */
    function getBuyInAmount() external view returns (uint);
    function hasParticipatedInCurrentOrLastRoyale(address _player) external view returns (bool);
}

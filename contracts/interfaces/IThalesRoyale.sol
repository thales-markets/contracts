// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IThalesRoyale {
    /* ========== VIEWS / VARIABLES ========== */
    function hasParticipatedInCurrentOrLastRoyale(address _player) external view returns (bool);
}

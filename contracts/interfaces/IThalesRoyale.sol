// SPDX-License-Identifier: MIT
pragma solidity >=0.5.16;

interface IThalesRoyale {
    /* ========== VIEWS / VARIABLES ========== */
    function hasParticipatedInCurrentOrLastRoyale(address _player) external view returns (bool);
}

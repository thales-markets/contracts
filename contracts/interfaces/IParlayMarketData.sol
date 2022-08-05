// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IParlayMarketData {
    /* ========== VIEWS / VARIABLES ========== */
    function addTicketForGamePosition(address _game, uint _position, address _ticket) external;

}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IExoticRewards {
    /* ========== VIEWS / VARIABLES ========== */
    function sendRewardToDisputoraddress(
        address _market,
        address _disputorAddress,
        uint _amount
    ) external;
}
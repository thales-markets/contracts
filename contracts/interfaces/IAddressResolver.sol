// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

interface IAddressResolver {
    /* ========== VIEWS / VARIABLES ========== */
    function getAddress(bytes32 name) external view returns (address);
}

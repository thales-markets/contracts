// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

interface IAddressResolver {
    /* ========== VIEWS / VARIABLES ========== */
    function getAddress(bytes32 _contractName) external view returns (address contract_);

    function checkIfContractExists(bytes32 _contractName) external view returns (bool contractExists);

    function getAddresses(bytes32[] calldata _contractNames) external view returns (address[] memory contracts);
}

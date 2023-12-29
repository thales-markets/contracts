// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

// pragma experimental ABIEncoderV2;

interface IAddressResolver {
    /* ========== VIEWS / VARIABLES ========== */
    // function getAddress(bytes32 _contractName) external view returns (address contract_);

    // function getAddresses(string[] calldata _contractNames) external view returns (address[] memory contracts);

    function getAddress(string calldata _contractName) external view returns (address contract_);

    function checkIfContractExists(string calldata _contractName) external view returns (bool contractExists);
}

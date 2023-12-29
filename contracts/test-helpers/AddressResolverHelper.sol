// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

contract AddressResolverHelper {
    address public snxAddress;

    constructor() public {}

    /* ========== VIEWS / VARIABLES ========== */
    function getAddress(bytes32 name) external view returns (address) {
        // to silence compiler warning
        name = name;
        return snxAddress;
    }

    function checkIfContractExists(string calldata _contractName) external view returns (bool contractExists) {
        contractExists = false;
    }

    function setSNXRewardsAddress(address _snxAddress) external {
        snxAddress = _snxAddress;
    }
}

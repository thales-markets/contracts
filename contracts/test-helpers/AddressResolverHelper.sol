// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import "../interfaces/IAddressResolver.sol";

contract AddressResolverHelper is IAddressResolver {

    address public snxAddress;

    constructor() public {}
    /* ========== VIEWS / VARIABLES ========== */
    function getAddress(bytes32 name) external view returns (address){
        // to silence compiler warning
        name = name;
        return snxAddress;
    }
    
    function setSNXRewardsAddress(address _snxAddress) external {
        snxAddress = _snxAddress;
    }
    
}

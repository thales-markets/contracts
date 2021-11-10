// SPDX-License-Identifier: MIT
pragma solidity >=0.6.10;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import { IL2StandardERC20 } from "@eth-optimism/contracts/libraries/standards/IL2StandardERC20.sol";

contract OpThales is ERC20 {

    uint private INITIAL_TOTAL_SUPPLY = 100000000;
    
    constructor () public ERC20("Opt Thales L1", "OPTHALES_L1") {
        _mint(msg.sender, INITIAL_TOTAL_SUPPLY * 1e18);
    }
    
}

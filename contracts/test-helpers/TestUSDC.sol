// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/ERC20.sol";

contract TestUSDC is ERC20 {
    string public name = "TestUSDC";
    string public symbol = "USDC";
    uint8 public constant decimals = 6;

    uint private INITIAL_TOTAL_SUPPLY = 100000000;

    constructor() public {
    }

    function mint(address receiver, uint value) external {
        _mint(receiver, value);
    }
}

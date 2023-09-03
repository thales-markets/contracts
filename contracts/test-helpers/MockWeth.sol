// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/ERC20.sol";

contract MockWeth is ERC20 {
    string public name = "MockWeth";
    string public symbol = "WETH";
    uint8 public constant decimals = 18;

    uint private INITIAL_TOTAL_SUPPLY = 100 * 1e18;

    constructor() public {}

    function mint(address receiver, uint value) external {
        _mint(receiver, value);
    }

    function deposit() public payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint wad) public {
        msg.sender.transfer(wad);
    }
}

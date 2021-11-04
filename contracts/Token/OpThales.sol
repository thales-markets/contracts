pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/ERC20.sol";

contract OpThales is ERC20 {

    string public name = "Optimistic Thales Token";
    string public symbol = "OPTHALES";
    uint8 public constant decimals = 18;

    uint private INITIAL_TOTAL_SUPPLY = 100000000;

    constructor() public {
        _mint(msg.sender, INITIAL_TOTAL_SUPPLY * 1e18);
    }

}

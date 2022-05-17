pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/ERC20.sol";

contract MockSafeThales is ERC20 {
    using SafeERC20 for ERC20;

    string public name = "Thales Token";
    string public symbol = "THALES";
    uint8 public constant decimals = 18;

    uint private INITIAL_TOTAL_SUPPLY = 100000000;

    constructor() public {
        _mint(msg.sender, INITIAL_TOTAL_SUPPLY * 1e18);
    }

}
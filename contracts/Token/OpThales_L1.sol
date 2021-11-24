// SPDX-License-Identifier: MIT
pragma solidity >=0.6.10;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {iOVM_L1StandardBridge} from "@eth-optimism/contracts/iOVM/bridge/tokens/iOVM_L1StandardBridge.sol";

contract OpThales is ERC20, Ownable {
    string public name = "Optimistic Thales Token";
    string public symbol = "opTHALES";
    uint8 public constant decimals = 18;
    uint private INITIAL_TOTAL_SUPPLY = 100000000;

    event NameChanged(string name);
    event SymbolChanged(string symbol);

    function name() public view override returns (string memory) {
        return name;
    }

    function symbol() public view override returns (string memory) {
        return symbol;
    }

    function decimals() public view override returns (uint8) {
        return decimals;
    }

    constructor() public ERC20(name, symbol) {
        _mint(msg.sender, INITIAL_TOTAL_SUPPLY * 1e18);
    }

    function setName(string memory name_) external onlyOwner {
        name = name_;
        emit NameChanged(name_);
    }

    function setSymbol(string memory symbol_) external onlyOwner {
        symbol = symbol_;
        emit SymbolChanged(symbol_);
    }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.6.10;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ExoticUSD is ERC20, Ownable {
    string private __name = "Exotic USD Token";
    string private __symbol = "eUSD";
    uint8 private constant __decimals = 18;
    uint private constant INITIAL_TOTAL_SUPPLY = 100;

    bool public paused;
    uint public defaultAmount;

    function name() public view override returns (string memory) {
        return __name;
    }

    function symbol() public view override returns (string memory) {
        return __symbol;
    }

    function decimals() public view override returns (uint8) {
        return __decimals;
    }

    constructor() public ERC20(__name, __symbol) {
        _mint(msg.sender, INITIAL_TOTAL_SUPPLY * 1e18);
    }

    function mintForUser(address payable _account) external payable {
        require(!paused, "minting is paused");
        _mint(_account, defaultAmount);
        _account.transfer(msg.value);
    }

    function sendEthToUser(address payable _account) external onlyOwner {
        _account.transfer(640654e5);
    }

    receive() external payable {}

    fallback() external payable {}

    function setName(string memory name_) external onlyOwner {
        __name = name_;
        emit NameChanged(name_);
    }

    function setSymbol(string memory symbol_) external onlyOwner {
        __symbol = symbol_;
        emit SymbolChanged(symbol_);
    }

    function setDefaultAmount(uint _defaultAmount) external onlyOwner {
        require(defaultAmount != _defaultAmount && _defaultAmount > 0, "Value is zero or already set");
        defaultAmount = _defaultAmount;
        emit NewDefaultAmount(_defaultAmount);
    }

    function setPaused(bool _paused) external onlyOwner {
        require(paused != _paused, "Pause already set to that value");
        paused = _paused;
        emit PausedChanged(_paused);
    }
    
    event NewDefaultAmount(uint amount);
    event PausedChanged(bool paused);
    event NameChanged(string name);
    event SymbolChanged(string symbol);
}

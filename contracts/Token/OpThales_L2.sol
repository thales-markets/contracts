// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// import {IL2StandardERC20} from "@eth-optimism/contracts/libraries/standards/IL2StandardERC20.sol";

contract OpThales is ERC20, Ownable {
    string private __name;
    string private __symbol;
    uint8 private constant __decimals = 18;
    uint private constant INITIAL_TOTAL_SUPPLY = 100000000;

    function name() public view override returns (string memory) {
        return __name;
    }

    function symbol() public view override returns (string memory) {
        return __symbol;
    }

    function decimals() public pure override returns (uint8) {
        return __decimals;
    }

    address public l1Token;
    address public l2Bridge;

    /**
     * @param _l2Bridge Address of the L2 standard bridge.
     * @param _l1Token Address of the corresponding L1 token.
     * @param _name ERC20 name.
     * @param _symbol ERC20 symbol.
     */
    constructor(
        address _l2Bridge,
        address _l1Token,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {
        l1Token = _l1Token;
        l2Bridge = _l2Bridge;
        __name = _name;
        __symbol = _symbol;
    }

    function setName(string memory name_) external onlyOwner {
        __name = name_;
        emit NameChanged(name_);
    }

    function setSymbol(string memory symbol_) external onlyOwner {
        __symbol = symbol_;
        emit SymbolChanged(symbol_);
    }

    modifier onlyL2Bridge() {
        require(msg.sender == l2Bridge, "Only L2 Bridge can mint and burn");
        _;
    }

    function supportsInterface(bytes4 _interfaceId) public view virtual returns (bool) {
        bytes4 firstSupportedInterface = bytes4(keccak256("supportsInterface(bytes4)")); // ERC165
        bytes4 secondSupportedInterface = bytes4(keccak256("supportsInterface(bytes4)"));
        // IL2StandardERC20.l1Token.selector ^ IL2StandardERC20.mint.selector ^ IL2StandardERC20.burn.selector;
        return _interfaceId == firstSupportedInterface || _interfaceId == secondSupportedInterface;
    }

    function mint(address _to, uint256 _amount) public virtual onlyL2Bridge {
        _mint(_to, _amount);

        emit Transfer(address(0), _to, _amount);
    }

    function burn(address _from, uint256 _amount) public virtual onlyL2Bridge {
        _burn(_from, _amount);

        emit Transfer(_from, address(0), _amount);
    }

    event NameChanged(string name);
    event SymbolChanged(string symbol);
}

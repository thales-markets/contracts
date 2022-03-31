// in position collaterized by 0.5 UP on the left leg and 0.5 DOWN on the right leg

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "../interfaces/IPosition.sol";

// Internal references
import "./RangedMarket.sol";

contract InPosition is IERC20 {
    /* ========== STATE VARIABLES ========== */

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;

    RangedMarket public rangedMarket;

    mapping(address => uint) public override balanceOf;
    uint public override totalSupply;

    // The argument order is allowance[owner][spender]
    mapping(address => mapping(address => uint)) private allowances;

    // Enforce a 1 cent minimum amount
    uint internal constant _MINIMUM_AMOUNT = 1e16;

    address public thalesPositionalAMM;
    /* ========== CONSTRUCTOR ========== */

    bool public initialized = false;

    function initialize(
        address market,
        string calldata _name,
        string calldata _symbol,
        address _thalesPositionalAMM
    ) external {
        require(!initialized, "Ranged Market already initialized");
        initialized = true;
        rangedMarket = RangedMarket(market);
        name = _name;
        symbol = _symbol;
        // add through constructor
        thalesPositionalAMM = _thalesPositionalAMM;
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        if (spender == thalesPositionalAMM) {
            return 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
        } else {
            return allowances[owner][spender];
        }
    }

    function burn(address claimant, uint amount) {
        balanceOf[claimant] = balanceOf[claimant] - amount;
        totalSupply = totalSupply - amount;
    }

    function mint(address minter, uint amount) {
        totalSupply = totalSupply + amount;
        balanceOf[minter] = balanceOf[minter] + amount; // Increment rather than assigning since a transfer may have occurred.
    }
}

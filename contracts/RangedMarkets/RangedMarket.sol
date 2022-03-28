// in position collaterized by 0.5 UP on the left leg and 0.5 DOWN on the right leg

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "../interfaces/IPosition.sol";

// Libraries
import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";

// Internal references
import "./InPosition.sol";
import "./OutPosition.sol";
import "../interfaces/IPositionalMarket.sol";

contract RangedMarket {
    IPositionalMarket public leftMarket;
    IPositionalMarket public rightMarket;

    struct Positions {
        InPosition up;
        OutPosition down;
    }

    /* ========== CONSTRUCTOR ========== */

    bool public initialized = false;

    function initialize(IPositionalMarket _leftMarket, IPositionalMarket _rightMarket) external {
        require(!initialized, "Positional Market already initialized");
        initialized = true;
        leftMarket = _leftMarket;
        rightMarket = _rightMarket;
    }

}

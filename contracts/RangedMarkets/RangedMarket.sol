//// in position collaterized by 0.5 UP on the left leg and 0.5 DOWN on the right leg
//
//// SPDX-License-Identifier: MIT
//pragma solidity ^0.8.0;
//
//// Inheritance
//import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
//import "../interfaces/IPosition.sol";
//
//// Libraries
//import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
//

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

// Internal references
import "./InPosition.sol";
import "./OutPosition.sol";
import "./RangedMarketsAMM.sol";
import "../interfaces/IPositionalMarket.sol";

contract RangedMarket {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    enum Position {In, Out}

    IPositionalMarket public leftMarket;
    IPositionalMarket public rightMarket;

    struct Positions {
        InPosition inp;
        OutPosition outp;
    }

    Positions public positions;

    RangedMarketsAMM public rangedMarketsAMM;

    /* ========== CONSTRUCTOR ========== */

    bool public initialized = false;

    function initialize(
        address _leftMarket,
        address _rightMarket,
        address _in,
        address _out,
        address _rangedMarketsAMM
    ) external {
        require(!initialized, "Positional Market already initialized");
        initialized = true;
        leftMarket = IPositionalMarket(_leftMarket);
        rightMarket = IPositionalMarket(_rightMarket);
        positions.inp = InPosition(_in);
        positions.outp = OutPosition(_out);
        rangedMarketsAMM = RangedMarketsAMM(_rangedMarketsAMM);
    }

    function mint(
        uint value,
        Position _position,
        address minter
    ) external {
        if (value == 0) {
            return;
        }
        _mint(minter, value, _position);
    }

    function _mint(
        address minter,
        uint amount,
        Position _position
    ) internal {
        if (_position == Position.In) {
            positions.inp.mint(minter, amount);
        } else {
            positions.outp.mint(minter, amount);
        }
    }

    function burn(
        uint value,
        Position _position,
        address claimant
    ) external {
        if (value == 0) {
            return;
        }
        if (_position == Position.Out) {
            (IPosition up, IPosition down) = IPositionalMarket(leftMarket).getOptions();
            IERC20Upgradeable(address(down)).safeTransfer(msg.sender, value);

            (IPosition up, IPosition down) = IPositionalMarket(rightMarket).getOptions();
            IERC20Upgradeable(address(up)).safeTransfer(msg.sender, value);

            positions.outp.burn(claimant, value);
        } else {
            (IPosition up, IPosition down) = IPositionalMarket(leftMarket).getOptions();
            IERC20Upgradeable(address(up)).safeTransfer(msg.sender, value);

            (IPosition up, IPosition down) = IPositionalMarket(rightMarket).getOptions();
            IERC20Upgradeable(address(down)).safeTransfer(msg.sender, value);

            positions.inp.burn(claimant, value);
        }
    }
}

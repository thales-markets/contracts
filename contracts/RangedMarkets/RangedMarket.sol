// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";

// Internal references
import "./InPosition.sol";
import "./OutPosition.sol";
import "./RangedMarketsAMM.sol";
import "../interfaces/IPositionalMarket.sol";

contract RangedMarket {
    using SafeERC20 for IERC20;

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
    ) external onlyAMM {
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
    ) external onlyAMM {
        if (value == 0) {
            return;
        }
        if (_position == Position.Out) {
            (, IPosition down) = IPositionalMarket(leftMarket).getOptions();
            IERC20(address(down)).safeTransfer(msg.sender, value);

            (IPosition up1, ) = IPositionalMarket(rightMarket).getOptions();
            IERC20(address(up1)).safeTransfer(msg.sender, value);

            positions.outp.burn(claimant, value);
        } else {
            (IPosition up, ) = IPositionalMarket(leftMarket).getOptions();
            IERC20(address(up)).safeTransfer(msg.sender, value);

            (, IPosition down1) = IPositionalMarket(rightMarket).getOptions();
            IERC20(address(down1)).safeTransfer(msg.sender, value);

            positions.inp.burn(claimant, value);
        }
    }

    modifier onlyAMM {
        require(msg.sender == address(rangedMarketsAMM), "only the AMM may perform these methods");
        _;
    }
}

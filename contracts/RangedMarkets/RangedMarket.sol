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

    bool public resolved = false;

    function initialize(
        address _leftMarket,
        address _rightMarket,
        address _in,
        address _out,
        address _rangedMarketsAMM
    ) external {
        require(!initialized, "Ranged Market already initialized");
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

    function burnIn(uint value, address claimant) external onlyAMM {
        if (value == 0) {
            return;
        }
        (IPosition up, ) = IPositionalMarket(leftMarket).getOptions();
        IERC20(address(up)).safeTransfer(msg.sender, value / 2);

        (, IPosition down1) = IPositionalMarket(rightMarket).getOptions();
        IERC20(address(down1)).safeTransfer(msg.sender, value / 2);

        positions.inp.burn(claimant, value);
    }

    function burnOut(uint value, address claimant) external onlyAMM {
        if (value == 0) {
            return;
        }
        (, IPosition down) = IPositionalMarket(leftMarket).getOptions();
        IERC20(address(down)).safeTransfer(msg.sender, value);

        (IPosition up1, ) = IPositionalMarket(rightMarket).getOptions();
        IERC20(address(up1)).safeTransfer(msg.sender, value);

        positions.outp.burn(claimant, value);
    }

    function _burn(
        uint value,
        Position _position,
        address claimant
    ) private {
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
            IERC20(address(up)).safeTransfer(msg.sender, value / 2);

            (, IPosition down1) = IPositionalMarket(rightMarket).getOptions();
            IERC20(address(down1)).safeTransfer(msg.sender, value / 2);

            positions.inp.burn(claimant, value);
        }
    }

    function exercisePositions() external {
        // The markets must be resolved
        require(leftMarket.resolved() && rightMarket.resolved(), "Left or Right market not resolved yet!");

        uint inBalance = positions.inp.balanceOf(msg.sender);
        uint outBalance = positions.outp.balanceOf(msg.sender);

        require(inBalance != 0 || outBalance != 0, "Nothing to exercise");

        // Each option only needs to be exercised if the account holds any of it.
        if (inBalance != 0) {
            positions.inp.burn(msg.sender, inBalance);
        }
        if (outBalance != 0) {
            positions.outp.burn(msg.sender, outBalance);
        }

        if (!resolved) {
            leftMarket.exerciseOptions();
            rightMarket.exerciseOptions();
            resolved = true;
        }

        Position result = Position.Out;
        if ((leftMarket.result() == IPositionalMarket.Side.Up) && (rightMarket.result() == IPositionalMarket.Side.Down)) {
            result = Position.In;
        }

        // Only pay out the side that won.
        uint payout = (result == Position.In) ? inBalance : outBalance;
        if (payout != 0) {
            rangedMarketsAMM.sUSD().transfer(msg.sender, payout);
        }
    }

    function withdrawCollateral() external onlyAMM {
        rangedMarketsAMM.sUSD().transfer(msg.sender, rangedMarketsAMM.sUSD().balanceOf(address(this)));
    }

    modifier onlyAMM {
        require(msg.sender == address(rangedMarketsAMM), "only the AMM may perform these methods");
        _;
    }
}

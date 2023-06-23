// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "./SpeedRoyaleAMM.sol";

contract SpeedRoyaleMarket {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    enum Direction {
        Up,
        Down
    }

    address public user;
    bytes32 public asset;
    uint public strikeTime;
    uint public strikePrice;
    Direction public direction;
    uint public buyinAmount;

    bool public resolved;
    uint public finalPrice;
    Direction public result;

    SpeedRoyaleAMM public speedRoyaleAMM;

    /* ========== CONSTRUCTOR ========== */

    bool public initialized = false;

    function initialize(
        address _speedRoyaleAMM,
        address _user,
        bytes32 _asset,
        uint _strikeTime,
        uint _strikePrice,
        Direction _direction,
        uint _buyinAmount
    ) external {
        require(!initialized, "Speed royale market already initialized");
        speedRoyaleAMM = SpeedRoyaleAMM(_speedRoyaleAMM);
        user = _user;
        asset = _asset;
        strikeTime = _strikeTime;
        strikePrice = _strikePrice;
        direction = _direction;
        buyinAmount = _buyinAmount;
        speedRoyaleAMM.sUSD().approve(_speedRoyaleAMM, type(uint256).max);
    }

    function resolve(uint _finalPrice) external onlyAMM {
        require(!resolved, "already resolved");
        require(block.timestamp > strikeTime, "not ready to be resolved");
        resolved = true;
        finalPrice = _finalPrice;

        if (finalPrice < strikePrice) {
            result = Direction.Down;
        } else {
            result = Direction.Up;
        }

        if (direction == result) {
            speedRoyaleAMM.sUSD().safeTransfer(user, speedRoyaleAMM.sUSD().balanceOf(address(this)));
        } else {
            speedRoyaleAMM.sUSD().safeTransfer(address(speedRoyaleAMM), speedRoyaleAMM.sUSD().balanceOf(address(this)));
        }

        emit Resolved(finalPrice, result, direction == result);
    }

    modifier onlyAMM() {
        require(msg.sender == address(speedRoyaleAMM), "only the AMM may perform these methods");
        _;
    }

    event Resolved(uint finalPrice, Direction result, bool userIsWinner);
}

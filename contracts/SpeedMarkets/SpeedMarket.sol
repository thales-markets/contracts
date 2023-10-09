// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "../interfaces/ISpeedMarketsAMM.sol";

contract SpeedMarket {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct InitParams {
        address _speedMarketsAMM;
        address _user;
        bytes32 _asset;
        uint64 _strikeTime;
        int64 _strikePrice;
        Direction _direction;
        uint _buyinAmount;
        uint _safeBoxImpact;
        uint _lpFee;
    }

    enum Direction {
        Up,
        Down
    }

    address public user;
    bytes32 public asset;
    uint64 public strikeTime;
    int64 public strikePrice;
    Direction public direction;
    uint public buyinAmount;

    bool public resolved;
    int64 public finalPrice;
    Direction public result;

    ISpeedMarketsAMM public speedMarketsAMM;

    uint public safeBoxImpact;
    uint public lpFee;

    uint256 public createdAt;

    /* ========== CONSTRUCTOR ========== */

    bool public initialized = false;

    function initialize(InitParams calldata params) external {
        require(!initialized, "Speed market already initialized");
        initialized = true;
        speedMarketsAMM = ISpeedMarketsAMM(params._speedMarketsAMM);
        user = params._user;
        asset = params._asset;
        strikeTime = params._strikeTime;
        strikePrice = params._strikePrice;
        direction = params._direction;
        buyinAmount = params._buyinAmount;
        safeBoxImpact = params._safeBoxImpact;
        lpFee = params._lpFee;
        speedMarketsAMM.sUSD().approve(params._speedMarketsAMM, type(uint256).max);
        createdAt = block.timestamp;
    }

    function resolve(int64 _finalPrice) external onlyAMM {
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
            speedMarketsAMM.sUSD().safeTransfer(user, speedMarketsAMM.sUSD().balanceOf(address(this)));
        } else {
            speedMarketsAMM.sUSD().safeTransfer(address(speedMarketsAMM), speedMarketsAMM.sUSD().balanceOf(address(this)));
        }

        emit Resolved(finalPrice, result, direction == result);
    }

    function isUserWinner() external view returns (bool) {
        return resolved && (direction == result);
    }

    modifier onlyAMM() {
        require(msg.sender == address(speedMarketsAMM), "only the AMM may perform these methods");
        _;
    }

    event Resolved(int64 finalPrice, Direction result, bool userIsWinner);
}

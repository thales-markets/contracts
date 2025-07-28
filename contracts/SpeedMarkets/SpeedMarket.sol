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
        uint64 _strikePricePublishTime;
        Direction _direction;
        address _collateral;
        uint _buyinAmount;
        uint _safeBoxImpact;
        uint _lpFee;
        uint _payout;
    }

    enum Direction {
        Up,
        Down
    }

    address public user;
    bytes32 public asset;
    uint64 public strikeTime;
    int64 public strikePrice;
    uint64 public strikePricePublishTime;
    Direction public direction;
    uint public buyinAmount;
    uint public payout;
    address public collateral;
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
        strikePricePublishTime = params._strikePricePublishTime;
        direction = params._direction;
        buyinAmount = params._buyinAmount;
        safeBoxImpact = params._safeBoxImpact;
        lpFee = params._lpFee;
        collateral = params._collateral;
        payout = params._payout;
        IERC20Upgradeable(params._collateral).approve(params._speedMarketsAMM, type(uint256).max);
        createdAt = block.timestamp;
    }

    function resolve(int64 _finalPrice) external onlyAMM {
        require(!resolved, "already resolved");
        require(block.timestamp > strikeTime, "not ready to be resolved");
        resolved = true;
        finalPrice = _finalPrice;

        if (finalPrice < strikePrice) {
            result = Direction.Down;
        } else if (finalPrice > strikePrice) {
            result = Direction.Up;
        } else {
            result = direction == Direction.Up ? Direction.Down : Direction.Up;
        }
        uint payoutToTransfer = IERC20Upgradeable(collateral).balanceOf(address(this));

        if (direction == result) {
            if (payoutToTransfer > payout) {
                IERC20Upgradeable(collateral).safeTransfer(address(speedMarketsAMM), payoutToTransfer - payout);
                payoutToTransfer = payout;
            }
            IERC20Upgradeable(collateral).safeTransfer(user, payoutToTransfer);
        } else {
            IERC20Upgradeable(collateral).safeTransfer(address(speedMarketsAMM), payoutToTransfer);
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

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "../../interfaces/IPositionalMarket.sol";

import "./ThalesAMMLiquidityPool.sol";

contract ThalesAMMLiquidityPoolRound {
    /* ========== LIBRARIES ========== */
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /* ========== STATE VARIABLES ========== */

    ThalesAMMLiquidityPool public liquidityPool;
    IERC20Upgradeable public sUSD;

    uint public round;
    uint public roundStartTime;
    uint public roundEndTime;

    /* ========== CONSTRUCTOR ========== */

    bool public initialized = false;

    function initialize(
        address _liquidityPool,
        IERC20Upgradeable _sUSD,
        uint _round,
        uint _roundStartTime,
        uint _roundEndTime
    ) external {
        require(!initialized, "Already initialized");
        initialized = true;
        liquidityPool = ThalesAMMLiquidityPool(_liquidityPool);
        sUSD = _sUSD;
        round = _round;
        roundStartTime = _roundStartTime;
        roundEndTime = _roundEndTime;
        sUSD.approve(_liquidityPool, type(uint256).max);
    }

    function exerciseMarketReadyToExercised(IPositionalMarket market) external onlyLiquidityPool {
        if (market.resolved()) {
            (uint upBalance, uint downBalance) = market.balancesOf(address(this));
            if (upBalance > 0 || downBalance > 0) {
                market.exerciseOptions();
            }
        }
    }

    function moveOptions(
        IERC20Upgradeable option,
        uint optionsAmount,
        address destination
    ) external onlyLiquidityPool {
        option.safeTransfer(destination, optionsAmount);
    }

    modifier onlyLiquidityPool() {
        require(msg.sender == address(liquidityPool), "only the Pool manager may perform these methods");
        _;
    }
}

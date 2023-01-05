// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "../../interfaces/ISportPositionalMarket.sol";

import "./AMMLiquidityPool.sol";

contract AMMLiquidityPoolRound {
    /* ========== LIBRARIES ========== */
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /* ========== STATE VARIABLES ========== */

    AMMLiquidityPool public liquidityPool;
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
        require(!initialized, "Ranged Market already initialized");
        initialized = true;
        liquidityPool = AMMLiquidityPool(_liquidityPool);
        sUSD = _sUSD;
        round = _round;
        roundStartTime = _roundStartTime;
        roundEndTime = _roundEndTime;
        sUSD.approve(_liquidityPool, type(uint256).max);
    }

    function exerciseMarketReadyToExercised(ISportPositionalMarket market) external onlyManager {
        if (market.resolved()) {
            (uint homeBalance, uint awayBalance, uint drawBalance) = market.balancesOf(address(this));
            if (homeBalance > 0 || awayBalance > 0 || drawBalance > 0) {
                market.exerciseOptions();
            }
        }
    }

    modifier onlyManager() {
        require(msg.sender == address(liquidityPool), "only the Pool manager may perform these methods");
        _;
    }
}

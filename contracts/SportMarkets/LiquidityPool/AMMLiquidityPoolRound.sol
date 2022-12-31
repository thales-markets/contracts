// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "../..//utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";

import "../../interfaces/ISportsAMM.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/IStakingThales.sol";

import "./AMMLiquidityPool.sol";

contract AMMLiquidityPoolRound {
    /* ========== LIBRARIES ========== */
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /* ========== CONSTANTS ========== */
    uint private constant HUNDRED = 1e20;
    uint private constant ONE = 1e18;

    /* ========== STATE VARIABLES ========== */

    AMMLiquidityPool public liquidityPool;
    IERC20Upgradeable public sUSD;

    uint public round;
    uint public roundStartTime;
    uint public roundEndTime;

    /* ========== CONSTRUCTOR ========== */

    bool public initialized = false;

    function initialize(
        AMMLiquidityPool _liquidityPool,
        IERC20Upgradeable _sUSD,
        uint _round,
        uint _roundStartTime,
        uint _roundEndTime
    ) external {
        require(!initialized, "Ranged Market already initialized");
        initialized = true;
        liquidityPool = _liquidityPool;
        sUSD = _sUSD;
        round = _round;
        roundStartTime = _roundStartTime;
        roundEndTime = _roundEndTime;
        sUSD.approve(address(_liquidityPool), type(uint256).max);
    }

    function exerciseMarketReadyToExercised(IPositionalMarket market) external onlyManager {
        if (market.resolved()) {
            (uint upBalance, uint downBalance) = market.balancesOf(address(this));
            if (upBalance > 0 || downBalance > 0) {
                market.exerciseOptions();
            }
        }
    }

    modifier onlyManager() {
        require(msg.sender == address(liquidityPool), "only the Pool manager may perform these methods");
        _;
    }
}

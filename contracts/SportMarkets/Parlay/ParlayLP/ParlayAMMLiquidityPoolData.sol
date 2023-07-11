// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "./ParlayAMMLiquidityPool.sol";
import "../../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract ParlayAMMLiquidityPoolData is Initializable, ProxyOwned, ProxyPausable {
    struct LiquidityPoolData {
        bool started;
        uint maxAllowedDeposit;
        uint round;
        uint totalDeposited;
        uint minDepositAmount;
        uint maxAllowedUsers;
        uint usersCurrentlyInPool;
        bool canCloseCurrentRound;
        bool paused;
        uint roundLength;
        uint stakedThalesMultiplier;
        uint allocationCurrentRound;
        uint lifetimePnl;
        uint roundEndTime;
    }

    struct UserLiquidityPoolData {
        uint balanceCurrentRound;
        uint balanceNextRound;
        bool withdrawalRequested;
        uint maxDeposit;
        uint availableToDeposit;
        uint stakedThales;
        uint withdrawalShare;
    }

    struct PendingParlays {
        uint totalParlaysInRound;
        uint closedParlays;
        uint pendingParlays;
        address[] pendingParlayMarkets;
    }

    function initialize(address _owner) external initializer {
        setOwner(_owner);
    }

    /// @notice getLiquidityPoolData returns liquidity pool data
    /// @param liquidityPool ParlayAMMLiquidityPool
    /// @return LiquidityPoolData
    function getLiquidityPoolData(ParlayAMMLiquidityPool liquidityPool) external view returns (LiquidityPoolData memory) {
        uint round = liquidityPool.round();

        return
            LiquidityPoolData(
                liquidityPool.started(),
                liquidityPool.maxAllowedDeposit(),
                round,
                liquidityPool.totalDeposited(),
                liquidityPool.minDepositAmount(),
                liquidityPool.maxAllowedUsers(),
                liquidityPool.usersCurrentlyInPool(),
                liquidityPool.canCloseCurrentRound(),
                liquidityPool.paused(),
                liquidityPool.roundLength(),
                liquidityPool.stakedThalesMultiplier(),
                liquidityPool.allocationPerRound(round),
                liquidityPool.cumulativeProfitAndLoss(round > 0 ? round - 1 : 0),
                liquidityPool.getRoundEndTime(round)
            );
    }

    /// @notice getUserLiquidityPoolData returns user liquidity pool data
    /// @param liquidityPool ParlayAMMLiquidityPool
    /// @param user address of the user
    /// @return UserLiquidityPoolData
    function getUserLiquidityPoolData(ParlayAMMLiquidityPool liquidityPool, address user)
        external
        view
        returns (UserLiquidityPoolData memory)
    {
        uint round = liquidityPool.round();
        (uint maxDepositForUser, uint availableToDepositForUser, uint stakedThalesForUser) = liquidityPool
            .getMaxAvailableDepositForUser(user);

        return
            UserLiquidityPoolData(
                liquidityPool.balancesPerRound(round, user),
                liquidityPool.balancesPerRound(round + 1, user),
                liquidityPool.withdrawalRequested(user),
                maxDepositForUser,
                availableToDepositForUser,
                stakedThalesForUser,
                liquidityPool.withdrawalShare(user)
            );
    }

    function getPendingParlaysInCurrentRound(ParlayAMMLiquidityPool liquidityPool)
        external
        view
        returns (PendingParlays memory)
    {
        uint round = liquidityPool.round();
        uint tradingMarkets = liquidityPool.getTradingMarketsPerRound(round);
        address[] memory extractMarkets = new address[](tradingMarkets);
        address market;
        uint counter;
        for (uint i = 0; i < tradingMarkets; i++) {
            market = liquidityPool.tradingMarketsPerRound(round, i);
            if (!liquidityPool.marketAlreadyExercisedInRound(round, market)) {
                extractMarkets[i] = market;
                ++counter;
            }
        }
        address[] memory pendingParlays = new address[](counter);
        uint j;
        for (uint i = 0; i < tradingMarkets; i++) {
            if (extractMarkets[i] != address(0) && j < counter) {
                pendingParlays[j] = extractMarkets[i];
                ++j;
            }
        }
        return
            PendingParlays(tradingMarkets, (tradingMarkets - pendingParlays.length), pendingParlays.length, pendingParlays);
    }
}

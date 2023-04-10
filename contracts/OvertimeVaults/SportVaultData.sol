// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "./SportVault.sol";
import "./ParlayVault.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract SportVaultData is Initializable, ProxyOwned, ProxyPausable {
    struct VaultData {
        bool vaultStarted;
        uint maxAllowedDeposit;
        uint round;
        uint roundEndTime;
        uint availableAllocationNextRound;
        uint minDepositAmount;
        uint maxAllowedUsers;
        uint usersCurrentlyInVault;
        bool canCloseCurrentRound;
        bool paused;
        uint utilizationRate;
        uint priceLowerLimit;
        uint priceUpperLimit;
        int skewImpactLimit;
        uint allocationLimitsPerMarketPerRound;
        uint maxTradeRate;
        uint minTradeAmount;
        uint roundLength;
        uint allocationCurrentRound;
        uint allocationNextRound;
        uint lifetimePnl;
        uint allocationSpentInARound;
        uint tradingAllocation;
    }

    struct UserVaultData {
        uint balanceCurrentRound;
        uint balanceNextRound;
        bool withdrawalRequested;
    }

    function initialize(address _owner) external initializer {
        setOwner(_owner);
    }

    /// @notice getSportVaultData returns sport vault data
    /// @param sportVault SportVault
    /// @return VaultData
    function getSportVaultData(SportVault sportVault) external view returns (VaultData memory) {
        uint round = sportVault.round();

        return
            VaultData(
                sportVault.vaultStarted(),
                sportVault.maxAllowedDeposit(),
                round,
                sportVault.getCurrentRoundEnd(),
                sportVault.getAvailableToDeposit(),
                sportVault.minDepositAmount(),
                sportVault.maxAllowedUsers(),
                sportVault.usersCurrentlyInVault(),
                sportVault.canCloseCurrentRound(),
                sportVault.paused(),
                sportVault.utilizationRate(),
                sportVault.priceLowerLimit(),
                sportVault.priceUpperLimit(),
                sportVault.skewImpactLimit(),
                sportVault.allocationLimitsPerMarketPerRound(),
                0,
                sportVault.minTradeAmount(),
                sportVault.roundLength(),
                sportVault.allocationPerRound(round),
                sportVault.capPerRound(round + 1),
                sportVault.cumulativeProfitAndLoss(round > 0 ? round - 1 : 0),
                sportVault.allocationSpentInARound(round),
                sportVault.tradingAllocation()
            );
    }

    /// @notice getParlayVaultData returns parlay vault data
    /// @param parlayVault ParlayVault
    /// @return VaultData
    function getParlayVaultData(ParlayVault parlayVault) external view returns (VaultData memory) {
        uint round = parlayVault.round();

        return
            VaultData(
                parlayVault.vaultStarted(),
                parlayVault.maxAllowedDeposit(),
                round,
                parlayVault.getCurrentRoundEnd(),
                parlayVault.getAvailableToDeposit(),
                parlayVault.minDepositAmount(),
                parlayVault.maxAllowedUsers(),
                parlayVault.usersCurrentlyInVault(),
                parlayVault.canCloseCurrentRound(),
                parlayVault.paused(),
                parlayVault.utilizationRate(),
                parlayVault.priceLowerLimit(),
                parlayVault.priceUpperLimit(),
                parlayVault.skewImpactLimit(),
                0,
                parlayVault.maxTradeRate(),
                parlayVault.minTradeAmount(),
                parlayVault.roundLength(),
                parlayVault.allocationPerRound(round),
                parlayVault.capPerRound(round + 1),
                parlayVault.cumulativeProfitAndLoss(round > 0 ? round - 1 : 0),
                parlayVault.allocationSpentInARound(round),
                parlayVault.tradingAllocation()
            );
    }

    /// @notice getUserSportVaultData returns user sport vault data
    /// @param sportVault SportVault
    /// @param user address of the user
    /// @return UserVaultData
    function getUserSportVaultData(SportVault sportVault, address user) external view returns (UserVaultData memory) {
        uint round = sportVault.round();

        return
            UserVaultData(
                sportVault.balancesPerRound(round, user),
                sportVault.balancesPerRound(round + 1, user),
                sportVault.withdrawalRequested(user)
            );
    }

    /// @notice getUserParlayVaultData returns user parlay vault data
    /// @param parlayVault ParlayVault
    /// @param user address of the user
    /// @return UserVaultData
    function getUserParlayVaultData(ParlayVault parlayVault, address user) external view returns (UserVaultData memory) {
        uint round = parlayVault.round();

        return
            UserVaultData(
                parlayVault.balancesPerRound(round, user),
                parlayVault.balancesPerRound(round + 1, user),
                parlayVault.withdrawalRequested(user)
            );
    }
}

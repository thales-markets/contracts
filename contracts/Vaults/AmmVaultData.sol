// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "./AmmVault.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract AmmVaultData is Initializable, ProxyOwned, ProxyPausable {
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

    /// @notice getAmmVaultData returns AMM vault data
    /// @param ammVault AmmVault
    /// @return VaultData
    function getAmmVaultData(AmmVault ammVault) external view returns (VaultData memory) {
        uint round = ammVault.round();

        return
            VaultData(
                ammVault.vaultStarted(),
                ammVault.maxAllowedDeposit(),
                round,
                ammVault.getCurrentRoundEnd(),
                ammVault.getAvailableToDeposit(),
                ammVault.minDepositAmount(),
                ammVault.maxAllowedUsers(),
                ammVault.usersCurrentlyInVault(),
                ammVault.canCloseCurrentRound(),
                ammVault.paused(),
                ammVault.utilizationRate(),
                ammVault.priceLowerLimit(),
                ammVault.priceUpperLimit(),
                ammVault.skewImpactLimit(),
                ammVault.allocationLimitsPerMarketPerRound(),
                ammVault.minTradeAmount(),
                ammVault.roundLength(),
                ammVault.allocationPerRound(round),
                ammVault.capPerRound(round + 1),
                ammVault.cumulativeProfitAndLoss(round > 0 ? round - 1 : 0),
                ammVault.allocationSpentInARound(round),
                ammVault.tradingAllocation()
            );
    }

    /// @notice getUserAmmVaultData returns user AMM vault data
    /// @param ammVault AmmVault
    /// @param user address of the user
    /// @return UserVaultData
    function getUserAmmVaultData(AmmVault ammVault, address user) external view returns (UserVaultData memory) {
        uint round = ammVault.round();

        return
            UserVaultData(
                ammVault.balancesPerRound(round, user),
                ammVault.balancesPerRound(round + 1, user),
                ammVault.withdrawalRequested(user)
            );
    }
}

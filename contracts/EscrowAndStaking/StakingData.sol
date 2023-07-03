// SPDX-License-Identifier: MIT
pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

// Inheritance
import "./StakingThales.sol";
import "./EscrowThales.sol";
import "../utils/proxy/ProxyOwned.sol";
import "../utils/proxy/ProxyPausable.sol";
import "@openzeppelin/upgrades-core/contracts/Initializable.sol";

contract StakingData is Initializable, ProxyOwned, ProxyPausable {
    struct StakingData {
        bool paused;
        uint periodsOfStaking;
        uint lastPeriodTimeStamp;
        uint durationPeriod;
        uint unstakeDurationPeriod;
        uint baseRewardsPool;
        uint bonusRewardsPool;
        uint totalStakedAmount;
        uint maxSNXRewardsPercentage;
        uint maxAMMVolumeRewardsPercentage;
        uint maxThalesRoyaleRewardsPercentage;
        uint SNXVolumeRewardsMultiplier;
        uint AMMVolumeRewardsMultiplier;
        bool canClosePeriod;
        bool mergeAccountEnabled;
        uint totalEscrowBalanceNotIncludedInStaking;
        uint totalEscrowedRewards;
    }

    struct UserStakingData {
        uint thalesStaked;
        bool unstaking;
        uint lastUnstakeTime;
        uint unstakingAmount;
        address delegatedVolume;
        uint rewards;
        uint baseRewards;
        uint totalBonus;
        uint snxBonus;
        uint ammBonus;
        uint snxStaked;
        uint ammVolume;
        uint thalesAmmVolume;
        uint rangedAmmVolume;
        uint sportsAmmVolume;
        uint lastPeriodOfClaimedRewards;
        uint escrowedBalance;
        uint claimable;
    }

    struct UserVestingData {
        uint numberOfPeriods;
        uint currentVestingPeriod;
        uint lastPeriodTimeStamp;
        uint claimable;
        EscrowThales.VestingEntry[] vestingEntries;
    }

    address public stakingThales;
    address public escrowThales;

    function initialize(address _owner) external initializer {
        setOwner(_owner);
    }

    /// @notice getStakingData returns Thales staking data
    /// @return StakingData
    function getStakingData() external view returns (StakingData memory) {
        StakingThales staking = StakingThales(stakingThales);
        EscrowThales escrow = EscrowThales(escrowThales);

        return
            StakingData(
                staking.paused(),
                staking.periodsOfStaking(),
                staking.lastPeriodTimeStamp(),
                staking.durationPeriod(),
                staking.unstakeDurationPeriod(),
                staking.fixedPeriodReward(),
                staking.periodExtraReward(),
                staking.totalStakedAmount(),
                staking.maxSNXRewardsPercentage(),
                staking.maxAMMVolumeRewardsPercentage(),
                staking.maxThalesRoyaleRewardsPercentage(),
                staking.SNXVolumeRewardsMultiplier(),
                staking.AMMVolumeRewardsMultiplier(),
                staking.canClosePeriod(),
                staking.mergeAccountEnabled(),
                escrow.totalEscrowBalanceNotIncludedInStaking(),
                escrow.totalEscrowedRewards()
            );
    }

    /// @notice getUserStakingData returns user Thales staking data
    /// @param user address of the user
    /// @return UserStakingData
    function getUserStakingData(address user) external view returns (UserStakingData memory) {
        StakingThales staking = StakingThales(stakingThales);
        EscrowThales escrow = EscrowThales(escrowThales);

        return
            UserStakingData(
                staking.stakedBalanceOf(user),
                staking.unstaking(user),
                staking.lastUnstakeTime(user),
                staking.unstakingAmount(user),
                staking.delegatedVolume(user),
                staking.getRewardsAvailable(user),
                staking.getBaseReward(user),
                staking.getTotalBonus(user),
                staking.getSNXBonus(user),
                staking.getAMMBonus(user),
                staking.getSNXStaked(user),
                staking.getAMMVolume(user),
                staking.getThalesAMMVolume(user),
                staking.getThalesRangedAMMVolume(user),
                staking.getSportsAMMVolume(user),
                staking.getLastPeriodOfClaimedRewards(user),
                escrow.totalAccountEscrowedAmount(user),
                escrow.claimable(user)
            );
    }

    /// @notice getUserVestingData returns user Thales vesting data
    /// @param user address of the user
    /// @return UserVestingData
    function getUserVestingData(address user) external view returns (UserVestingData memory) {
        StakingThales staking = StakingThales(stakingThales);
        EscrowThales escrow = EscrowThales(escrowThales);

        uint numberOfPeriods = escrow.NUM_PERIODS();
        EscrowThales.VestingEntry[] memory vestingEntries = new EscrowThales.VestingEntry[](numberOfPeriods);
        for (uint i = 0; i < numberOfPeriods; i++) {
            (uint amount, uint vesting_period) = escrow.vestingEntries(user, i);
            vestingEntries[i].amount = amount;
            vestingEntries[i].vesting_period = vesting_period;
        }

        return
            UserVestingData(
                escrow.NUM_PERIODS(),
                escrow.currentVestingPeriod(),
                staking.lastPeriodTimeStamp(),
                escrow.claimable(user),
                vestingEntries
            );
    }

    function setStakingThales(address _stakingThales) external onlyOwner {
        stakingThales = _stakingThales;
        emit StakingThalesChnaged(_stakingThales);
    }

    function setEscrowThales(address _escrowThales) external onlyOwner {
        escrowThales = _escrowThales;
        emit EscrowThalesChnaged(_escrowThales);
    }

    event StakingThalesChnaged(address _stakingThales);
    event EscrowThalesChnaged(address _escrowThales);
}

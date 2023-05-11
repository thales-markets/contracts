// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/math/SafeMath.sol";
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/SafeERC20.sol";

import "../utils/proxy/ProxyReentrancyGuard.sol";
import "../utils/proxy/ProxyOwned.sol";
import "../utils/proxy/ProxyPausable.sol";
import "@openzeppelin/upgrades-core/contracts/Initializable.sol";

import "../interfaces/IEscrowThales.sol";
import "../interfaces/IStakingThales.sol";
import "../interfaces/IThalesStakingRewardsPool.sol";

/// @title A Escrow contract that provides logic for escrow and vesting staking rewards
contract EscrowThales is IEscrowThales, Initializable, ProxyOwned, ProxyReentrancyGuard, ProxyPausable {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    IERC20 public vestingToken;
    IStakingThales public iStakingThales;
    address public airdropContract;

    uint public constant NUM_PERIODS = 10;
    uint public totalEscrowedRewards;
    uint public totalEscrowBalanceNotIncludedInStaking;
    uint public currentVestingPeriod;

    uint private _totalVested;

    struct VestingEntry {
        uint amount;
        uint vesting_period;
    }

    mapping(address => VestingEntry[NUM_PERIODS]) public vestingEntries;
    mapping(address => uint) public totalAccountEscrowedAmount;

    mapping(address => uint) public lastPeriodAddedReward;

    bool private testMode;
    IThalesStakingRewardsPool public ThalesStakingRewardsPool;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        address _vestingToken //THALES
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        vestingToken = IERC20(_vestingToken);
    }

    /* ========== VIEWS ========== */

    /// @notice Get the vesting period of specific vesting entry for the account
    /// @param account to get the vesting period for
    /// @param index of vesting entry to get vesting period for
    /// @return the vesting period
    function getStakerPeriod(address account, uint index) external view returns (uint) {
        require(account != address(0), "Invalid account address");
        return vestingEntries[account][index].vesting_period;
    }

    /// @notice Get the vesting amount of specific vesting entry for the account
    /// @param account to get the vesting amount for
    /// @param index of vesting entry to get vesting amount for
    /// @return the vesting amount for the account
    function getStakerAmounts(address account, uint index) external view returns (uint) {
        require(account != address(0), "Invalid account address");
        return vestingEntries[account][index].amount;
    }

    /// @notice Get the staked escrowed balance for the account
    /// @param account to get the staked escrowed balance for
    /// @return the staked escrowed balance for the account
    function getStakedEscrowedBalanceForRewards(address account) external view returns (uint) {
        if (lastPeriodAddedReward[account] == currentVestingPeriod) {
            return
                totalAccountEscrowedAmount[account].sub(
                    vestingEntries[account][currentVestingPeriod.mod(NUM_PERIODS)].amount
                );
        } else {
            return totalAccountEscrowedAmount[account];
        }
    }

    /// @notice Get the claimable vesting amount for the account
    /// @param account to get the claimable vesting amount for
    /// @return the claimable vesting amount for the account
    function claimable(address account) external view returns (uint) {
        require(account != address(0), "Invalid address");
        return totalAccountEscrowedAmount[account].sub(_getVestingNotAvailable(account));
    }

    /* ========== PUBLIC ========== */

    /// @notice Add the amount of staking token to the escrow for the account
    /// @param account to add the amount to the escrow for
    /// @param amount to add to the escrow
    function addToEscrow(address account, uint amount) external notPaused {
        require(account != address(0), "Invalid address");
        require(amount > 0, "Amount is 0");
        require(
            msg.sender == address(ThalesStakingRewardsPool) || msg.sender == airdropContract,
            "Add to escrow can only be called from staking or ongoing airdrop contracts"
        );

        totalAccountEscrowedAmount[account] = totalAccountEscrowedAmount[account].add(amount);

        if (lastPeriodAddedReward[account] == currentVestingPeriod) {
            vestingEntries[account][currentVestingPeriod.mod(NUM_PERIODS)].amount = vestingEntries[account][
                currentVestingPeriod.mod(NUM_PERIODS)
            ].amount.add(amount);
        } else {
            vestingEntries[account][currentVestingPeriod.mod(NUM_PERIODS)].amount = amount;
        }
        vestingEntries[account][currentVestingPeriod.mod(NUM_PERIODS)].vesting_period = currentVestingPeriod.add(
            NUM_PERIODS
        );
        lastPeriodAddedReward[account] = currentVestingPeriod;

        totalEscrowedRewards = totalEscrowedRewards.add(amount);
        //Transfering THALES from StakingThales to EscrowThales
        vestingToken.safeTransferFrom(msg.sender, address(this), amount);

        // add to totalEscrowBalanceNotIncludedInStaking if user is not staking
        if (iStakingThales.stakedBalanceOf(account) == 0) {
            totalEscrowBalanceNotIncludedInStaking = totalEscrowBalanceNotIncludedInStaking.add(amount);
        }

        emit AddedToEscrow(account, amount);
    }

    /// @notice Vest the amount of escrowed tokens
    /// @param amount to vest
    function vest(uint amount) external nonReentrant notPaused returns (bool) {
        require(amount > 0, "Claimed amount is 0");
        require(currentVestingPeriod >= NUM_PERIODS, "Vesting rewards still not available");

        uint vestingAmount = 0;
        vestingAmount = totalAccountEscrowedAmount[msg.sender].sub(_getVestingNotAvailable(msg.sender));
        // Amount must be lower than the reward
        require(amount <= vestingAmount, "Amount exceeds the claimable rewards");
        totalAccountEscrowedAmount[msg.sender] = totalAccountEscrowedAmount[msg.sender].sub(amount);
        totalEscrowedRewards = totalEscrowedRewards.sub(amount);
        _totalVested = _totalVested.add(amount);
        vestingToken.safeTransfer(msg.sender, amount);

        // subtract from totalEscrowBalanceNotIncludedInStaking if user is not staking
        if (iStakingThales.stakedBalanceOf(msg.sender) == 0) {
            totalEscrowBalanceNotIncludedInStaking = totalEscrowBalanceNotIncludedInStaking.sub(amount);
        }

        emit Vested(msg.sender, amount);
        return true;
    }

    /// @notice Add the amount of tokens to the total escrow balance not included in staking
    /// @param amount to add
    function addTotalEscrowBalanceNotIncludedInStaking(uint amount) external {
        require(msg.sender == address(iStakingThales), "Can only be called from staking contract");
        totalEscrowBalanceNotIncludedInStaking = totalEscrowBalanceNotIncludedInStaking.add(amount);
    }

    /// @notice Subtract the amount of tokens form the total escrow balance not included in staking
    /// @param amount to subtract
    function subtractTotalEscrowBalanceNotIncludedInStaking(uint amount) external {
        require(msg.sender == address(iStakingThales), "Can only be called from staking contract");
        totalEscrowBalanceNotIncludedInStaking = totalEscrowBalanceNotIncludedInStaking.sub(amount);
    }

    /// @notice Update the current vesting period
    function updateCurrentPeriod() external returns (bool) {
        if (!testMode) {
            require(msg.sender == address(iStakingThales), "Can only be called from staking contract");
        }
        currentVestingPeriod = currentVestingPeriod.add(1);
        return true;
    }

    /// @notice Set address of Staking Thales contract
    /// @param StakingThalesContract address of Staking Thales contract
    function setStakingThalesContract(address StakingThalesContract) external onlyOwner {
        require(StakingThalesContract != address(0), "Invalid address set");
        iStakingThales = IStakingThales(StakingThalesContract);
        emit StakingThalesContractChanged(StakingThalesContract);
    }

    /// @notice Enable the test mode
    function enableTestMode() external onlyOwner {
        testMode = true;
    }

    /// @notice Set address of Airdrop contract
    /// @param AirdropContract address of Airdrop contract
    function setAirdropContract(address AirdropContract) external onlyOwner {
        require(AirdropContract != address(0), "Invalid address set");
        airdropContract = AirdropContract;
        emit AirdropContractChanged(AirdropContract);
    }

    /// @notice Set address of Thales staking rewards pool
    /// @param _thalesStakingRewardsPool address of Thales staking rewards pool
    function setThalesStakingRewardsPool(address _thalesStakingRewardsPool) public onlyOwner {
        require(_thalesStakingRewardsPool != address(0), "Invalid address");
        ThalesStakingRewardsPool = IThalesStakingRewardsPool(_thalesStakingRewardsPool);
        emit ThalesStakingRewardsPoolChanged(_thalesStakingRewardsPool);
    }

    /// @notice Fix the vesting entry for the account
    /// @param account to fix the vesting entry for
    function fixEscrowEntry(address account) external onlyOwner {
        vestingEntries[account][currentVestingPeriod.mod(NUM_PERIODS)].vesting_period = currentVestingPeriod.add(
            NUM_PERIODS
        );
    }

    /// @notice Merge account to transfer all escrow amounts to another account
    /// @param srcAccount to merge
    /// @param destAccount to merge into
    function mergeAccount(address srcAccount, address destAccount) external {
        require(msg.sender == address(iStakingThales), "Can only be called from staking contract");

        if (iStakingThales.stakedBalanceOf(srcAccount) == 0 && iStakingThales.stakedBalanceOf(destAccount) > 0) {
            if (totalAccountEscrowedAmount[srcAccount] > 0) {
                totalEscrowBalanceNotIncludedInStaking = totalEscrowBalanceNotIncludedInStaking.sub(
                    totalAccountEscrowedAmount[srcAccount]
                );
            }
        }
        if (iStakingThales.stakedBalanceOf(destAccount) == 0 && iStakingThales.stakedBalanceOf(srcAccount) > 0) {
            if (totalAccountEscrowedAmount[destAccount] > 0) {
                totalEscrowBalanceNotIncludedInStaking = totalEscrowBalanceNotIncludedInStaking.sub(
                    totalAccountEscrowedAmount[destAccount]
                );
            }
        }

        totalAccountEscrowedAmount[destAccount] = totalAccountEscrowedAmount[destAccount].add(
            totalAccountEscrowedAmount[srcAccount]
        );
        lastPeriodAddedReward[destAccount] = currentVestingPeriod;

        uint vestingEntriesIndex;
        uint vestingEntriesPeriod;
        for (uint i = 1; i <= NUM_PERIODS; i++) {
            vestingEntriesIndex = currentVestingPeriod.add(i).mod(NUM_PERIODS);
            vestingEntriesPeriod = currentVestingPeriod.add(i);

            if (vestingEntriesPeriod != vestingEntries[destAccount][vestingEntriesIndex].vesting_period) {
                vestingEntries[destAccount][vestingEntriesIndex].amount = 0;
                vestingEntries[destAccount][vestingEntriesIndex].vesting_period = vestingEntriesPeriod;
            }

            if (vestingEntriesPeriod == vestingEntries[srcAccount][vestingEntriesIndex].vesting_period) {
                vestingEntries[destAccount][vestingEntriesIndex].amount = vestingEntries[destAccount][vestingEntriesIndex]
                    .amount
                    .add(vestingEntries[srcAccount][vestingEntriesIndex].amount);
            }
        }

        delete totalAccountEscrowedAmount[srcAccount];
        delete lastPeriodAddedReward[srcAccount];
        delete vestingEntries[srcAccount];
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function _getVestingNotAvailable(address account) internal view returns (uint) {
        uint vesting_not_available = 0;
        for (uint i = 0; i < NUM_PERIODS; i++) {
            if (vestingEntries[account][i].vesting_period > currentVestingPeriod) {
                vesting_not_available = vesting_not_available.add(vestingEntries[account][i].amount);
            }
        }
        return vesting_not_available;
    }

    /* ========== EVENTS ========== */

    event AddedToEscrow(address acount, uint amount);
    event Vested(address account, uint amount);
    event StakingThalesContractChanged(address newAddress);
    event AirdropContractChanged(address newAddress);
    event ThalesStakingRewardsPoolChanged(address thalesStakingRewardsPool);
}

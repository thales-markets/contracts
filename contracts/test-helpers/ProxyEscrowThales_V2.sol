// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";

import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../interfaces/IEscrowThales.sol";
import "../interfaces/IStakingThales.sol";
import "../interfaces/IThalesStakingRewardsPool.sol";

contract ProxyEscrowThales_V2 is IEscrowThales, Initializable, ProxyOwned, ProxyReentrancyGuard, ProxyPausable {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    IERC20 public vestingToken;
    IStakingThales public iStakingThales;
    address public airdropContract;

    uint public constant NUM_PERIODS = 10;
    uint public override totalEscrowedRewards;
    uint public override totalEscrowBalanceNotIncludedInStaking;
    uint public override currentVestingPeriod;

    uint private _totalVested;

    struct VestingEntry {
        uint amount;
        uint vesting_period;
    }

    mapping(address => VestingEntry[NUM_PERIODS]) public vestingEntries;
    mapping(address => uint) public override totalAccountEscrowedAmount;

    mapping(address => uint) public lastPeriodAddedReward;

    bool private testMode;

    IThalesStakingRewardsPool public ThalesStakingRewardsPool;
    uint private _contractVersion;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        address _vestingToken //THALES
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        vestingToken = IERC20(_vestingToken);
    }

    function getStakerPeriod(address account, uint index) external view override returns (uint) {
        require(account != address(0), "Invalid account address");
        return vestingEntries[account][index].vesting_period;
    }

    function getStakerAmounts(address account, uint index) external view override returns (uint) {
        require(account != address(0), "Invalid account address");
        return vestingEntries[account][index].amount;
    }

    function getStakedEscrowedBalanceForRewards(address account) external view override returns (uint) {
        if (lastPeriodAddedReward[account] == currentVestingPeriod) {
            return
                totalAccountEscrowedAmount[account].sub(
                    vestingEntries[account][currentVestingPeriod.mod(NUM_PERIODS)].amount
                );
        } else {
            return totalAccountEscrowedAmount[account];
        }
    }

    function getVersion() external view returns (uint) {
        return _contractVersion;
    }
    
    function setVersion(uint version) external onlyOwner {
        _contractVersion = version;
    }

    function claimable(address account) external view override returns (uint) {
        require(account != address(0), "Invalid address");
        return totalAccountEscrowedAmount[account].sub(_getVestingNotAvailable(account));
    }
    

    function addToEscrow(address account, uint amount) external override {
        require(account != address(0), "Invalid address");
        require(amount > 0, "Amount is 0");
        require(
            msg.sender == address(iStakingThales) || msg.sender == airdropContract,
            "Add to escrow can only be called from staking or ongoing airdrop contracts"
        );

        totalAccountEscrowedAmount[account] = totalAccountEscrowedAmount[account].add(amount);

        lastPeriodAddedReward[account] = currentVestingPeriod;

        vestingEntries[account][currentVestingPeriod.mod(NUM_PERIODS)].amount = amount;
        vestingEntries[account][currentVestingPeriod.mod(NUM_PERIODS)].vesting_period = currentVestingPeriod.add(
            NUM_PERIODS
        );

        totalEscrowedRewards = totalEscrowedRewards.add(amount);
        //Transfering THALES from StakingThales to EscrowThales
        vestingToken.safeTransferFrom(msg.sender, address(this), amount);

        // add to totalEscrowBalanceNotIncludedInStaking if user is not staking
        if (iStakingThales.stakedBalanceOf(account) == 0) {
            totalEscrowBalanceNotIncludedInStaking = totalEscrowBalanceNotIncludedInStaking.add(amount);
        }

        emit AddedToEscrow(account, amount);
    }

    function vest(uint amount) external override nonReentrant notPaused returns (bool) {
        require(amount > 0, "Claimed amount is 0");
        require(currentVestingPeriod > NUM_PERIODS, "Vesting rewards still not available");

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

    function addTotalEscrowBalanceNotIncludedInStaking(uint amount) external override {
        require(msg.sender == address(iStakingThales), "Can only be called from staking contract");
        totalEscrowBalanceNotIncludedInStaking = totalEscrowBalanceNotIncludedInStaking.add(amount);
    }

    function subtractTotalEscrowBalanceNotIncludedInStaking(uint amount) external override {
        require(msg.sender == address(iStakingThales), "Can only be called from staking contract");
        totalEscrowBalanceNotIncludedInStaking = totalEscrowBalanceNotIncludedInStaking.sub(amount);
    }

    function updateCurrentPeriod() external override returns (bool) {
        if (!testMode) {
            require(msg.sender == address(iStakingThales), "Can only be called from staking contract");
        }
        currentVestingPeriod = currentVestingPeriod.add(1);
        return true;
    }

    function setStakingThalesContract(address StakingThalesContract) external onlyOwner {
        require(StakingThalesContract != address(0), "Invalid address set");
        iStakingThales = IStakingThales(StakingThalesContract);
        emit StakingThalesContractChanged(StakingThalesContract);
    }

    function enableTestMode() external onlyOwner {
        testMode = true;
    }

    function setAirdropContract(address AirdropContract) external onlyOwner {
        require(AirdropContract != address(0), "Invalid address set");
        airdropContract = AirdropContract;
        emit AirdropContractChanged(AirdropContract);
    }

    /*  Selfdestruct operation potentially harmful for proxy contracts
     */
    // function selfDestruct(address payable account) external onlyOwner {
    //     vestingToken.safeTransfer(account, vestingToken.balanceOf(address(this)));
    //     selfdestruct(account);
    // }

    /* ========== INTERNAL FUNCTIONS ========== */

    function _getVestingNotAvailable(address account) internal view returns (uint) {
        uint vesting_not_available = 0;
        for (uint i = 0; i < NUM_PERIODS; i++) {
            if (vestingEntries[account][i].vesting_period >= currentVestingPeriod) {
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
}

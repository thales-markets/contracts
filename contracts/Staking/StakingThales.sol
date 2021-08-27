pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/math/Math.sol";
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/SafeERC20.sol";
import "synthetix-2.43.1/contracts/SafeDecimalMath.sol";
import "openzeppelin-solidity-2.3.0/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity-2.3.0/contracts/utils/ReentrancyGuard.sol";
import "synthetix-2.43.1/contracts/Pausable.sol";

import "../interfaces/IEscrowThales.sol";
import "../interfaces/IStakingThales.sol";

contract StakingThales is IStakingThales, Owned, ReentrancyGuard, Pausable {
    /* ========== LIBRARIES ========== */

    using SafeMath for uint;
    using SafeDecimalMath for uint;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IEscrowThales public iEscrowThales;
    IERC20 public stakingToken;
    IERC20 public feeToken;

    uint public weeksOfStaking = 0;
    uint public lastPeriodTimeStamp = 0;
    uint public durationPeriod = 7 days;
    uint public unstakeDurationPeriod = 7 days;
    uint public startTimeStamp = 0;
    uint public currentWeekRewards = 0;
    uint public currentWeekFees = 0;
    bool public distributeFeesEnabled = false;
    uint public fixedWeeklyReward = 0;
    bool public claimEnabled = false;

    uint private _rewardFunds = 0;
    uint private _feeFunds = 0;

    mapping(address => uint) public stakerRewardsClaimed;
    mapping(address => uint) public stakerFeesClaimed;

    uint private _totalStakedAmount;
    uint private _totalEscrowedAmount;
    uint private _totalPendingStakeAmount;
    uint private _totalUnclaimedRewards;
    uint private _totalUnlcaimedFees;
    uint private _totalRewardsClaimed;
    uint private _totalRewardFeesClaimed;

    mapping(address => uint) public _lastUnstakeTime;
    mapping(address => uint) private _stakedBalances;
    mapping(address => uint) private _escrowedBalances;
    mapping(address => uint) private _lastStakingWeek;
    mapping(address => uint) private _lastRewardsClaimedWeek;
    mapping(address => uint) private _pendingStake;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _owner,
        address _iEscrowThales, //THALES
        address _stakingToken, //THALES
        address _feeToken, //sUSD
        uint _durationPeriod,
        uint _unstakeDurationPeriod
    ) public Owned(_owner) {
        iEscrowThales = IEscrowThales(_iEscrowThales);
        stakingToken = IERC20(_stakingToken);
        feeToken = IERC20(_feeToken);
        stakingToken.approve(_iEscrowThales, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
        durationPeriod = _durationPeriod;
        unstakeDurationPeriod = _unstakeDurationPeriod;
    }

    /* ========== VIEWS ========== */

    function totalStakedAmount() external view returns (uint) {
        return _totalStakedAmount;
    }

    function stakedBalanceOf(address account) external view returns (uint) {
        return _stakedBalances[account];
    }

    function getLastWeekRewards() external view returns (uint) {
        return currentWeekRewards;
    }

    function getLastWeekFees() external view returns (uint) {
        return currentWeekFees;
    }

    function getLastWeekOfClaimedRewards(address account) external view returns (uint) {
        return _lastRewardsClaimedWeek[account];
    }

    function getRewardsAvailable(address account) external view returns (uint) {
        return calculateUnclaimedRewards(account);
    }

    function getRewardFeesAvailable(address account) external view returns (uint) {
        return calculateUnclaimedFees(account);
    }

    function getAlreadyClaimedRewards(address account) external view returns (uint) {
        return stakerRewardsClaimed[account];
    }

    function getAlreadyClaimedFees(address account) external view returns (uint) {
        return stakerFeesClaimed[account];
    }

    function getContractRewardFunds() external view returns (uint) {
        return stakingToken.balanceOf(address(this));
    }

    function getContractFeeFunds() external view returns (uint) {
        return feeToken.balanceOf(address(this));
    }

    function setDistributeFeesEnabled(bool _distributeFeesEnabled) external onlyOwner {
        distributeFeesEnabled = _distributeFeesEnabled;
    }

    function setFixedWeeklyReward(uint _fixedReward) external onlyOwner {
        fixedWeeklyReward = _fixedReward;
    }

    function setClaimEnabled(bool _claimEnabled) external onlyOwner {
        claimEnabled = _claimEnabled;
    }

    function setDurationPeriod(uint _durationPeriod) external onlyOwner {
        durationPeriod = _durationPeriod;
    }

    function setUnstakeDurationPeriod(uint _unstakeDurationPeriod) external onlyOwner {
        unstakeDurationPeriod = _unstakeDurationPeriod;
    }

    /* ========== PUBLIC ========== */

    function startStakingPeriod() external onlyOwner {
        require(startTimeStamp == 0, "Staking has already started");
        startTimeStamp = block.timestamp;
        weeksOfStaking = 0;
        lastPeriodTimeStamp = startTimeStamp;
        _totalUnclaimedRewards = 0;
        _totalUnlcaimedFees = 0;
        _totalRewardsClaimed = 0;
        _totalRewardFeesClaimed = 0;
        _totalStakedAmount = 0;
        _totalEscrowedAmount = 0;
        _totalPendingStakeAmount = 0;
        durationPeriod = 7 days;
        unstakeDurationPeriod = 7 days;
    }

    function closePeriod() external nonReentrant notPaused {
        require(startTimeStamp > 0, "Staking period has not started");
        require(
            block.timestamp >= lastPeriodTimeStamp.add(durationPeriod),
            "7 days has not passed since the last closed period"
        );

        iEscrowThales.updateCurrentWeek(weeksOfStaking.add(1));
        lastPeriodTimeStamp = block.timestamp;
        weeksOfStaking = weeksOfStaking.add(1);

        _totalEscrowedAmount = iEscrowThales.getTotalEscrowedRewards();

        //Actions taken on every closed period
        currentWeekRewards = calculateRewardsForWeek(weeksOfStaking);
        _totalUnclaimedRewards = _totalUnclaimedRewards.add(currentWeekRewards);

        if (distributeFeesEnabled) {
            currentWeekFees = calculateFeesForWeek(weeksOfStaking);
            _totalUnlcaimedFees = _totalUnlcaimedFees.add(currentWeekFees);
        }

        emit ClosedPeriod(weeksOfStaking, lastPeriodTimeStamp);
    }

    function stake(uint amount) external nonReentrant notPaused {
        require(startTimeStamp > 0, "Staking period has not started");
        require(amount > 0, "Cannot stake 0");
        require(
            stakingToken.allowance(msg.sender, address(this)) >= amount,
            "No allowance. Please grant StakingThales allowance"
        );
        require(
            _lastUnstakeTime[msg.sender] < block.timestamp.sub(unstakeDurationPeriod),
            "Cannot stake, the staker is paused from staking due to unstaking"
        );
        // Check if there are not claimable rewards from last week.
        // Claim them, and add new stake
        if (_lastRewardsClaimedWeek[msg.sender] < weeksOfStaking && claimEnabled) {
            claimReward();
        }
        _totalStakedAmount = _totalStakedAmount.add(amount);
        _stakedBalances[msg.sender] = _stakedBalances[msg.sender].add(amount);
        _lastStakingWeek[msg.sender] = weeksOfStaking;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function startUnstake() external {
        require(msg.sender != address(0), "Invalid address");
        require(
            _lastUnstakeTime[msg.sender] < block.timestamp.sub(unstakeDurationPeriod),
            "Already initiated unstaking cooldown"
        );
        if (_lastRewardsClaimedWeek[msg.sender] < weeksOfStaking && claimEnabled) {
            claimReward();
        }
        _lastUnstakeTime[msg.sender] = block.timestamp;
        emit UnstakeCooldown(msg.sender, _lastUnstakeTime[msg.sender].add(unstakeDurationPeriod));
    }

    function unstake() external {
        require(msg.sender != address(0), "Invalid address");
        require(
            _lastUnstakeTime[msg.sender] < block.timestamp.sub(unstakeDurationPeriod),
            "Cannot stake, the staker is paused from staking due to unstaking"
        );
        _escrowedBalances[msg.sender] = 0;
        _totalStakedAmount = _totalStakedAmount.sub(_stakedBalances[msg.sender]);
        uint unstakeAmount = _stakedBalances[msg.sender];
        _stakedBalances[msg.sender] = 0;
        stakingToken.transfer(msg.sender, unstakeAmount);
        emit Unstaked(msg.sender, unstakeAmount);
    }

    function claimReward() public nonReentrant notPaused {
        require(claimEnabled, "Claiming is not enabled.");
        require(startTimeStamp > 0, "Staking period has not started");
        require(
            _lastUnstakeTime[msg.sender] < block.timestamp.sub(unstakeDurationPeriod),
            "Cannot stake, the staker is paused from staking due to unstaking"
        );

        if (_lastStakingWeek[msg.sender] < weeksOfStaking) {
            _escrowedBalances[msg.sender] = iEscrowThales.getStakedEscrowedBalance(msg.sender);
        }
        //Calculate rewards
        uint unclaimedReward = calculateUnclaimedRewards(msg.sender);
        if (distributeFeesEnabled) {
            uint unclaimedFees = calculateUnclaimedFees(msg.sender);
            if (unclaimedFees > 0) {
                feeToken.transfer(msg.sender, unclaimedFees);
                // feeToken.transferFrom(address(this), msg.sender, unclaimedFees);
                stakerFeesClaimed[msg.sender] = stakerFeesClaimed[msg.sender].add(unclaimedFees);
                _totalRewardFeesClaimed = _totalRewardFeesClaimed.add(unclaimedFees);
                _totalUnlcaimedFees = _totalUnlcaimedFees.sub(unclaimedFees);
                emit FeeRewardsClaimed(msg.sender, unclaimedFees);
            }
        }
        if (unclaimedReward > 0) {
            // Both the rewards and the fees are staked => new_stake(reward + fees) NEEDS TO BE UPDATED NEXT WEEK ===>
            _lastStakingWeek[msg.sender] = weeksOfStaking;
            // Transfer THALES to Escrow contract
            iEscrowThales.addToEscrow(msg.sender, unclaimedReward);
            // Record the total claimed rewards
            stakerRewardsClaimed[msg.sender] = stakerRewardsClaimed[msg.sender].add(unclaimedReward);
            _totalRewardsClaimed = _totalRewardsClaimed.add(unclaimedReward);
            _totalUnclaimedRewards = _totalUnclaimedRewards.sub(unclaimedReward);

            emit RewardsClaimed(msg.sender, unclaimedReward);
        }
        // Update last claiming week
        _lastRewardsClaimedWeek[msg.sender] = weeksOfStaking;
    }

    function selfDestruct(address payable account) external onlyOwner {
        stakingToken.transfer(account, stakingToken.balanceOf(address(this)));
        feeToken.transfer(account, feeToken.balanceOf(address(this)));
        selfdestruct(account);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function calculateUnclaimedRewards(address account) internal view returns (uint) {
        require(account != address(0), "Invalid account address used");
        require(_stakedBalances[account] > 0, "Account is not a staker");
        require(_lastRewardsClaimedWeek[account] < weeksOfStaking, "Rewards already claimed for last week");

        // return _stakedBalances[account].div(1e18).div(_totalStakedAmount).mul(currentWeekRewards);
        uint rewardsThroughEscrow = 0;
        uint rewardsThroughStake = _stakedBalances[account].mul(currentWeekRewards).div(_totalStakedAmount);
        if (_totalEscrowedAmount > 0) {
            rewardsThroughEscrow = _escrowedBalances[account].mul(currentWeekRewards).div(_totalEscrowedAmount);
            return rewardsThroughStake.add(rewardsThroughEscrow).div(2);
        } else {
            return rewardsThroughStake;
        }
    }

    function calculateUnclaimedFees(address account) internal view returns (uint) {
        require(account != address(0), "Invalid account address used");
        require(_stakedBalances[account] > 0, "Account is not a staker");
        require(_lastRewardsClaimedWeek[account] < weeksOfStaking, "Rewards already claimed for last week");
        return _stakedBalances[account].mul(currentWeekFees).div(_totalStakedAmount);
    }

    function calculateRewardsForWeek(uint week) internal view returns (uint) {
        //ADD formula
        require(week > 0, "Invalid number for week");
        require(stakingToken.balanceOf(address(this)) >= fixedWeeklyReward, "Low THALES balance in the Smart-contract");
        return fixedWeeklyReward;
    }

    function calculateFeesForWeek(uint week) internal view returns (uint) {
        require(week > 0, "Invalid number for week");
        require(feeToken.balanceOf(address(this)) > 0, "No Available fees");
        //ADD formula
        return feeToken.balanceOf(address(this));
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint reward);
    event Staked(address user, uint amount);
    event ClosedPeriod(uint WeekOfStaking, uint lastPeriodTimeStamp);
    event RewardsClaimed(address account, uint unclaimedReward);
    event FeeRewardsClaimed(address account, uint unclaimedFees);
    event UnstakeCooldown(address account, uint cooldownTime);
    event Unstaked(address account, uint unstakeAmount);
}

pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/math/Math.sol";
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/SafeERC20.sol";
import "synthetix-2.43.1/contracts/SafeDecimalMath.sol";
import "openzeppelin-solidity-2.3.0/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity-2.3.0/contracts/utils/ReentrancyGuard.sol";
import "synthetix-2.43.1/contracts/Pausable.sol";

import "./interfaces/IEscrowThales.sol";

contract StakingThales is Owned, ReentrancyGuard, Pausable {
    /* ========== LIBRARIES ========== */

    using SafeMath for uint;
    using SafeDecimalMath for uint;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IEscrowThales public escrowToken;
    IERC20 public stakingToken;
    IERC20 public feeToken;

    uint public weeksOfStaking = 0;
    uint public lastPeriod = 0;
    uint public durationPeriod = 7 days;
    uint public startTime = 0;
    uint public rewardsForLastWeek = 0;
    uint public rewardFeesForLastWeek = 0;

    uint private _rewardFunds = 0;
    uint private _feeFunds = 0;

    mapping(address => uint) public stakerRewardsClaimed;
    mapping(address => uint) public stakerFeesClaimed;

    uint private _totalStakedAmount;
    uint private _totalPendingStake;
    uint private _totalUnclaimedRewards;
    uint private _totalUnlcaimedFees;
    uint private _totalRewardsClaimed;
    uint private _totalRewardFeesClaimed;

    mapping(address => uint) private _stakedBalances;
    mapping(address => uint) private _lastStakingWeek;
    mapping(address => uint) private _lastRewardsClaimedWeek;
    mapping(address => uint) private _lastUnstakeTime;
    mapping(address => uint) private _pendingStake;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _owner,
        address _escrowToken, //THALES
        address _stakingToken, //THALES
        address _feeToken //sUSD
    ) public Owned(_owner) {
        escrowToken = IEscrowThales(_escrowToken);
        stakingToken = IERC20(_stakingToken);
        feeToken = IERC20(_feeToken);
    }

    /* ========== VIEWS ========== */

    function totalStakedAmount() external view returns (uint) {
        return _totalStakedAmount;
    }

    function stakedBalanceOf(address account) external view returns (uint) {
        return _stakedBalances[account];
    }

    function getLastWeekRewards() external view returns (uint) {
        return rewardsForLastWeek;
    }

    function getLastWeekFees() external view returns (uint) {
        return rewardFeesForLastWeek;
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

    function getContractRewardFunds() external view onlyOwner returns (uint) {
        return _rewardFunds;
    }

    function getContractFeeFunds() external view onlyOwner returns (uint) {
        return _feeFunds;
    }

    /* ========== PUBLIC ========== */

    function startStakingPeriod() external onlyOwner {
        require(startTime == 0, "Staking has already started");
        startTime = block.timestamp;
        weeksOfStaking = 0;
        lastPeriod = startTime;
        _totalUnclaimedRewards = 0;
        _totalUnlcaimedFees = 0;
        _totalRewardsClaimed = 0;
        _totalRewardFeesClaimed = 0;
        _totalStakedAmount = 0;
        durationPeriod = 7 days;
    }

    function closePeriod() external nonReentrant notPaused {
        require(startTime > 0, "Staking period has not started");
        require(block.timestamp >= lastPeriod.add(durationPeriod), "7 days has not passed since the last closed period");

        // require(escrowToken.updateCurrentWeek(weeksOfStaking.add(1)), "Error in EscrowToken: check address of StakingToken");
        escrowToken.updateCurrentWeek(weeksOfStaking.add(1));

        lastPeriod = block.timestamp;
        weeksOfStaking = weeksOfStaking.add(1);
        if (_totalPendingStake > 0) {
            _totalStakedAmount = _totalStakedAmount.add(_totalPendingStake);
            _totalPendingStake = 0;
        }
        //Actions taken on every closed period
        rewardsForLastWeek = calculateRewardsForWeek(weeksOfStaking);
        rewardFeesForLastWeek = calculateFeesForWeek(weeksOfStaking);

        _totalUnclaimedRewards = _totalUnclaimedRewards.add(rewardsForLastWeek);
        _totalUnlcaimedFees = _totalUnlcaimedFees.add(rewardFeesForLastWeek);

        emit ClosedPeriod(weeksOfStaking, lastPeriod);
    }

    function stake(uint amount) external nonReentrant notPaused {
        require(startTime > 0, "Staking period has not started");
        require(amount > 0, "Cannot stake 0");
        require(
            _lastUnstakeTime[msg.sender] < block.timestamp.sub(7 days),
            "Cannot stake, the staker is paused from staking due to unstaking"
        );
        // Check if there are not claimable rewards from last week.
        // Claim them, and add new stake
        if (_lastRewardsClaimedWeek[msg.sender] < weeksOfStaking) {
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
        require(_lastUnstakeTime[msg.sender] < block.timestamp.sub(7 days), "Already initiated unstaking cooldown");
        _lastUnstakeTime[msg.sender] = block.timestamp;
        emit UnstakeCooldown(msg.sender, _lastUnstakeTime[msg.sender].add(7 days));
    }

    function unstake() external {
        require(msg.sender != address(0), "Invalid address");
        require(
            _lastUnstakeTime[msg.sender] < block.timestamp.sub(7 days),
            "Cannot stake, the staker is paused from staking due to unstaking"
        );
        if(_lastRewardsClaimedWeek[msg.sender] < weeksOfStaking) {
            claimReward();
        }
        //Lose the pending stake
        _pendingStake[msg.sender] = 0;
        _lastUnstakeTime[msg.sender] = block.timestamp;
        _totalStakedAmount = _totalStakedAmount.sub(_stakedBalances[msg.sender]);
        uint unstakeAmount = _stakedBalances[msg.sender];
        _stakedBalances[msg.sender] = 0;
        stakingToken.transfer(msg.sender, unstakeAmount);
        emit Unstaked(msg.sender, unstakeAmount);
    }

    function claimReward() public nonReentrant notPaused {
        require(startTime > 0, "Staking period has not started");
        require(
            _lastUnstakeTime[msg.sender] < block.timestamp.sub(7 days),
            "Cannot stake, the staker is paused from staking due to unstaking"
        );

        if (_pendingStake[msg.sender] > 0) {
            _stakedBalances[msg.sender] = _stakedBalances[msg.sender].add(_pendingStake[msg.sender]);
            _pendingStake[msg.sender] = 0;
        }
        //Calculate rewards
        uint unclaimedReward = calculateUnclaimedRewards(msg.sender);
        uint unclaimedFees = calculateUnclaimedFees(msg.sender);

        if (unclaimedFees > 0) {
            feeToken.transferFrom(address(this), msg.sender, unclaimedFees);
            stakerFeesClaimed[msg.sender] = stakerFeesClaimed[msg.sender].add(unclaimedFees);
            _totalRewardFeesClaimed = _totalRewardFeesClaimed.add(unclaimedFees);
            _totalUnlcaimedFees = _totalUnlcaimedFees.sub(unclaimedFees);
            emit FeeRewardsClaimed(msg.sender, unclaimedFees);
        }
        if (unclaimedReward > 0) {
            // Stake the newly claimed reward: NEEDS TO BE UPDATED NEXT WEEK ===>
            // _totalStakedAmount = _totalStakedAmount.add(unclaimedReward).add(unclaimedFees);
            // _totalPendingStake = _totalPendingStake.add(unclaimedReward).add(unclaimedFees);
            _totalPendingStake = _totalPendingStake.add(unclaimedReward);

            // Both the rewards and the fees are staked => new_stake(reward + fees) NEEDS TO BE UPDATED NEXT WEEK ===>
            // _stakedBalances[msg.sender] = _stakedBalances[msg.sender].add(unclaimedReward).add(unclaimedFees);
            // _pendingStake[msg.sender] = _pendingStake[msg.sender].add(unclaimedReward).add(unclaimedFees);
            _pendingStake[msg.sender] = _pendingStake[msg.sender].add(unclaimedReward);
            _lastStakingWeek[msg.sender] = weeksOfStaking;
            // Transfer THALES to Escrow contract
            escrowToken.addToEscrow(msg.sender, unclaimedReward);
            // Record the total claimed rewards
            stakerRewardsClaimed[msg.sender] = stakerRewardsClaimed[msg.sender].add(unclaimedReward);
            _totalRewardsClaimed = _totalRewardsClaimed.add(unclaimedReward);
            _totalUnclaimedRewards = _totalUnclaimedRewards.sub(unclaimedReward);
            emit RewardsClaimed(msg.sender, unclaimedReward);
        }
        // Update last claiming week
        _lastRewardsClaimedWeek[msg.sender] = weeksOfStaking;
    }

    function depositRewards(uint amount) external onlyOwner {
        require(amount > 0, "Invalid amount");
        stakingToken.transferFrom(msg.sender, address(this), amount);
        _rewardFunds = _rewardFunds.add(amount);
    }

    function depositFees(uint amount) external onlyOwner {
        require(amount > 0, "Invalid amount");
        feeToken.transferFrom(msg.sender, address(this), amount);
        _feeFunds = _feeFunds.add(amount);
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

        // return _stakedBalances[account].div(1e18).div(_totalStakedAmount).mul(rewardsForLastWeek);
        return _stakedBalances[account].mul(rewardsForLastWeek).div(_totalStakedAmount);
    }

    function calculateUnclaimedFees(address account) internal view returns (uint) {
        require(account != address(0), "Invalid account address used");
        require(_stakedBalances[account] > 0, "Account is not a staker");
        require(_lastRewardsClaimedWeek[account] < weeksOfStaking, "Rewards already claimed for last week");

        // return _stakedBalances[account].div(1e18).div(_totalStakedAmount).mul(rewardFeesForLastWeek);
        return _stakedBalances[account].mul(rewardFeesForLastWeek).div(_totalStakedAmount);
    }

    function calculateRewardsForWeek(uint week) internal view returns (uint) {
        //ADD formula
        require(week > 0, "Invalid number for week");
        if (week == 1) {
            require(stakingToken.balanceOf(address(this)) > 70000, "Low THALES balance in the Smart-contract");
            return 70000;
        }
        if (week > 1 && week < 48) {
            require(
                stakingToken.balanceOf(address(this)) >= week.sub(1).mul(2000).add(70000),
                "Low balance in the Smart-contract"
            );
            return week.sub(1).mul(2000).add(70000);
        } else {
            require(stakingToken.balanceOf(address(this)) >= 140000, "Low THALES balance in the Smart-contract");
            return 140000;
        }
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
    event ClosedPeriod(uint WeekOfStaking, uint lastPeriod);
    event RewardsClaimed(address account, uint unclaimedReward);
    event FeeRewardsClaimed(address account, uint unclaimedFees);
    event UnstakeCooldown(address account, uint cooldownTime);
    event Unstaked(address account, uint unstakeAmount);
}

pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/math/Math.sol";
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/SafeERC20.sol";
import "synthetix-2.43.1/contracts/SafeDecimalMath.sol";
import "openzeppelin-solidity-2.3.0/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity-2.3.0/contracts/utils/ReentrancyGuard.sol";
import "synthetix-2.43.1/contracts/Pausable.sol";

contract StakingThales is IERC20, Owned, ReentrancyGuard, Pausable {
    /* ========== LIBRARIES ========== */

    using SafeMath for uint;
    using SafeDecimalMath for uint;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IERC20 public rewardsToken;
    IERC20 public stakingToken;
    IERC20 public feeToken;

    uint public weeksOfStaking = 0;
    uint public lastPeriod = 0;
    uint public durationPeriod = 7 days;
    uint public startTime = 0;
    uint public rewardsForLastWeek = 0;
    uint public rewardFeesForLastWeek = 0;

    mapping(address => uint) public stakerRewardsClaimed;
    mapping(address => uint) public stakerFeesClaimed;

    uint private _totalSupply;
    uint private _totalRewardsClaimed;
    mapping(address => uint) private _balances;
    mapping(address => uint) private _lastStakingWeek;
    mapping(address => uint) private _lastRewardsClaimedWeek;
    mapping(address => bool) private _stakerCannotStake;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _owner,
        address _rewardsToken, //THALES
        address _stakingToken, //THALES
        address _feeToken //sUSD
    ) public Owned(_owner) {
        rewardsToken = IERC20(_rewardsToken);
        stakingToken = IERC20(_stakingToken);
        feeToken = IERC20(_feeToken);
    }

    /* ========== VIEWS ========== */

    function totalSupply() external view returns (uint) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint) {
        return _balances[account];
    }

    function getUnclaimedRewards(address account) external view returns (uint) {
        return calculateUnclaimedRewards(account);
    }

    function getUnclaimedRewardFees(address account) external view returns (uint) {
        return calculateUnclaimedFees(account);
    }

    function getAlreadyClaimedRewards(address account) external view returns (uint) {
        return stakerRewardsClaimed[account];
    }

    function getAlreadyClaimedFees(address account) external view returns (uint) {
        return stakerFeesClaimed[account];
    }

    /* ========== PUBLIC ========== */

    function startStakingPeriod() external onlyOwner {
        require(startTime == 0, "Staking has already started");
        startTime = block.timestamp;
        weeksOfStaking = 0;
        lastPeriod = startTime;
        durationPeriod = 7 days;
    }

    function closePeriod() external nonReentrant notPaused {
        require(startTime > 0, "Staking period has not started");
        require(block.timestamp >= lastPeriod.add(durationPeriod), "7 days has not passed since the last closed period");

        lastPeriod = block.timestamp;
        weeksOfStaking = weeksOfStaking.add(1);
        //Actions taken on every closed period
        rewardsForLastWeek = calculateRewardsForWeek(weeksOfStaking);
        rewardFeesForLastWeek = calculateFeesForWeek(weeksOfStaking);

        emit ClosedPeriod(weeksOfStaking, lastPeriod);
    }

    function stake(uint amount) external nonReentrant notPaused {
        require(startTime > 0, "Staking period has not started");
        require(amount > 0, "Cannot stake 0");
        require(
            _stakerCannotStake[msg.sender] == false,
            "Cannot stake, the staker is paused from staking due to withdrawal of rewards"
        );
        // Check if there are not claimable rewards from last week.
        // Claim them, and add new stake
        if (_lastRewardsClaimedWeek[msg.sender] < weeksOfStaking) {
            claimReward();
        }
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        _lastStakingWeek[msg.sender] = weeksOfStaking;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function unstake() external {}

    function claimReward() public nonReentrant notPaused {
        require(startTime > 0, "Staking period has not started");

        //Calculate rewards
        uint unclaimedReward = calculateUnclaimedRewards(msg.sender);
        uint unclaimedFees = calculateUnclaimedFees(msg.sender);

        if (unclaimedReward > 0) {
            _totalRewardsClaimed = _totalRewardsClaimed.add(unclaimedReward);
            // Stake the newly claimed reward:
            _totalSupply = _totalSupply.add(unclaimedReward);
            _balances[msg.sender] = _balances[msg.sender].add(unclaimedReward);
            _lastStakingWeek[msg.sender] = weeksOfStaking;
            // Transfer to Escrow contract
            stakingToken.addToEscrow(msg.sender, unclaimedReward);
            // Record the total claimed rewards
            stakerRewardsClaimed[msg.sender] = stakerRewardsClaimed[msg.sender].add(unclaimedReward);
            emit RewardsClaimed(msg.sender, unclaimedReward);
        }
        if (unclaimedFees > 0) {
            feeToken.transferFrom(address(this), msg.sender, unclaimedFees);
            stakerFeesClaimed[msg.sender] = stakerFeesClaimed[msg.sender].add(unclaimedFees);
            emit FeeRewardsClaimed(msg.sender, unclaimedFees);
        }
        // Update last claiming week
        _lastRewardsClaimedWeek[msg.sender] = weeksOfStaking;
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function calculateUnclaimedRewards(address account) internal view returns (uint) {
        require(account != address(0), "Invalid account address used");
        require(_balances[account] > 0, "Account is not a staker");
        require(_lastRewardsClaimedWeek[account] < weeksOfStaking, "Rewards already claimed for last week");

        // return _balances[account].div(1e18).div(_totalSupply).mul(rewardsForLastWeek);
        return _balances[account].div(_totalSupply).mul(rewardsForLastWeek);
    }

    function calculateUnclaimedFees(address account) internal view returns (uint) {
        require(account != address(0), "Invalid account address used");
        require(_balances[account] > 0, "Account is not a staker");
        require(_lastRewardsClaimedWeek[account] < weeksOfStaking, "Rewards already claimed for last week");

        // return _balances[account].div(1e18).div(_totalSupply).mul(rewardFeesForLastWeek);
        return _balances[account].div(_totalSupply).mul(rewardFeesForLastWeek);
    }

    function calculateRewardsForWeek(uint week) internal view returns (uint) {
        //ADD formula
        return 0;
    }

    function calculateFeesForWeek(uint week) internal view returns (uint) {
        //ADD formula
        return 0;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint reward);
    event Staked(address user, uint amount);
    event ClosedPeriod(uint WeekOfStaking, uint lastPeriod);
    event RewardsClaimed(address account, uint unclaimedReward);
    event FeeRewardsClaimed(address account, uint unclaimedFees);
}

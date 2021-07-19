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

    uint public weeksOfStakingFromDayZero = 0;
    uint public lastPeriod = 0;
    uint public durationPeriod = 7 days;
    uint public startTime = 0;

    mapping(address => uint) public rewards;
    mapping(address => uint) public rewardFees;
    mapping(address => uint) public stakerRewardsClaimed;
    mapping(address => uint) public stakerFeesClaimed;

    uint private _totalSupply;
    mapping(address => uint) private _balances;
    mapping(address => uint) private _stakersPointers;
    mapping(address => uint) private _stakingTime;
    mapping(address => uint) private _stakingWeek;
    mapping(address => uint) private _discountOnLateStaking;
    mapping(address => bool) private _stakerCannotClaimRewardsOrStake;

    address[] private _stakers;

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

    function stake(uint amount) external nonReentrant notPaused {
        require(amount > 0, "Cannot stake 0");
        if (isStaker(msg.sender)) {
            require(
                _stakerCannotClaimRewardsOrStake[msg.sender] == false,
                "Cannot stake, the staker is paused from staking due to withdrawal of rewards"
            );
            // claimRewards();
        } else {
            registerStaker(msg.sender);
        }
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        _stakingTime[msg.sender] = block.timestamp;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function unstake() external {}

    function claimReward() public nonReentrant notPaused {
        require(isStaker(msg.sender), "The account is not staker");
        require((lastPeriod >= _stakingTime[msg.sender].add(28 days)), "4 weeks has not passed since the last stake");
        uint unclaimedReward = CalculateUnclaimedRewards(msg.sender);
        rewards[msg.sender] = rewards[msg.sender].add(unclaimedReward);
        emit RewardsClaimed(msg.sender, unclaimedReward);
    }

    function CalculateUnclaimedRewards(address account) public view returns (uint) {
        require(isStaker(msg.sender), "The account is not a staker");
        //TO BE added
    }

    function startStakingPeriod() external onlyOwner {
        require(startTime == 0, "Staking has already started");
        startTime = block.timestamp;
        weeksOfStakingFromDayZero = 0;
        lastPeriod = startTime;
        durationPeriod = 7 days;
    }

    function closePeriod() external nonReentrant notPaused {
        require(startTime > 0, "Staking period has not started");
        require(block.timestamp >= lastPeriod.add(durationPeriod), "7 days has not passed since the last closed period");

        //Actions taken on every closed period

        lastPeriod = block.timestamp;
        weeksOfStakingFromDayZero = weeksOfStakingFromDayZero.add(1);
        emit ClosedStakingPeriod(weeksOfStakingFromDayZero, lastPeriod);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function isStaker(address account) internal view returns (bool) {
        require(account != address(0), "Invalid account address used");
        if (_stakers.length == 0) {
            return false;
        }
        return (_stakers[_stakersPointers[account]] == account);
    }

    function registerStaker(address account) internal nonReentrant notPaused {
        require(account != address(0), "Invalid account address used");
        require(_stakers[_stakersPointers[account]] != account, "Staker already registered");
        _stakersPointers[msg.sender] = _stakers.push(msg.sender).sub(1);
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint reward);
    event Staked(address indexed user, uint amount);
    event ClosedStakingPeriod(uint WeekOfStaking, uint lastPeriod);
    event RewardsClaimed(address account, uint unclaimedReward);
}

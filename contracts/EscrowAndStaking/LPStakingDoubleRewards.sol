// SPDX-License-Identifier: MIT
pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/math/SafeMath.sol";
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/upgrades-core/contracts/Initializable.sol";

import "../utils/proxy/ProxyReentrancyGuard.sol";
import "../utils/proxy/ProxyOwned.sol";
import "../utils/proxy/ProxyPausable.sol";

contract LPStakingDoubleRewards is Initializable, ProxyOwned, ProxyReentrancyGuard, ProxyPausable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IERC20 public rewardsToken;
    IERC20 public stakingToken;
    IERC20 public secondRewardsToken;
    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public secondRewardRate;

    uint256 public rewardsDuration;
    uint256 public totalRewards;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public rewardPerSecondTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public userRewardPerSecondTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public secondRewards;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;


    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        address _rewardsToken,
        address _secondRewardsToken,
        address _stakingToken,
        uint256 _rewardsDuration
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        rewardsToken = IERC20(_rewardsToken);
        secondRewardsToken = IERC20(_secondRewardsToken);
        stakingToken = IERC20(_stakingToken);
        rewardsDuration = _rewardsDuration;
    }

    /* ========== VIEWS ========== */

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256 reward, uint256 secondReward) {
        if (_totalSupply == 0) {
            reward = rewardPerTokenStored;
            secondReward = rewardPerSecondTokenStored;
        } else {
            reward = rewardPerTokenStored.add(
                lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRate).mul(1e18).div(_totalSupply)
            );
            secondReward = rewardPerSecondTokenStored.add(
                lastTimeRewardApplicable().sub(lastUpdateTime).mul(secondRewardRate).mul(1e18).div(_totalSupply)
            );
        }
    }

    function earned(address account) public view returns (uint256 earnedFirstToken, uint256 earnedSecondToken) {
        (uint256 firstReward, uint256 secondReward) = rewardPerToken();
        earnedFirstToken = _balances[account].mul(firstReward.sub(userRewardPerTokenPaid[account])).div(1e18).add(
            rewards[account]
        );

        earnedSecondToken = _balances[account].mul(secondReward.sub(userRewardPerSecondTokenPaid[account])).div(1e18).add(
            secondRewards[account]
        );
    }

    function getRewardForDuration() external view returns (uint256) {
        return rewardRate.mul(rewardsDuration);
    }

    function getSecondRewardForDuration() external view returns (uint256) {
        return secondRewardRate.mul(rewardsDuration);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stake(uint256 amount) external nonReentrant notPaused updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getReward() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        uint256 secondReward = secondRewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardsToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }

        if (secondReward > 0) {
            secondRewards[msg.sender] = 0;
            secondRewardsToken.safeTransfer(msg.sender, secondReward);
            emit SecondRewardTokenPaid(msg.sender, secondReward);
        }
    }

    function exit() external {
        withdraw(_balances[msg.sender]);
        getReward();
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function notifyRewardAmount(uint256 reward, uint256 secondReward) external onlyOwner updateReward(address(0)) {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward.div(rewardsDuration);
            secondRewardRate = secondReward.div(rewardsDuration);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            uint256 secondLeftover = remaining.mul(secondRewardRate);

            rewardRate = reward.add(leftover).div(rewardsDuration);
            secondRewardRate = secondReward.add(secondLeftover).div(rewardsDuration);
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate/secondRewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint balance = rewardsToken.balanceOf(address(this));
        require(rewardRate <= balance.div(rewardsDuration), "Provided reward too high");

        uint balanceSecondReward = secondRewardsToken.balanceOf(address(this));
        require(secondRewardRate <= balanceSecondReward.div(rewardsDuration), "Provided reward too high");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);
        emit BothRewardsAdded(reward, secondReward);
    }

    function addReward(uint256 reward) external onlyOwner updateReward(address(0)) {
        require(block.timestamp < periodFinish, "Rewards must be active");

        uint256 remaining = periodFinish.sub(block.timestamp);
        uint256 leftover = remaining.mul(rewardRate);
        rewardRate = reward.add(leftover).div(remaining);

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint balance = rewardsToken.balanceOf(address(this));
        require(rewardRate <= balance.div(remaining), "Provided reward too high");

        lastUpdateTime = block.timestamp;
        emit RewardAdded(reward);
    }

    function addSecondReward(uint256 reward) external onlyOwner updateReward(address(0)) {
        require(block.timestamp < periodFinish, "Rewards must be active");

        uint256 remaining = periodFinish.sub(block.timestamp);
        uint256 leftover = remaining.mul(secondRewardRate);
        secondRewardRate = reward.add(leftover).div(remaining);

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of secondRewardRate in the earned and rewardsPerOpToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint balance = secondRewardsToken.balanceOf(address(this));
        require(secondRewardRate <= balance.div(remaining), "Provided reward too high");

        lastUpdateTime = block.timestamp;
        emit SecondRewardAdded(reward);
    }

    function addBothRewards(uint256 reward, uint256 secondReward) external onlyOwner updateReward(address(0)) {
        require(block.timestamp < periodFinish, "Rewards must be active");

        uint256 remaining = periodFinish.sub(block.timestamp);
        uint256 leftover = remaining.mul(rewardRate);
        rewardRate = reward.add(leftover).div(remaining);

        uint256 secondLeftover = remaining.mul(secondRewardRate);
        secondRewardRate = secondReward.add(secondLeftover).div(remaining);

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate/secondRewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint balance = rewardsToken.balanceOf(address(this));
        require(rewardRate <= balance.div(remaining), "Provided reward too high");

        uint secondBalance = secondRewardsToken.balanceOf(address(this));
        require(secondRewardRate <= secondBalance.div(remaining), "Provided reward too high");

        lastUpdateTime = block.timestamp;
        emit BothRewardsAdded(reward, secondReward);
    }

    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != address(stakingToken), "Cannot withdraw the staking token");
        IERC20(tokenAddress).safeTransfer(owner, tokenAmount);
    }

    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        require(
            block.timestamp > periodFinish,
            "Previous rewards period must be complete before changing the duration for the new period"
        );
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(rewardsDuration);
    }

    function setSecondRewardsToken(address tokenAddress) external onlyOwner {
        require(tokenAddress != address(0), "Invalid address");
        secondRewardsToken = IERC20(tokenAddress);
        emit SecondRewardsTokenChanged(tokenAddress);
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        (rewardPerTokenStored, rewardPerSecondTokenStored) = rewardPerToken();

        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            (rewards[account], secondRewards[account]) = earned(account);

            userRewardPerTokenPaid[account] = rewardPerTokenStored;
            userRewardPerSecondTokenPaid[account] = rewardPerSecondTokenStored;
        }
        _;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event SecondRewardAdded(uint256 reward);
    event BothRewardsAdded(uint256 reward, uint256 secondReward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event SecondRewardTokenPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event SecondRewardsTokenChanged(address tokenAddress);
}

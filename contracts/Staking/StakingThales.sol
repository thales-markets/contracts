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

    uint public periodsOfStaking = 0;
    uint public lastPeriodTimeStamp = 0;
    uint public durationPeriod = 7 days;
    uint public unstakeDurationPeriod = 7 days;
    uint public startTimeStamp = 0;
    uint public currentPeriodRewards = 0;
    uint public currentPeriodFees = 0;
    bool public distributeFeesEnabled = false;
    uint public fixedPeriodReward = 0;
    bool public claimEnabled = false;

    mapping(address => uint) public stakerRewardsClaimed;
    mapping(address => uint) public stakerFeesClaimed;

    uint private _totalStakedAmount;
    uint private _totalEscrowedAmount;
    uint private _totalPendingStakeAmount;
    uint private _totalUnclaimedRewards;
    uint private _totalUnclaimedFees;
    uint private _totalRewardsClaimed;
    uint private _totalRewardFeesClaimed;

    mapping(address => uint) public _lastUnstakeTime;
    mapping(address => bool) public unstaking;
    mapping(address => uint) private _stakedBalances;
    mapping(address => uint) private _lastStakingPeriod;
    mapping(address => uint) private _lastRewardsClaimedPeriod;
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

    function getLastPeriodOfClaimedRewards(address account) external view returns (uint) {
        return _lastRewardsClaimedPeriod[account];
    }

    function getRewardsAvailable(address account) external view returns (uint) {
        return _calculateUnclaimedRewards(account);
    }

    function getRewardFeesAvailable(address account) external view returns (uint) {
        return _calculateUnclaimedFees(account);
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
        emit DistributeFeesEnabled(_distributeFeesEnabled);
    }

    function setFixedPeriodReward(uint _fixedReward) external onlyOwner {
        fixedPeriodReward = _fixedReward;
        emit FixedPeriodRewardChanged(_fixedReward);
    }

    function setClaimEnabled(bool _claimEnabled) external onlyOwner {
        claimEnabled = _claimEnabled;
        emit ClaimEnabled(_claimEnabled);
    }

    function setDurationPeriod(uint _durationPeriod) external onlyOwner {
        durationPeriod = _durationPeriod;
        emit DurationPeriodChanged(_durationPeriod);
    }

    function setUnstakeDurationPeriod(uint _unstakeDurationPeriod) external onlyOwner {
        unstakeDurationPeriod = _unstakeDurationPeriod;
        emit UnstakeDurationPeriodChanged(_unstakeDurationPeriod);
    }

    // Set EscrowThales contract address
    function setEscrow(address _escrowThalesContract) public onlyOwner {
        if (address(iEscrowThales) != address(0)) {
            stakingToken.approve(address(iEscrowThales), 0);
        }
        iEscrowThales = IEscrowThales(_escrowThalesContract);
        stakingToken.approve(_escrowThalesContract, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
        emit EscrowChanged(_escrowThalesContract);
    }

    /* ========== PUBLIC ========== */

    function startStakingPeriod() external onlyOwner {
        require(startTimeStamp == 0, "Staking has already started");
        startTimeStamp = block.timestamp;
        periodsOfStaking = 0;
        lastPeriodTimeStamp = startTimeStamp;
        _totalUnclaimedRewards = 0;
        _totalUnclaimedFees = 0;
        _totalRewardsClaimed = 0;
        _totalRewardFeesClaimed = 0;
        _totalStakedAmount = 0;
        _totalEscrowedAmount = 0;
        _totalPendingStakeAmount = 0;
        durationPeriod = 7 days;
        unstakeDurationPeriod = 7 days;
        emit StakingPeriodStarted();
    }

    function closePeriod() external nonReentrant notPaused {
        require(startTimeStamp > 0, "Staking period has not started");
        require(
            block.timestamp >= lastPeriodTimeStamp.add(durationPeriod),
            "A full period has not passed since the last closed period"
        );

        iEscrowThales.updateCurrentPeriod();
        lastPeriodTimeStamp = block.timestamp;
        periodsOfStaking = iEscrowThales.periodsOfVesting();

        _totalEscrowedAmount = iEscrowThales.getTotalEscrowedRewards();

        //Actions taken on every closed period
        currentPeriodRewards = fixedPeriodReward;
        _totalUnclaimedRewards = _totalUnclaimedRewards.add(currentPeriodRewards);

        if (distributeFeesEnabled) {
            currentPeriodFees = feeToken.balanceOf(address(this));
            _totalUnclaimedFees = _totalUnclaimedFees.add(currentPeriodFees);
        }

        emit ClosedPeriod(periodsOfStaking, lastPeriodTimeStamp);
    }

    function stake(uint amount) external nonReentrant notPaused {
        require(startTimeStamp > 0, "Staking period has not started");
        require(amount > 0, "Cannot stake 0");
        require(
            stakingToken.allowance(msg.sender, address(this)) >= amount,
            "No allowance. Please grant StakingThales allowance"
        );
        require(unstaking[msg.sender] == false, "Cannot stake, the staker is paused from staking due to unstaking");
        // Check if there are not claimable rewards from last period.
        // Claim them, and add new stake
        if ((_lastRewardsClaimedPeriod[msg.sender] < periodsOfStaking) && claimEnabled && _stakedBalances[msg.sender] > 0) {
            claimReward();
        }
        _totalStakedAmount = _totalStakedAmount.add(amount);
        _stakedBalances[msg.sender] = _stakedBalances[msg.sender].add(amount);
        _lastStakingPeriod[msg.sender] = periodsOfStaking;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function startUnstake() external {
        require(_stakedBalances[msg.sender] > 0, "Account has nothing to unstake");
        require(unstaking[msg.sender] == false, "Account has already triggered unstake cooldown");

        if ((_lastRewardsClaimedPeriod[msg.sender] < periodsOfStaking) && claimEnabled) {
            claimReward();
        }
        _lastUnstakeTime[msg.sender] = block.timestamp;
        unstaking[msg.sender] = true;
        _totalStakedAmount = _totalStakedAmount.sub(_stakedBalances[msg.sender]);
        emit UnstakeCooldown(
            msg.sender,
            _lastUnstakeTime[msg.sender].add(unstakeDurationPeriod),
            _stakedBalances[msg.sender]
        );
    }

    function unstake() external {
        require(unstaking[msg.sender] == true, "Account has not triggered unstake cooldown");
        require(
            _lastUnstakeTime[msg.sender] < block.timestamp.sub(unstakeDurationPeriod),
            "Cannot unstake yet, cooldown not expired."
        );
        unstaking[msg.sender] = false;
        uint unstakeAmount = _stakedBalances[msg.sender];
        _stakedBalances[msg.sender] = 0;
        stakingToken.safeTransfer(msg.sender, unstakeAmount);
        emit Unstaked(msg.sender, unstakeAmount);
    }

    function claimReward() public nonReentrant notPaused {
        require(claimEnabled, "Claiming is not enabled.");
        require(startTimeStamp > 0, "Staking period has not started");
        require(unstaking[msg.sender] == false, "Cannot claim rewards, the staker is paused from staking due to unstaking");

        //Calculate rewards
        if (distributeFeesEnabled) {
            uint unclaimedFees = _calculateUnclaimedFees(msg.sender);
            if (unclaimedFees > 0) {
                feeToken.safeTransfer(msg.sender, unclaimedFees);
                stakerFeesClaimed[msg.sender] = stakerFeesClaimed[msg.sender].add(unclaimedFees);
                _totalRewardFeesClaimed = _totalRewardFeesClaimed.add(unclaimedFees);
                _totalUnclaimedFees = _totalUnclaimedFees.sub(unclaimedFees);
                emit FeeRewardsClaimed(msg.sender, unclaimedFees);
            }
        }
        uint unclaimedReward = _calculateUnclaimedRewards(msg.sender);
        if (unclaimedReward > 0) {
            _lastStakingPeriod[msg.sender] = periodsOfStaking;
            // Transfer THALES to Escrow contract
            iEscrowThales.addToEscrow(msg.sender, unclaimedReward);
            // Record the total claimed rewards
            stakerRewardsClaimed[msg.sender] = stakerRewardsClaimed[msg.sender].add(unclaimedReward);
            _totalRewardsClaimed = _totalRewardsClaimed.add(unclaimedReward);
            _totalUnclaimedRewards = _totalUnclaimedRewards.sub(unclaimedReward);

            emit RewardsClaimed(msg.sender, unclaimedReward);
        }
        // Update last claiming period
        _lastRewardsClaimedPeriod[msg.sender] = periodsOfStaking;
    }

    function selfDestruct(address payable account) external onlyOwner {
        stakingToken.safeTransfer(account, stakingToken.balanceOf(address(this)));
        feeToken.safeTransfer(account, feeToken.balanceOf(address(this)));
        selfdestruct(account);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function _calculateUnclaimedRewards(address account) internal view returns (uint) {
        require(account != address(0), "Invalid account address used");
        require(_stakedBalances[account] > 0, "Account is not a staker");
        require(_lastRewardsClaimedPeriod[account] < periodsOfStaking, "Rewards already claimed for last period");

        if (unstaking[account] == true) {
            return 0;
        }
        // return _stakedBalances[account].div(1e18).div(_totalStakedAmount).mul(currentPeriodRewards);
        return
            _stakedBalances[account].add(iEscrowThales.getStakedEscrowedBalance(account)).mul(currentPeriodRewards).div(
                _totalStakedAmount.add(_totalEscrowedAmount)
            );
    }

    function _calculateUnclaimedFees(address account) internal view returns (uint) {
        require(account != address(0), "Invalid account address used");
        require(_stakedBalances[account] > 0, "Account is not a staker");
        require(_lastRewardsClaimedPeriod[account] < periodsOfStaking, "Rewards already claimed for last period");
        return
            _stakedBalances[account].add(iEscrowThales.getStakedEscrowedBalance(account)).mul(currentPeriodFees).div(
                _totalStakedAmount.add(_totalEscrowedAmount)
            );
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint reward);
    event Staked(address user, uint amount);
    event ClosedPeriod(uint PeriodOfStaking, uint lastPeriodTimeStamp);
    event RewardsClaimed(address account, uint unclaimedReward);
    event FeeRewardsClaimed(address account, uint unclaimedFees);
    event UnstakeCooldown(address account, uint cooldownTime, uint amount);
    event Unstaked(address account, uint unstakeAmount);
    event ClaimEnabled(bool enabled);
    event DistributeFeesEnabled(bool enabled);
    event FixedPeriodRewardChanged(uint value);
    event DurationPeriodChanged(uint value);
    event UnstakeDurationPeriodChanged(uint value);
    event EscrowChanged(address newEscrow);
    event StakingPeriodStarted();
}

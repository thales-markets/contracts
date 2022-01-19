pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity-2.3.0/contracts/math/SafeMath.sol";

import "../utils/proxy/ProxyReentrancyGuard.sol";
import "../utils/proxy/ProxyOwned.sol";
import "../utils/proxy/ProxyPausable.sol";
import "@openzeppelin/upgrades-core/contracts/Initializable.sol";

import "../interfaces/IEscrowThales.sol";
import "../interfaces/IStakingThales.sol";
import "../interfaces/ISNXRewards.sol";
import "../interfaces/IThalesRoyale.sol";
import "../interfaces/IPriceFeed.sol";

contract StakingThales is IStakingThales, Initializable, ProxyOwned, ProxyReentrancyGuard, ProxyPausable {
    /* ========== LIBRARIES ========== */

    using SafeMath for uint;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IEscrowThales public iEscrowThales;
    IERC20 public stakingToken;
    IERC20 public feeToken;
    ISNXRewards public SNXRewards;
    IThalesRoyale public thalesRoyale;
    IPriceFeed public priceFeed;

    uint public periodsOfStaking;
    uint public lastPeriodTimeStamp;
    uint public durationPeriod;
    uint public unstakeDurationPeriod;
    uint public startTimeStamp;
    uint public currentPeriodRewards;
    uint public currentPeriodFees;
    bool public distributeFeesEnabled;
    uint public fixedPeriodReward;
    uint public periodExtraReward;
    uint public totalSNXRewardsInPeriod;
    uint public totalSNXFeesInPeriod;
    bool public claimEnabled;

    mapping(address => uint) public stakerLifetimeRewardsClaimed;
    mapping(address => uint) public stakerFeesClaimed;

    uint private _totalStakedAmount;
    uint private _totalEscrowedAmount;
    uint private _totalPendingStakeAmount;
    uint private _totalUnclaimedRewards;
    uint private _totalRewardsClaimed;
    uint private _totalRewardFeesClaimed;

    mapping(address => uint) public lastUnstakeTime;
    mapping(address => bool) public unstaking;
    mapping(address => uint) public unstakingAmount;
    mapping(address => uint) private _stakedBalances;
    mapping(address => uint) private _lastRewardsClaimedPeriod;
    address public thalesAMM;

    uint constant HUNDRED = 100;
    uint constant AMM_EXTRA_REWARD_PERIODS = 4;

    struct AMMVolumeEntry {
        uint amount;
        uint period;
    }
    mapping(address => uint) private lastAMMUpdatePeriod;
    mapping(address => AMMVolumeEntry[AMM_EXTRA_REWARD_PERIODS]) private stakerAMMVolume;

    bool public extraRewardsActive;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        address _iEscrowThales, //THALES
        address _stakingToken, //THALES
        address _feeToken, //sUSD
        uint _durationPeriod,
        uint _unstakeDurationPeriod,
        address _ISNXRewards
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        iEscrowThales = IEscrowThales(_iEscrowThales);
        stakingToken = IERC20(_stakingToken);
        feeToken = IERC20(_feeToken);
        stakingToken.approve(_iEscrowThales, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
        durationPeriod = _durationPeriod;
        unstakeDurationPeriod = _unstakeDurationPeriod;
        fixedPeriodReward = 100000 * 1e18;
        periodExtraReward = 20000 * 1e18;
        SNXRewards = ISNXRewards(_ISNXRewards);
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
        return _calculateAvailableRewardsToClaim(account);
    }

    function getRewardFeesAvailable(address account) external view returns (uint) {
        return _calculateAvailableFeesToClaim(account);
    }

    function getAlreadyClaimedRewards(address account) external view returns (uint) {
        return stakerLifetimeRewardsClaimed[account];
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

    function setPeriodExtraReward(uint _extraReward) external onlyOwner {
        periodExtraReward = _extraReward;
        emit PeriodExtraRewardChanged(_extraReward);
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

    function setSNXRewards(address _snxRewards) public onlyOwner {
        require(_snxRewards != address(0), "Invalid address");
        SNXRewards = ISNXRewards(_snxRewards);
        emit SNXRewardsAddressChanged(_snxRewards);
    }
    
    function setExtraRewards(bool _extraRewardsActive) public onlyOwner {
        extraRewardsActive = _extraRewardsActive;
        emit ExtraRewardsChanged(_extraRewardsActive);
    }

    function setThalesRoyale(address _royale) public onlyOwner {
        require(_royale != address(0), "Invalid address");
        thalesRoyale = IThalesRoyale(_royale);
        emit ThalesRoyaleAddressChanged(_royale);
    }

    function setThalesAMM(address _thalesAMM) public onlyOwner {
        require(_thalesAMM != address(0), "Invalid address");
        thalesAMM = _thalesAMM;
        emit ThalesAMMAddressChanged(_thalesAMM);
    }
    
    function setPriceFeed(address _priceFeed) public onlyOwner {
        require(_priceFeed != address(0), "Invalid address");
        priceFeed = IPriceFeed(_priceFeed);
        emit PriceFeedAddressChanged(_priceFeed);
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
        _totalRewardsClaimed = 0;
        _totalRewardFeesClaimed = 0;
        _totalStakedAmount = 0;
        _totalEscrowedAmount = 0;
        _totalPendingStakeAmount = 0;
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
        periodsOfStaking = iEscrowThales.currentVestingPeriod();

        _totalEscrowedAmount = iEscrowThales.totalEscrowedRewards().sub(
            iEscrowThales.totalEscrowBalanceNotIncludedInStaking()
        );

        //Actions taken on every closed period
        currentPeriodRewards = fixedPeriodReward;
        _totalUnclaimedRewards = _totalUnclaimedRewards.add(currentPeriodRewards.add(periodExtraReward));

        currentPeriodFees = feeToken.balanceOf(address(this));

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
            _claimReward(msg.sender);
        }

        // if just started staking subtract his escrowed balance from totalEscrowBalanceNotIncludedInStaking
        if (_stakedBalances[msg.sender] == 0) {
            if (iEscrowThales.totalAccountEscrowedAmount(msg.sender) > 0) {
                iEscrowThales.subtractTotalEscrowBalanceNotIncludedInStaking(
                    iEscrowThales.totalAccountEscrowedAmount(msg.sender)
                );
            }
        }

        _totalStakedAmount = _totalStakedAmount.add(amount);
        _stakedBalances[msg.sender] = _stakedBalances[msg.sender].add(amount);
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, amount);
    }

    function startUnstake(uint amount) external {
        require(amount > 0, "Cannot unstake 0");
        require(_stakedBalances[msg.sender] >= amount, "Account doesnt have that much staked");
        require(unstaking[msg.sender] == false, "Account has already triggered unstake cooldown");

        if ((_lastRewardsClaimedPeriod[msg.sender] < periodsOfStaking) && claimEnabled) {
            claimReward();
        }
        lastUnstakeTime[msg.sender] = block.timestamp;
        unstaking[msg.sender] = true;
        _totalStakedAmount = _totalStakedAmount.sub(amount);
        unstakingAmount[msg.sender] = amount;
        _stakedBalances[msg.sender] = _stakedBalances[msg.sender].sub(amount);

        // on full unstake add his escrowed balance to totalEscrowBalanceNotIncludedInStaking
        if (_stakedBalances[msg.sender] == 0) {
            if (iEscrowThales.totalAccountEscrowedAmount(msg.sender) > 0) {
                iEscrowThales.addTotalEscrowBalanceNotIncludedInStaking(
                    iEscrowThales.totalAccountEscrowedAmount(msg.sender)
                );
            }
        }

        emit UnstakeCooldown(msg.sender, lastUnstakeTime[msg.sender].add(unstakeDurationPeriod), amount);
    }

    function cancelUnstake() external {
        require(unstaking[msg.sender] == true, "Account is not unstaking");

        // on revert full unstake remove his escrowed balance from totalEscrowBalanceNotIncludedInStaking
        if (_stakedBalances[msg.sender] == 0) {
            if (iEscrowThales.totalAccountEscrowedAmount(msg.sender) > 0) {
                iEscrowThales.subtractTotalEscrowBalanceNotIncludedInStaking(
                    iEscrowThales.totalAccountEscrowedAmount(msg.sender)
                );
            }
        }

        unstaking[msg.sender] = false;
        _totalStakedAmount = _totalStakedAmount.add(unstakingAmount[msg.sender]);
        _stakedBalances[msg.sender] = _stakedBalances[msg.sender].add(unstakingAmount[msg.sender]);
        unstakingAmount[msg.sender] = 0;

        emit CancelUnstake(msg.sender);
    }

    function unstake() external {
        require(unstaking[msg.sender] == true, "Account has not triggered unstake cooldown");
        require(
            lastUnstakeTime[msg.sender] < block.timestamp.sub(unstakeDurationPeriod),
            "Cannot unstake yet, cooldown not expired."
        );
        unstaking[msg.sender] = false;
        uint unstakeAmount = unstakingAmount[msg.sender];
        stakingToken.safeTransfer(msg.sender, unstakeAmount);
        unstakingAmount[msg.sender] = 0;
        emit Unstaked(msg.sender, unstakeAmount);
    }

    function claimReward() public nonReentrant notPaused {
        _claimReward(msg.sender);
    }

    function updateVolume(address account, uint amount) external {
        require(msg.sender == address(thalesAMM), "Invalid address");
        require(msg.sender != address(0), "Invalid address");
        if (_stakedBalances[account] > 0) {
            if (lastAMMUpdatePeriod[account] < periodsOfStaking) {
                stakerAMMVolume[account][periodsOfStaking.mod(AMM_EXTRA_REWARD_PERIODS)].amount = 0;
                stakerAMMVolume[account][periodsOfStaking.mod(AMM_EXTRA_REWARD_PERIODS)].period = periodsOfStaking;
                lastAMMUpdatePeriod[account] = periodsOfStaking;
            }
            stakerAMMVolume[account][periodsOfStaking.mod(AMM_EXTRA_REWARD_PERIODS)].amount = stakerAMMVolume[account][
                periodsOfStaking.mod(AMM_EXTRA_REWARD_PERIODS)
            ]
                .amount
                .add(amount);
            emit AMMVolumeUpdated(account, amount);
        }
    }

    /*  Selfdestruct operation potentially harmful for proxy contracts
     */
    // function selfDestruct(address payable account) external onlyOwner {
    //     stakingToken.safeTransfer(account, stakingToken.balanceOf(address(this)));
    //     feeToken.safeTransfer(account, feeToken.balanceOf(address(this)));
    //     selfdestruct(account);
    // }

    /* ========== INTERNAL FUNCTIONS ========== */

    function _claimReward(address account) internal notPaused {
        require(claimEnabled, "Claiming is not enabled.");
        require(startTimeStamp > 0, "Staking period has not started");

        //Calculate rewards
        if (distributeFeesEnabled) {
            uint availableFeesToClaim = _calculateAvailableFeesToClaim(account);
            if (availableFeesToClaim > 0) {
                feeToken.safeTransfer(account, availableFeesToClaim);
                stakerFeesClaimed[account] = stakerFeesClaimed[account].add(availableFeesToClaim);
                _totalRewardFeesClaimed = _totalRewardFeesClaimed.add(availableFeesToClaim);
                emit FeeRewardsClaimed(account, availableFeesToClaim);
            }
        }
        uint availableRewardsToClaim = _calculateAvailableRewardsToClaim(account);
        if (availableRewardsToClaim > 0) {
            // Transfer THALES to Escrow contract
            iEscrowThales.addToEscrow(account, availableRewardsToClaim);
            // Record the total claimed rewards
            stakerLifetimeRewardsClaimed[account] = stakerLifetimeRewardsClaimed[account].add(availableRewardsToClaim);
            _totalRewardsClaimed = _totalRewardsClaimed.add(availableRewardsToClaim);
            _totalUnclaimedRewards = _totalUnclaimedRewards.sub(availableRewardsToClaim);

            emit RewardsClaimed(account, availableRewardsToClaim);
        }
        // Update last claiming period
        _lastRewardsClaimedPeriod[account] = periodsOfStaking;
    }

    function _calculateAvailableRewardsToClaim(address account) internal view returns (uint) {
        if ((_stakedBalances[account] == 0) || (_lastRewardsClaimedPeriod[account] == periodsOfStaking)) {
            return 0;
        }
        uint baseReward =
            _stakedBalances[account]
                .add(iEscrowThales.getStakedEscrowedBalanceForRewards(account))
                .mul(currentPeriodRewards)
                .div(_totalStakedAmount.add(_totalEscrowedAmount));
        uint totalReward = _calculateExtraReward(account, baseReward);
        return totalReward;
    }

    function _calculateAvailableFeesToClaim(address account) internal view returns (uint) {
        if ((_stakedBalances[account] == 0) || (_lastRewardsClaimedPeriod[account] == periodsOfStaking)) {
            return 0;
        }
        
        return
            _stakedBalances[account]
                .add(iEscrowThales.getStakedEscrowedBalanceForRewards(account))
                .mul(currentPeriodFees)
                .div(_totalStakedAmount.add(_totalEscrowedAmount));
    }

    function _calculateExtraReward(address account, uint baseReward) internal view returns (uint) {
        if(!extraRewardsActive) {
            return baseReward;
        }

        uint extraReward = HUNDRED;
        uint stakedSNX = _getSNXStakedForAccount(account);

        // SNX staked more than base reward
        extraReward = stakedSNX >= baseReward ? extraReward = extraReward.add(15) : extraReward.add(stakedSNX.mul(15).div(baseReward));
        // AMM Volume 10x Thales base reward
        extraReward = _getTotalAMMVolume(account) >= baseReward.mul(10) ? extraReward.add(12) : extraReward.add(_getTotalAMMVolume(account).div(AMM_EXTRA_REWARD_PERIODS).mul(12).div(baseReward.mul(10)));
        // ThalesRoyale participation
        extraReward = (address(thalesRoyale) != address(0) && thalesRoyale.hasParticipatedInCurrentOrLastRoyale(account)) ? extraReward.add(3) : extraReward;

        return baseReward.mul(extraReward).div(HUNDRED);
    }

    function getSNXStaked(address account) external view returns (uint) {
        // return priceFeed.rateForCurrency("SNX");
        // return SNXRewards.debtBalanceOf(account, "SNX");
        // (uint cRatio, ) = SNXRewards.collateralisationRatioAndAnyRatesInvalid(account);
        // return cRatio;
        // return SNXRewards.debtBalanceOf(account, "SNX");
        return _getSNXStakedForAccount(account);
    }

    function _getSNXStakedForAccount(address account) internal view returns (uint) {
        (uint cRatio, ) = SNXRewards.collateralisationRatioAndAnyRatesInvalid(account);
        uint issuanceRatio = SNXRewards.issuanceRatio();
        uint snxPrice = priceFeed.rateForCurrency("SNX");
        uint debt = SNXRewards.debtBalanceOf(account, "SNX");
        if(cRatio < issuanceRatio) {
            return (cRatio.mul(cRatio).mul(debt)).div(issuanceRatio.mul(snxPrice).mul(HUNDRED));
        }
        else {
            return (cRatio.mul(debt)).div(snxPrice.mul(HUNDRED));
        }
    }

    function _getTotalAMMVolume(address account) internal view returns (uint) {
        uint totalAMMforAccount;
        if (periodsOfStaking >= lastAMMUpdatePeriod[account].add(AMM_EXTRA_REWARD_PERIODS)) {
            return 0;
        }
        for (uint i = 0; i < AMM_EXTRA_REWARD_PERIODS; i++) {
            if (periodsOfStaking < stakerAMMVolume[account][i].period.add(AMM_EXTRA_REWARD_PERIODS))
                totalAMMforAccount = totalAMMforAccount.add(stakerAMMVolume[account][i].amount);
        }
        return totalAMMforAccount;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint reward);
    event Staked(address user, uint amount);
    event ClosedPeriod(uint PeriodOfStaking, uint lastPeriodTimeStamp);
    event RewardsClaimed(address account, uint unclaimedReward);
    event FeeRewardsClaimed(address account, uint unclaimedFees);
    event UnstakeCooldown(address account, uint cooldownTime, uint amount);
    event CancelUnstake(address account);
    event Unstaked(address account, uint unstakeAmount);
    event ClaimEnabled(bool enabled);
    event DistributeFeesEnabled(bool enabled);
    event FixedPeriodRewardChanged(uint value);
    event PeriodExtraRewardChanged(uint value);
    event DurationPeriodChanged(uint value);
    event UnstakeDurationPeriodChanged(uint value);
    event EscrowChanged(address newEscrow);
    event StakingPeriodStarted();
    event SNXRewardsAddressChanged(address snxRewards);
    event ThalesRoyaleAddressChanged(address royale);
    event ThalesAMMAddressChanged(address amm);
    event AMMVolumeUpdated(address account, uint amount);
    event ExtraRewardsChanged(bool extrarewardsactive);
    event PriceFeedAddressChanged(address pricefeed);
}

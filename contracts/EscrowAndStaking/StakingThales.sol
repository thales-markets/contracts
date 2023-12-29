// SPDX-License-Identifier: MIT

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
import "../interfaces/IThalesStakingRewardsPool.sol";
import "../interfaces/IAddressResolver.sol";
import "../interfaces/ISportsAMMLiquidityPool.sol";
import "../interfaces/IThalesAMMLiquidityPool.sol";
import "../interfaces/IParlayAMMLiquidityPool.sol";
import "../interfaces/IThalesAMM.sol";
import "../interfaces/IPositionalMarketManager.sol";
import "../interfaces/IStakingThalesBonusRewardsManager.sol";
import "../interfaces/ICCIPCollector.sol";

/// @title A Staking contract that provides logic for staking and claiming rewards
contract StakingThales is IStakingThales, Initializable, ProxyOwned, ProxyReentrancyGuard, ProxyPausable {
    /* ========== LIBRARIES ========== */

    using SafeMath for uint;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IEscrowThales public iEscrowThales;
    IERC20 public stakingToken;
    IERC20 public feeToken;
    ISNXRewards private SNXRewards;
    IThalesRoyale private thalesRoyale;
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
    uint private totalSNXRewardsInPeriod;
    uint private totalSNXFeesInPeriod;
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

    uint constant HUNDRED = 1e18;
    uint constant AMM_EXTRA_REWARD_PERIODS = 4;

    struct AMMVolumeEntry {
        uint amount;
        uint period;
    }
    mapping(address => uint) private lastAMMUpdatePeriod;
    mapping(address => AMMVolumeEntry[AMM_EXTRA_REWARD_PERIODS]) private stakerAMMVolume;

    bool public extraRewardsActive;
    IThalesStakingRewardsPool public ThalesStakingRewardsPool;

    uint private maxSNXRewardsPercentage;
    uint private maxAMMVolumeRewardsPercentage;
    uint private AMMVolumeRewardsMultiplier;
    uint private maxThalesRoyaleRewardsPercentage;

    uint constant ONE = 1e18;
    uint constant ONE_PERCENT = 1e16;

    uint private SNXVolumeRewardsMultiplier;

    mapping(address => uint) private _lastStakingPeriod;

    uint public totalStakedLastPeriodEnd;
    uint public totalEscrowedLastPeriodEnd;
    address private exoticBonds;

    IAddressResolver private addressResolver;

    address public thalesRangedAMM;
    address public sportsAMM;

    mapping(address => uint) private lastThalesAMMUpdatePeriod;
    mapping(address => AMMVolumeEntry[AMM_EXTRA_REWARD_PERIODS]) private thalesAMMVolume;
    mapping(address => uint) private lastThalesRangedAMMUpdatePeriod;
    mapping(address => AMMVolumeEntry[AMM_EXTRA_REWARD_PERIODS]) private thalesRangedAMMVolume;
    mapping(address => uint) private lastExoticMarketsUpdatePeriod;
    mapping(address => AMMVolumeEntry[AMM_EXTRA_REWARD_PERIODS]) private exoticMarketsVolume;
    mapping(address => uint) private lastSportsAMMUpdatePeriod;
    mapping(address => AMMVolumeEntry[AMM_EXTRA_REWARD_PERIODS]) private sportsAMMVolume;

    mapping(address => mapping(address => bool)) public canClaimOnBehalf;

    bool public mergeAccountEnabled;

    mapping(address => address) public delegatedVolume;
    mapping(address => bool) public supportedSportVault;
    mapping(address => bool) public supportedAMMVault;

    ISportsAMMLiquidityPool private sportsAMMLiquidityPool;
    IThalesAMMLiquidityPool private thalesAMMLiquidityPool;

    IStakingThalesBonusRewardsManager public stakingThalesBonusRewardsManager;
    IParlayAMMLiquidityPool private parlayAMMLiquidityPool;

    bool public readOnlyMode;
    bool public closingPeriodInProgress;
    uint public closingPeriodPauseTime;

    bool public sendCCIPMessage;

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
        fixedPeriodReward = 70000 * 1e18;
        periodExtraReward = 21000 * 1e18;
        SNXRewards = ISNXRewards(_ISNXRewards);
    }

    /* ========== VIEWS ========== */

    /// @notice Get the total staked amount on the contract
    /// @return total staked amount
    function totalStakedAmount() external view returns (uint) {
        return _totalStakedAmount;
    }

    /// @notice Get the staked balance for the account
    /// @param account to get the staked balance for
    /// @return the staked balance for the account
    function stakedBalanceOf(address account) external view returns (uint) {
        return _stakedBalances[account];
    }

    /// @notice Get the last period of claimed rewards for the account
    /// @param account to get the last period of claimed rewards for
    /// @return the last period of claimed rewards for the account
    function getLastPeriodOfClaimedRewards(address account) external view returns (uint) {
        return _lastRewardsClaimedPeriod[account];
    }

    /// @notice Get the rewards available for the claim for the account
    /// @param account to get the rewards available for the claim for
    /// @return the rewards available for the claim for the account
    function getRewardsAvailable(address account) external view returns (uint) {
        return _calculateAvailableRewardsToClaim(account);
    }

    /// @notice Get the reward fees available for the claim for the account
    /// @param account to get the reward fees available for the claim for
    /// @return the rewards fees available for the claim for the account
    function getRewardFeesAvailable(address account) external view returns (uint) {
        return _calculateAvailableFeesToClaim(account);
    }

    /// @notice Get the total rewards claimed for the account until now
    /// @param account to get the total rewards claimed for
    /// @return the total rewards claimed for the account until now
    function getAlreadyClaimedRewards(address account) external view returns (uint) {
        return stakerLifetimeRewardsClaimed[account];
    }

    /// @notice Get the rewards funds available on the rewards pool
    /// @return the rewards funds available on the rewards pool
    function getContractRewardFunds() external view returns (uint) {
        return stakingToken.balanceOf(address(ThalesStakingRewardsPool));
    }

    /// @notice Get the fee funds available on the staking contract
    /// @return the fee funds available on the staking contract
    function getContractFeeFunds() external view returns (uint) {
        return feeToken.balanceOf(address(this));
    }

    /// @notice Set staking parametars
    /// @param _claimEnabled enable/disable claim rewards
    /// @param _distributeFeesEnabled enable/disable fees distribution
    /// @param _durationPeriod duration of the staking period
    /// @param _unstakeDurationPeriod duration of the unstaking cooldown period
    /// @param _mergeAccountEnabled enable/disable account merging
    /// @param _readOnlyMode enable/disable readonlymode
    /// @param _sendCCIPMessage enable/disable sending CCIP message
    function setStakingParameters(
        bool _claimEnabled,
        bool _distributeFeesEnabled,
        uint _durationPeriod,
        uint _unstakeDurationPeriod,
        bool _mergeAccountEnabled,
        bool _readOnlyMode,
        bool _sendCCIPMessage
    ) external onlyOwner {
        claimEnabled = _claimEnabled;
        distributeFeesEnabled = _distributeFeesEnabled;
        durationPeriod = _durationPeriod;
        unstakeDurationPeriod = _unstakeDurationPeriod;
        mergeAccountEnabled = _mergeAccountEnabled;
        readOnlyMode = _readOnlyMode;
        sendCCIPMessage = _sendCCIPMessage;
        emit StakingParametersChanged(
            _claimEnabled,
            _distributeFeesEnabled,
            _durationPeriod,
            _unstakeDurationPeriod,
            _mergeAccountEnabled,
            _readOnlyMode,
            _sendCCIPMessage
        );
    }

    /// @notice Set staking rewards parameters
    /// @param _fixedReward amount for weekly base rewards pool
    /// @param _extraReward amount for weekly bonus rewards pool
    /// @param _extraRewardsActive enable/disable bonus rewards
    function setStakingRewardsParameters(
        uint _fixedReward,
        uint _extraReward,
        bool _extraRewardsActive
    ) external onlyOwner {
        fixedPeriodReward = _fixedReward;
        periodExtraReward = _extraReward;
        extraRewardsActive = _extraRewardsActive;

        emit StakingRewardsParametersChanged(_fixedReward, _extraReward, _extraRewardsActive);
    }

    /// @notice Set contract addresses
    /// @param _thalesAMM address of Thales AMM contract
    /// @param _thalesRangedAMM address of Thales ranged AMM contract
    /// @param _sportsAMM address of sport markets AMM contract
    /// @param _priceFeed address of price feed contract
    /// @param _thalesStakingRewardsPool address of Thales staking rewards pool
    /// @param _addressResolver address of address resolver contract
    /// @param _stakingThalesBonusRewardsManager manager for TIP-135 gamification systme
    function setAddresses(
        address _thalesAMM,
        address _thalesRangedAMM,
        address _sportsAMM,
        address _priceFeed,
        address _thalesStakingRewardsPool,
        address _addressResolver,
        address _stakingThalesBonusRewardsManager
    ) external onlyOwner {
        thalesAMM = _thalesAMM;
        thalesRangedAMM = _thalesRangedAMM;
        sportsAMM = _sportsAMM;
        priceFeed = IPriceFeed(_priceFeed);
        ThalesStakingRewardsPool = IThalesStakingRewardsPool(_thalesStakingRewardsPool);
        addressResolver = IAddressResolver(_addressResolver);
        stakingThalesBonusRewardsManager = IStakingThalesBonusRewardsManager(_stakingThalesBonusRewardsManager);
        emit AddressesChanged(
            _thalesAMM,
            _thalesRangedAMM,
            _sportsAMM,
            _priceFeed,
            _thalesStakingRewardsPool,
            _addressResolver,
            _stakingThalesBonusRewardsManager
        );
    }

    /// @notice Set address of Escrow Thales contract
    /// @param _escrowThalesContract address of Escrow Thales contract
    function setEscrow(address _escrowThalesContract) external onlyOwner {
        if (address(iEscrowThales) != address(0)) {
            stakingToken.approve(address(iEscrowThales), 0);
        }
        iEscrowThales = IEscrowThales(_escrowThalesContract);
        stakingToken.approve(_escrowThalesContract, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
        emit EscrowChanged(_escrowThalesContract);
    }

    /// @notice add a sport vault address to count towards gamified staking volume
    /// @param _sportVault address to set
    /// @param value to set
    function setSupportedSportVault(address _sportVault, bool value) external onlyOwner {
        supportedSportVault[_sportVault] = value;
        emit SupportedSportVaultSet(_sportVault, value);
    }

    /// @notice add a amm vault address to count towards gamified staking volume
    /// @param _ammVault address to set
    /// @param value to set
    function setSupportedAMMVault(address _ammVault, bool value) external onlyOwner {
        supportedAMMVault[_ammVault] = value;
        emit SupportedAMMVaultSet(_ammVault, value);
    }

    /// @notice Set last period timestamp
    /// @param _lastPeriodTimestamp last period timestamp to be set
    function setLastPeriodTimestamp(uint _lastPeriodTimestamp) external onlyOwner {
        require(_lastPeriodTimestamp > (lastPeriodTimeStamp - 5 hours), "Too far back");
        lastPeriodTimeStamp = _lastPeriodTimestamp;
        emit LastPeriodTimestampSet(_lastPeriodTimestamp);
    }

    /// @notice Get the base reward amount available for the claim for the account
    /// @param account to get the base reward amount available for the claim for
    /// @return the base reward amount available for the claim for the account
    function getBaseReward(address account) public view returns (uint _baseRewards) {
        if (
            !((_lastStakingPeriod[account] == periodsOfStaking) ||
                (_stakedBalances[account] == 0) ||
                (_lastRewardsClaimedPeriod[account] == periodsOfStaking) ||
                (totalStakedLastPeriodEnd == 0))
        ) {
            _baseRewards = _stakedBalances[account]
                .add(iEscrowThales.getStakedEscrowedBalanceForRewards(account))
                .mul(currentPeriodRewards)
                .div(totalStakedLastPeriodEnd.add(totalEscrowedLastPeriodEnd));
        }
    }

    /// @notice [DEPRECATED maintained because of IStakingThales] Get the total protocol volume for the account
    /// @param account to get the total protocol volume for
    /// @return the total protocol volume for the account
    function getAMMVolume(address account) external view returns (uint) {
        return 0;
    }

    /// @notice Get the total bonus rewards for the account
    /// @param account to get the total bonus rewards for
    /// @return the total bonus rewards for the account
    function getTotalBonus(address account) public view returns (uint returnValue) {
        if (
            (address(stakingThalesBonusRewardsManager) != address(0)) && stakingThalesBonusRewardsManager.useNewBonusModel()
        ) {
            returnValue = periodExtraReward
                .mul(stakingThalesBonusRewardsManager.getUserRoundBonusShare(account, periodsOfStaking - 1))
                .div(ONE);
        }
    }

    /// @notice Get the flag that indicates whether the current period can be closed
    /// @return the flag that indicates whether the current period can be closed
    function canClosePeriod() external view returns (bool) {
        return (startTimeStamp > 0 && (block.timestamp >= lastPeriodTimeStamp.add(durationPeriod)));
    }

    /* ========== PUBLIC ========== */

    /// @notice Start the first staking period
    function startStakingPeriod() external onlyOwner {
        require(startTimeStamp == 0, "Staking has already started");
        startTimeStamp = block.timestamp;
        periodsOfStaking = 0;
        lastPeriodTimeStamp = startTimeStamp;
        _totalRewardsClaimed = 0;
        _totalRewardFeesClaimed = 0;
        _totalStakedAmount = 0;
        _totalEscrowedAmount = 0;
        _totalPendingStakeAmount = 0;
        emit StakingPeriodStarted();
    }

    /// @notice Close the current staking period
    function closePeriod() external nonReentrant notPaused {
        require(startTimeStamp > 0, "Staking period has not started");
        require(
            block.timestamp >= lastPeriodTimeStamp.add(durationPeriod),
            "A full period has not passed since the last closed period"
        );
        require(!closingPeriodInProgress, "ClosingInProgress");
        iEscrowThales.updateCurrentPeriod();
        lastPeriodTimeStamp = block.timestamp;
        periodsOfStaking = iEscrowThales.currentVestingPeriod();

        totalEscrowedLastPeriodEnd = iEscrowThales.totalEscrowedRewards().sub(
            iEscrowThales.totalEscrowBalanceNotIncludedInStaking()
        );

        currentPeriodRewards = fixedPeriodReward;
        currentPeriodFees = feeToken.balanceOf(address(this));
        totalStakedLastPeriodEnd = _totalStakedAmount;

        if (sendCCIPMessage) {
            _sendRoundClosingMessageCrosschain();
        }
        emit ClosedPeriod(periodsOfStaking, lastPeriodTimeStamp);
    }

    /// @notice if CCIP is configured, this method will send the staking data to relevant chains
    function sendRoundClosingMessageCrosschain() external onlyOwner {
        _sendRoundClosingMessageCrosschain();
    }

    function _sendRoundClosingMessageCrosschain() internal {
        if (addressResolver.checkIfContractExists("CrossChainCollector")) {
            if (!readOnlyMode) {
                paused = true;
                closingPeriodInProgress = true;
                lastPauseTime = block.timestamp;
                closingPeriodPauseTime = block.timestamp;
            }
            ICCIPCollector(addressResolver.getAddress("CrossChainCollector")).sendOnClosePeriod(
                totalStakedLastPeriodEnd,
                totalEscrowedLastPeriodEnd,
                stakingThalesBonusRewardsManager.totalRoundBonusPoints(periodsOfStaking - 1),
                _reverseTransformCollateral(feeToken.balanceOf(address(this)))
            );
        }
    }

    /// @notice Updating the staking rewards parameters after closed period with the calculated values via CCIP
    /// @param _currentPeriodRewards the calculated base rewards to be distributed for the current period on the particular chain
    /// @param _extraRewards the calculated extra rewards to be distributed for the current period on the particular chain
    /// @param _revShare the calculated revenue share to be distributed for the current period on the particular chain
    function updateStakingRewards(
        uint _currentPeriodRewards,
        uint _extraRewards,
        uint _revShare
    ) external nonReentrant {
        if (!readOnlyMode) {
            // if it is readOnlyMode==true  discard all following the updates
            require(msg.sender == addressResolver.getAddress("CrossChainCollector") || msg.sender == owner, "InvCCIP");
            require(closingPeriodInProgress, "NotInClosePeriod");

            require(
                _currentPeriodRewards <= fixedPeriodReward &&
                    _extraRewards <= fixedPeriodReward &&
                    _revShare <= 5 * fixedPeriodReward,
                "Rejected due to suspicious values"
            );

            bool safeBoxBufferSet = addressResolver.checkIfContractExists("SafeBoxBuffer");
            bool insufficientFundsInBuffer;

            uint currentBalance = feeToken.balanceOf(address(this));
            currentPeriodFees = _transformCollateral(_revShare);

            if (safeBoxBufferSet) {
                address safeBoxBuffer = addressResolver.getAddress("SafeBoxBuffer");
                if (currentPeriodFees > currentBalance) {
                    if (feeToken.balanceOf(safeBoxBuffer) < (currentPeriodFees - currentBalance)) {
                        insufficientFundsInBuffer = true;
                    } else {
                        ICCIPCollector(safeBoxBuffer).pullExtraFunds(currentPeriodFees - currentBalance);
                    }
                } else if (currentPeriodFees > 0 && currentPeriodFees < currentBalance) {
                    feeToken.transfer(safeBoxBuffer, currentBalance - currentPeriodFees);
                }
            }
            currentPeriodRewards = _currentPeriodRewards;
            periodExtraReward = _extraRewards;
            closingPeriodInProgress = false;
            if (closingPeriodPauseTime == lastPauseTime) {
                paused = !safeBoxBufferSet || insufficientFundsInBuffer;
            }
        }
        emit ReceivedStakingRewardsUpdate(_currentPeriodRewards, _extraRewards, _transformCollateral(_revShare));
    }

    /// @notice Stake the amount of staking token to get weekly rewards
    /// @param amount to stake
    function stake(uint amount) external nonReentrant notPaused {
        _stake(amount, msg.sender, msg.sender);
        emit Staked(msg.sender, amount);
    }

    /// @notice Start unstaking cooldown for the amount of staking token
    /// @param amount to unstake
    function startUnstake(uint amount) external notPaused {
        require(amount > 0, "Cannot unstake 0");
        require(_stakedBalances[msg.sender] >= amount, "Account doesnt have that much staked");
        require(!unstaking[msg.sender], "Account has already triggered unstake cooldown");

        if (_calculateAvailableRewardsToClaim(msg.sender) > 0) {
            _claimReward(msg.sender);
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

    /// @notice Cancel unstaking cooldown
    function cancelUnstake() external notPaused {
        require(unstaking[msg.sender], "Account is not unstaking");

        // on revert full unstake remove his escrowed balance from totalEscrowBalanceNotIncludedInStaking
        _subtractTotalEscrowBalanceNotIncludedInStaking(msg.sender);

        if (_calculateAvailableRewardsToClaim(msg.sender) > 0) {
            _claimReward(msg.sender);
        }

        unstaking[msg.sender] = false;
        _totalStakedAmount = _totalStakedAmount.add(unstakingAmount[msg.sender]);
        _stakedBalances[msg.sender] = _stakedBalances[msg.sender].add(unstakingAmount[msg.sender]);
        unstakingAmount[msg.sender] = 0;

        emit CancelUnstake(msg.sender);
    }

    /// @notice Unstake after the cooldown period expired
    function unstake() external notPaused {
        require(unstaking[msg.sender], "Account has not triggered unstake cooldown");
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

    /// @notice Claim the weekly staking rewards
    function claimReward() public nonReentrant notPaused {
        _claimReward(msg.sender);
    }

    /// @notice Claim the weekly staking rewards on behalf of the account
    /// @param account to claim on behalf of
    function claimRewardOnBehalf(address account) public nonReentrant notPaused {
        require(account != address(0) && account != msg.sender, "Invalid address");
        require(canClaimOnBehalf[account][msg.sender], "Cannot claim on behalf");
        _claimReward(account);
    }

    /// @notice Update the protocol volume for the account
    /// @param account to update the protocol volume for
    /// @param amount to add to the existing protocol volume
    function updateVolume(address account, uint amount) external {
        require(account != address(0) && amount > 0, "Invalid params");
        if (delegatedVolume[account] != address(0)) {
            account = delegatedVolume[account];
        }

        require(
            msg.sender == thalesAMM ||
                msg.sender == thalesRangedAMM ||
                msg.sender == sportsAMM ||
                supportedSportVault[msg.sender] ||
                supportedAMMVault[msg.sender],
            "Invalid address"
        );
        amount = _reverseTransformCollateral(amount);
        if (address(stakingThalesBonusRewardsManager) != address(0)) {
            stakingThalesBonusRewardsManager.storePoints(account, msg.sender, amount, periodsOfStaking);
        }

        emit AMMVolumeUpdated(account, amount, msg.sender);
    }

    /// @notice Merge account to transfer all staking amounts to another account
    /// @param destAccount to merge into
    function mergeAccount(address destAccount) external notPaused {
        require(mergeAccountEnabled, "Merge account is disabled");
        require(destAccount != address(0) && destAccount != msg.sender, "Invalid address");
        require(
            _calculateAvailableRewardsToClaim(msg.sender) == 0 && _calculateAvailableRewardsToClaim(destAccount) == 0,
            "Cannot merge, claim rewards on both accounts before merging"
        );
        require(
            !unstaking[msg.sender] && !unstaking[destAccount],
            "Cannot merge, cancel unstaking on both accounts before merging"
        );

        iEscrowThales.mergeAccount(msg.sender, destAccount);

        _stakedBalances[destAccount] = _stakedBalances[destAccount].add(_stakedBalances[msg.sender]);
        stakerLifetimeRewardsClaimed[destAccount] = stakerLifetimeRewardsClaimed[destAccount].add(
            stakerLifetimeRewardsClaimed[msg.sender]
        );
        stakerFeesClaimed[destAccount] = stakerFeesClaimed[destAccount].add(stakerFeesClaimed[msg.sender]);

        _lastRewardsClaimedPeriod[destAccount] = periodsOfStaking;
        _lastStakingPeriod[destAccount] = periodsOfStaking;
        delete lastUnstakeTime[msg.sender];
        delete unstaking[msg.sender];
        delete unstakingAmount[msg.sender];
        delete _stakedBalances[msg.sender];
        delete stakerLifetimeRewardsClaimed[msg.sender];
        delete stakerFeesClaimed[msg.sender];
        delete _lastRewardsClaimedPeriod[msg.sender];
        delete _lastStakingPeriod[msg.sender];

        emit AccountMerged(msg.sender, destAccount);
    }

    /// @notice Set flag to enable/disable claim on behalf of the msg.sender for the account
    /// @param account to enable/disable claim on behalf of msg.sender
    /// @param _canClaimOnBehalf enable/disable claim on behalf of the msg.sender for the account
    function setCanClaimOnBehalf(address account, bool _canClaimOnBehalf) external notPaused {
        require(account != address(0) && account != msg.sender, "Invalid address");
        canClaimOnBehalf[msg.sender][account] = _canClaimOnBehalf;
        emit CanClaimOnBehalfChanged(msg.sender, account, _canClaimOnBehalf);
    }

    /// @notice delegate your volume to another address
    /// @param account address to delegate to
    function delegateVolume(address account) external notPaused {
        delegatedVolume[msg.sender] = account;
        emit DelegatedVolume(account);
    }

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
            ThalesStakingRewardsPool.addToEscrow(account, availableRewardsToClaim);
            // Record the total claimed rewards
            stakerLifetimeRewardsClaimed[account] = stakerLifetimeRewardsClaimed[account].add(availableRewardsToClaim);
            _totalRewardsClaimed = _totalRewardsClaimed.add(availableRewardsToClaim);

            emit RewardsClaimed(account, availableRewardsToClaim, getBaseReward(account));
        }
        // Update last claiming period
        _lastRewardsClaimedPeriod[account] = periodsOfStaking;
    }

    function _stake(
        uint amount,
        address staker,
        address sender
    ) internal {
        require(startTimeStamp > 0, "Staking period has not started");
        require(amount > 0, "Cannot stake 0");
        require(!unstaking[staker], "The staker is paused from staking due to unstaking");
        // Check if there are not claimable rewards from last period.
        // Claim them, and add new stake
        if (_calculateAvailableRewardsToClaim(staker) > 0) {
            _claimReward(staker);
        }
        _lastStakingPeriod[staker] = periodsOfStaking;

        // if just started staking subtract his escrowed balance from totalEscrowBalanceNotIncludedInStaking
        _subtractTotalEscrowBalanceNotIncludedInStaking(staker);

        _totalStakedAmount = _totalStakedAmount.add(amount);
        _stakedBalances[staker] = _stakedBalances[staker].add(amount);
        stakingToken.safeTransferFrom(sender, address(this), amount);
    }

    function _subtractTotalEscrowBalanceNotIncludedInStaking(address account) internal {
        if (_stakedBalances[account] == 0) {
            if (iEscrowThales.totalAccountEscrowedAmount(account) > 0) {
                iEscrowThales.subtractTotalEscrowBalanceNotIncludedInStaking(
                    iEscrowThales.totalAccountEscrowedAmount(account)
                );
            }
        }
    }

    function _calculateAvailableRewardsToClaim(address account) internal view returns (uint) {
        uint baseReward = getBaseReward(account);
        if (baseReward == 0) {
            return 0;
        }
        if (!extraRewardsActive) {
            return baseReward;
        } else {
            return baseReward.add(getTotalBonus(account));
        }
    }

    function _calculateAvailableFeesToClaim(address account) internal view returns (uint) {
        uint baseReward = getBaseReward(account);
        if (baseReward == 0) {
            return 0;
        }

        return
            _stakedBalances[account]
                .add(iEscrowThales.getStakedEscrowedBalanceForRewards(account))
                .mul(currentPeriodFees)
                .div(totalStakedLastPeriodEnd.add(totalEscrowedLastPeriodEnd));
    }

    function _transformCollateral(uint _amount) internal view returns (uint) {
        return (ICCIPCollector(address(feeToken)).decimals() == 6) ? _amount / 1e12 : _amount;
    }

    function _reverseTransformCollateral(uint _amount) internal view returns (uint) {
        return (ICCIPCollector(address(feeToken)).decimals() == 6) ? _amount * 1e12 : _amount;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint reward);
    event Staked(address user, uint amount);
    event StakedOnBehalf(address user, address staker, uint amount);
    event ClosedPeriod(uint PeriodOfStaking, uint lastPeriodTimeStamp);
    event RewardsClaimed(address account, uint unclaimedReward, uint baseRewards);
    event FeeRewardsClaimed(address account, uint unclaimedFees);
    event UnstakeCooldown(address account, uint cooldownTime, uint amount);
    event CancelUnstake(address account);
    event Unstaked(address account, uint unstakeAmount);
    event StakingParametersChanged(
        bool claimEnabled,
        bool distributeFeesEnabled,
        uint durationPeriod,
        uint unstakeDurationPeriod,
        bool mergeAccountEnabled,
        bool readOnlyMode,
        bool sendCCIPMessage
    );
    event StakingRewardsParametersChanged(uint fixedPeriodReward, uint periodExtraReward, bool extraRewardsActive);
    event AddressesChanged(
        address thalesAMM,
        address thalesRangedAMM,
        address sportsAMM,
        address priceFeed,
        address ThalesStakingRewardsPool,
        address addressResolver,
        address stakingThalesBonusRewardsManager
    );
    event ReceivedStakingRewardsUpdate(uint _currentPeriodRewards, uint _extraRewards, uint _revShare);
    event EscrowChanged(address newEscrow);
    event StakingPeriodStarted();
    event AMMVolumeUpdated(address account, uint amount, address source);
    event AccountMerged(address srcAccount, address destAccount);
    event DelegatedVolume(address destAccount);
    event CanClaimOnBehalfChanged(address sender, address account, bool canClaimOnBehalf);
    event SupportedAMMVaultSet(address vault, bool value);
    event SupportedSportVaultSet(address vault, bool value);
    event LastPeriodTimestampSet(uint lastPeriodTimestamp);
}

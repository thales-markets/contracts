// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "@openzeppelin/contracts-4.4.1/proxy/Clones.sol";

import "../../interfaces/IThalesAMM.sol";
import "../../interfaces/IPositionalMarket.sol";
import "../../interfaces/IStakingThales.sol";

import "./ThalesAMMLiquidityPoolRound.sol";

contract ThalesAMMLiquidityPool is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    /* ========== LIBRARIES ========== */
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct InitParams {
        address _owner;
        IThalesAMM _thalesAMM;
        IERC20Upgradeable _sUSD;
        uint _roundLength;
        uint _maxAllowedDeposit;
        uint _minDepositAmount;
        uint _maxAllowedUsers;
    }

    /* ========== CONSTANTS ========== */
    uint private constant HUNDRED = 1e20;
    uint private constant ONE = 1e18;

    /* ========== STATE VARIABLES ========== */

    IThalesAMM public thalesAMM;
    IERC20Upgradeable public sUSD;

    bool public started;

    uint public round;
    uint public roundLength;
    uint public firstRoundStartTime;

    mapping(uint => address) public roundPools;

    mapping(uint => address[]) public usersPerRound;
    mapping(uint => mapping(address => bool)) public userInRound;

    mapping(uint => mapping(address => uint)) public balancesPerRound;
    mapping(uint => uint) public allocationPerRound;

    mapping(address => bool) public withdrawalRequested;

    mapping(uint => address[]) public tradingMarketsPerRound;
    mapping(uint => mapping(address => bool)) public isTradingMarketInARound;

    mapping(uint => uint) public profitAndLossPerRound;
    mapping(uint => uint) public cumulativeProfitAndLoss;

    uint public maxAllowedDeposit;
    uint public minDepositAmount;
    uint public maxAllowedUsers;
    uint public usersCurrentlyInPool;

    address public defaultLiquidityProvider;

    IStakingThales public stakingThales;

    uint public stakedThalesMultiplier;

    address public poolRoundMastercopy;

    mapping(address => bool) public whitelistedDeposits;

    uint public totalDeposited;

    bool public onlyWhitelistedStakersAllowed;

    mapping(address => bool) public whitelistedStakers;

    bool public needsTransformingCollateral;

    mapping(uint => mapping(address => bool)) public marketAlreadyExercisedInRound;

    /* ========== CONSTRUCTOR ========== */

    function initialize(InitParams calldata params) external initializer {
        setOwner(params._owner);
        initNonReentrant();
        thalesAMM = IThalesAMM(params._thalesAMM);

        sUSD = params._sUSD;
        roundLength = params._roundLength;
        maxAllowedDeposit = params._maxAllowedDeposit;
        minDepositAmount = params._minDepositAmount;
        maxAllowedUsers = params._maxAllowedUsers;

        sUSD.approve(address(thalesAMM), type(uint256).max);
    }

    /// @notice Start pool and begin round #1
    function start() external onlyOwner {
        require(!started, "Liquidity pool has already started");
        require(allocationPerRound[1] > 0, "can not start with 0 deposits");
        round = 1;
        firstRoundStartTime = block.timestamp;
        started = true;
        emit PoolStarted();
    }

    /// @notice Deposit funds from user into pool for the next round
    /// @param amount Value to be deposited
    function deposit(uint amount) external canDeposit(amount) nonReentrant whenNotPaused {
        uint nextRound = round + 1;
        address roundPool = _getOrCreateRoundPool(nextRound);
        sUSD.safeTransferFrom(msg.sender, roundPool, amount);

        if (!whitelistedDeposits[msg.sender]) {
            require(!onlyWhitelistedStakersAllowed || whitelistedStakers[msg.sender], "Only whitelisted stakers allowed");
            require(
                (balancesPerRound[round][msg.sender] + amount + balancesPerRound[nextRound][msg.sender]) <=
                    _transformCollateral((stakingThales.stakedBalanceOf(msg.sender) * stakedThalesMultiplier) / ONE),
                "Not enough staked THALES"
            );
        }

        require(msg.sender != defaultLiquidityProvider, "Can't deposit directly as default liquidity provider");

        // new user enters the pool
        if (balancesPerRound[round][msg.sender] == 0 && balancesPerRound[nextRound][msg.sender] == 0) {
            require(usersCurrentlyInPool < maxAllowedUsers, "Max amount of users reached");
            usersPerRound[nextRound].push(msg.sender);
            userInRound[nextRound][msg.sender] = true;
            usersCurrentlyInPool = usersCurrentlyInPool + 1;
        }

        balancesPerRound[nextRound][msg.sender] += amount;

        allocationPerRound[nextRound] += amount;
        totalDeposited += amount;

        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(msg.sender, amount);
        }

        emit Deposited(msg.sender, amount, round);
    }

    /// @notice get sUSD to mint for buy and store market as trading in the round
    /// @param market to trade
    /// @param amountToMint amount to get for mint
    function commitTrade(address market, uint amountToMint) external nonReentrant whenNotPaused onlyAMM {
        require(started, "Pool has not started");
        require(amountToMint > 0, "Can't commit a zero trade");

        amountToMint = _transformCollateral(amountToMint);
        // add 1e-6 due to rounding issue, will be sent back to AMM at the end
        amountToMint = needsTransformingCollateral ? amountToMint + 1 : amountToMint;

        uint marketRound = getMarketRound(market);
        address liquidityPoolRound = _getOrCreateRoundPool(marketRound);

        if (marketRound == round) {
            sUSD.safeTransferFrom(liquidityPoolRound, address(thalesAMM), amountToMint);
        } else {
            uint poolBalance = sUSD.balanceOf(liquidityPoolRound);
            if (poolBalance > amountToMint) {
                sUSD.safeTransferFrom(liquidityPoolRound, address(thalesAMM), amountToMint);
            } else {
                uint differenceToLPAsDefault = amountToMint - poolBalance;
                _depositAsDefault(differenceToLPAsDefault, liquidityPoolRound, marketRound);
                sUSD.safeTransferFrom(liquidityPoolRound, address(thalesAMM), amountToMint);
            }
        }

        if (!isTradingMarketInARound[marketRound][market]) {
            tradingMarketsPerRound[marketRound].push(market);
            isTradingMarketInARound[marketRound][market] = true;
        }
    }

    /// @notice get options that are in the LP into the AMM for the buy tx
    /// @param market to get options for
    /// @param optionsAmount to get options for
    /// @param position to get options for
    function getOptionsForBuy(
        address market,
        uint optionsAmount,
        IThalesAMM.Position position
    ) external nonReentrant whenNotPaused onlyAMM {
        if (optionsAmount > 0) {
            require(started, "Pool has not started");

            uint marketRound = getMarketRound(market);
            address liquidityPoolRound = _getOrCreateRoundPool(marketRound);

            (IPosition up, IPosition down) = IPositionalMarket(market).getOptions();
            IPosition target = position == IThalesAMM.Position.Up ? up : down;

            ThalesAMMLiquidityPoolRound(liquidityPoolRound).moveOptions(
                IERC20Upgradeable(address(target)),
                optionsAmount,
                address(thalesAMM)
            );
        }
    }

    /// @notice get options that are in the LP into the AMM for the buy tx
    /// @param market to get options for
    /// @param optionsAmount to get options for
    /// @param position to get options for
    function getOptionsForBuyByAddress(
        address market,
        uint optionsAmount,
        address position
    ) external nonReentrant whenNotPaused onlyAMM {
        if (optionsAmount > 0) {
            require(started, "Pool has not started");

            uint marketRound = getMarketRound(market);
            address liquidityPoolRound = _getOrCreateRoundPool(marketRound);

            ThalesAMMLiquidityPoolRound(liquidityPoolRound).moveOptions(
                IERC20Upgradeable(position),
                optionsAmount,
                address(thalesAMM)
            );
        }
    }

    /// @notice request withdrawal from the LP
    /// @param market to check
    /// @return roundPool the pool for the passed market
    function getOrCreateMarketPool(address market) external onlyAMM nonReentrant whenNotPaused returns (address roundPool) {
        uint marketRound = getMarketRound(market);
        roundPool = _getOrCreateRoundPool(marketRound);
    }

    /// @notice request withdrawal from the LP
    function withdrawalRequest() external nonReentrant whenNotPaused {
        require(started, "Pool has not started");
        require(!withdrawalRequested[msg.sender], "Withdrawal already requested");
        require(balancesPerRound[round][msg.sender] > 0, "Nothing to withdraw");
        require(balancesPerRound[round + 1][msg.sender] == 0, "Can't withdraw as you already deposited for next round");

        if (!whitelistedDeposits[msg.sender]) {
            require(
                balancesPerRound[round][msg.sender] <
                    _transformCollateral(((stakingThales.stakedBalanceOf(msg.sender) * stakedThalesMultiplier) / ONE)),
                "Not enough staked THALES"
            );
        }

        if (totalDeposited > balancesPerRound[round][msg.sender]) {
            totalDeposited -= balancesPerRound[round][msg.sender];
        } else {
            totalDeposited = 0;
        }

        usersCurrentlyInPool = usersCurrentlyInPool - 1;
        withdrawalRequested[msg.sender] = true;
        emit WithdrawalRequested(msg.sender);
    }

    /// @notice Close current round and begin next round,
    /// excercise options of trading markets and calculate profit and loss
    function closeRound() external nonReentrant whenNotPaused {
        require(canCloseCurrentRound(), "Can't close current round");
        // excercise market options
        exerciseMarketsReadyToExercised();

        address roundPool = roundPools[round];
        // final balance is the final amount of sUSD in the round pool
        uint currentBalance = sUSD.balanceOf(roundPool);
        // calculate PnL

        // if no allocation for current round
        if (allocationPerRound[round] == 0) {
            profitAndLossPerRound[round] = 1;
        } else {
            profitAndLossPerRound[round] = (currentBalance * ONE) / allocationPerRound[round];
        }

        for (uint i = 0; i < usersPerRound[round].length; i++) {
            address user = usersPerRound[round][i];
            uint balanceAfterCurRound = (balancesPerRound[round][user] * profitAndLossPerRound[round]) / ONE;
            if (userInRound[round][user]) {
                if (!withdrawalRequested[user] && (profitAndLossPerRound[round] > 0)) {
                    balancesPerRound[round + 1][user] = balancesPerRound[round + 1][user] + balanceAfterCurRound;
                    userInRound[round + 1][user] = true;
                    usersPerRound[round + 1].push(user);
                    if (address(stakingThales) != address(0)) {
                        stakingThales.updateVolume(user, balanceAfterCurRound);
                    }
                } else {
                    balancesPerRound[round + 1][user] = 0;
                    sUSD.safeTransferFrom(roundPool, user, balanceAfterCurRound);
                    withdrawalRequested[user] = false;
                    userInRound[round + 1][user] = false;
                    emit Claimed(user, balanceAfterCurRound);
                }
            }
        }

        //always claim for defaultLiquidityProvider
        if (balancesPerRound[round][defaultLiquidityProvider] > 0) {
            uint balanceAfterCurRound = (balancesPerRound[round][defaultLiquidityProvider] * profitAndLossPerRound[round]) /
                ONE;
            sUSD.safeTransferFrom(roundPool, defaultLiquidityProvider, balanceAfterCurRound);
            emit Claimed(defaultLiquidityProvider, balanceAfterCurRound);
        }

        if (round == 1) {
            cumulativeProfitAndLoss[round] = profitAndLossPerRound[round];
        } else {
            cumulativeProfitAndLoss[round] = (cumulativeProfitAndLoss[round - 1] * profitAndLossPerRound[round]) / ONE;
        }

        // start next round
        round += 1;

        //add all carried over sUSD
        allocationPerRound[round] += sUSD.balanceOf(roundPool);

        totalDeposited = allocationPerRound[round] - balancesPerRound[round][defaultLiquidityProvider];

        address roundPoolNewRound = _getOrCreateRoundPool(round);

        sUSD.safeTransferFrom(roundPool, roundPoolNewRound, sUSD.balanceOf(roundPool));

        emit RoundClosed(round - 1, profitAndLossPerRound[round - 1]);
    }

    /// @notice Iterate all markets in the current round and exercise those ready to be exercised
    function exerciseMarketsReadyToExercised() public {
        ThalesAMMLiquidityPoolRound poolRound = ThalesAMMLiquidityPoolRound(roundPools[round]);
        IPositionalMarket market;
        for (uint i = 0; i < tradingMarketsPerRound[round].length; i++) {
            address marketAddress = tradingMarketsPerRound[round][i];
            if (!marketAlreadyExercisedInRound[round][marketAddress]) {
                market = IPositionalMarket(marketAddress);
                if (market.resolved()) {
                    poolRound.exerciseMarketReadyToExercised(market);
                    marketAlreadyExercisedInRound[round][marketAddress] = true;
                }
            }
        }
    }

    /* ========== VIEWS ========== */

    /// @notice whether the user is currently LPing
    /// @param user to check
    /// @return isUserInLP whether the user is currently LPing
    function isUserLPing(address user) external view returns (bool isUserInLP) {
        isUserInLP =
            (balancesPerRound[round][user] > 0 || balancesPerRound[round + 1][user] > 0) &&
            !withdrawalRequested[user];
    }

    /// @notice Return the maximum amount the user can deposit now
    /// @param user address to check
    /// @return maxDepositForUser the maximum amount the user can deposit in total including already deposited
    /// @return availableToDepositForUser the maximum amount the user can deposit now
    /// @return stakedThalesForUser how much THALES the user has staked
    function getMaxAvailableDepositForUser(address user)
        external
        view
        returns (
            uint maxDepositForUser,
            uint availableToDepositForUser,
            uint stakedThalesForUser
        )
    {
        uint nextRound = round + 1;
        stakedThalesForUser = stakingThales.stakedBalanceOf(user);
        maxDepositForUser = _transformCollateral((stakedThalesForUser * stakedThalesMultiplier) / ONE);
        availableToDepositForUser = maxDepositForUser > (balancesPerRound[round][user] + balancesPerRound[nextRound][user])
            ? (maxDepositForUser - balancesPerRound[round][user] - balancesPerRound[nextRound][user])
            : 0;
    }

    /// @notice Return how much the user needs to have staked to withdraw
    /// @param user address to check
    /// @return neededStaked how much the user needs to have staked to withdraw
    function getNeededStakedThalesToWithdrawForUser(address user) external view returns (uint neededStaked) {
        uint nextRound = round + 1;
        neededStaked =
            _reverseTransformCollateral((balancesPerRound[round][user] + balancesPerRound[nextRound][user]) * ONE) /
            stakedThalesMultiplier;
    }

    /// @notice get the pool address for the market
    /// @param market to check
    /// @return roundPool the pool address for the market
    function getMarketPool(address market) external view returns (address roundPool) {
        roundPool = roundPools[getMarketRound(market)];
    }

    /// @notice Checks if all conditions are met to close the round
    /// @return bool
    function canCloseCurrentRound() public view returns (bool) {
        if (!started || block.timestamp < getRoundEndTime(round)) {
            return false;
        }
        IPositionalMarket market;
        for (uint i = 0; i < tradingMarketsPerRound[round].length; i++) {
            address marketAddress = tradingMarketsPerRound[round][i];
            if (!marketAlreadyExercisedInRound[round][marketAddress]) {
                market = IPositionalMarket(marketAddress);
                if (!market.resolved()) {
                    return false;
                }
            }
        }
        return true;
    }

    /// @notice Iterate all markets in the current round and return true if at least one can be exercised
    function hasMarketsReadyToBeExercised() public view returns (bool) {
        ThalesAMMLiquidityPoolRound poolRound = ThalesAMMLiquidityPoolRound(roundPools[round]);
        IPositionalMarket market;
        for (uint i = 0; i < tradingMarketsPerRound[round].length; i++) {
            address marketAddress = tradingMarketsPerRound[round][i];
            if (!marketAlreadyExercisedInRound[round][marketAddress]) {
                market = IPositionalMarket(marketAddress);
                if (market.resolved()) {
                    (uint upBalance, uint downBalance) = market.balancesOf(address(poolRound));
                    if (upBalance > 0 || downBalance > 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /// @notice Return multiplied PnLs between rounds
    /// @param roundA Round number from
    /// @param roundB Round number to
    /// @return uint
    function cumulativePnLBetweenRounds(uint roundA, uint roundB) public view returns (uint) {
        return (cumulativeProfitAndLoss[roundB] * profitAndLossPerRound[roundA]) / cumulativeProfitAndLoss[roundA];
    }

    /// @notice Return the start time of the passed round
    /// @param _round number
    /// @return uint the start time of the given round
    function getRoundStartTime(uint _round) public view returns (uint) {
        return firstRoundStartTime + (_round - 1) * roundLength;
    }

    /// @notice Return the end time of the passed round
    /// @param _round number
    /// @return uint the end time of the given round
    function getRoundEndTime(uint _round) public view returns (uint) {
        return firstRoundStartTime + _round * roundLength;
    }

    /// @notice Return the round to which a market belongs to
    /// @param market to get the round for
    /// @return _round the round which the market belongs to
    function getMarketRound(address market) public view returns (uint _round) {
        IPositionalMarket marketContract = IPositionalMarket(market);
        (uint maturity, ) = marketContract.times();
        if (maturity > firstRoundStartTime) {
            _round = (maturity - firstRoundStartTime) / roundLength + 1;
        } else {
            _round = 1;
        }
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function _transformCollateral(uint value) internal view returns (uint) {
        if (needsTransformingCollateral) {
            return value / 1e12;
        } else {
            return value;
        }
    }

    function _reverseTransformCollateral(uint value) internal view returns (uint) {
        if (needsTransformingCollateral) {
            return value * 1e12;
        } else {
            return value;
        }
    }

    function _depositAsDefault(
        uint amount,
        address roundPool,
        uint _round
    ) internal {
        require(defaultLiquidityProvider != address(0), "default liquidity provider not set");

        sUSD.safeTransferFrom(defaultLiquidityProvider, roundPool, amount);

        balancesPerRound[_round][defaultLiquidityProvider] += amount;
        allocationPerRound[_round] += amount;

        emit Deposited(defaultLiquidityProvider, amount, _round);
    }

    function _getOrCreateRoundPool(uint _round) internal returns (address roundPool) {
        roundPool = roundPools[_round];
        if (roundPool == address(0)) {
            require(poolRoundMastercopy != address(0), "Round pool mastercopy not set");
            ThalesAMMLiquidityPoolRound newRoundPool = ThalesAMMLiquidityPoolRound(Clones.clone(poolRoundMastercopy));
            newRoundPool.initialize(address(this), sUSD, _round, getRoundEndTime(_round), getRoundEndTime(_round + 1));
            roundPool = address(newRoundPool);
            roundPools[_round] = roundPool;
            emit RoundPoolCreated(_round, roundPool);
        }
    }

    /* ========== SETTERS ========== */

    function setPaused(bool _setPausing) external onlyOwner {
        _setPausing ? _pause() : _unpause();
    }

    /// @notice Set onlyWhitelistedStakersAllowed variable
    /// @param flagToSet self explanatory
    function setOnlyWhitelistedStakersAllowed(bool flagToSet) external onlyOwner {
        onlyWhitelistedStakersAllowed = flagToSet;
    }

    /// @notice setNeedsTransformingCollateral sets needsTransformingCollateral value
    /// @param _needsTransformingCollateral boolen value to be set
    function setNeedsTransformingCollateral(bool _needsTransformingCollateral) external onlyOwner {
        needsTransformingCollateral = _needsTransformingCollateral;
    }

    /// @notice Set _poolRoundMastercopy
    /// @param _poolRoundMastercopy to clone round pools from
    function setPoolRoundMastercopy(address _poolRoundMastercopy) external onlyOwner {
        poolRoundMastercopy = _poolRoundMastercopy;
        emit PoolRoundMastercopyChanged(poolRoundMastercopy);
    }

    /// @notice Set _stakedThalesMultiplier
    /// @param _stakedThalesMultiplier the number of sUSD one can deposit per THALES staked
    function setStakedThalesMultiplier(uint _stakedThalesMultiplier) external onlyOwner {
        stakedThalesMultiplier = _stakedThalesMultiplier;
        emit StakedThalesMultiplierChanged(_stakedThalesMultiplier);
    }

    /// @notice Set IStakingThales contract
    /// @param _stakingThales IStakingThales address
    function setStakingThales(IStakingThales _stakingThales) external onlyOwner {
        stakingThales = _stakingThales;
        emit StakingThalesChanged(address(_stakingThales));
    }

    /// @notice Set max allowed deposit
    /// @param _maxAllowedDeposit Deposit value
    function setMaxAllowedDeposit(uint _maxAllowedDeposit) external onlyOwner {
        maxAllowedDeposit = _maxAllowedDeposit;
        emit MaxAllowedDepositChanged(_maxAllowedDeposit);
    }

    /// @notice Set min allowed deposit
    /// @param _minDepositAmount Deposit value
    function setMinAllowedDeposit(uint _minDepositAmount) external onlyOwner {
        minDepositAmount = _minDepositAmount;
        emit MinAllowedDepositChanged(_minDepositAmount);
    }

    /// @notice Set _maxAllowedUsers
    /// @param _maxAllowedUsers Deposit value
    function setMaxAllowedUsers(uint _maxAllowedUsers) external onlyOwner {
        maxAllowedUsers = _maxAllowedUsers;
        emit MaxAllowedUsersChanged(_maxAllowedUsers);
    }

    /// @notice Set ThalesAMM contract
    /// @param _thalesAMM ThalesAMM address
    function setThalesAmm(IThalesAMM _thalesAMM) external onlyOwner {
        thalesAMM = _thalesAMM;
        sUSD.approve(address(thalesAMM), type(uint256).max);
        emit ThalesAMMChanged(address(_thalesAMM));
    }

    /// @notice Set defaultLiquidityProvider wallet
    /// @param _defaultLiquidityProvider default liquidity provider
    function setDefaultLiquidityProvider(address _defaultLiquidityProvider) external onlyOwner {
        defaultLiquidityProvider = _defaultLiquidityProvider;
        emit DefaultLiquidityProviderChanged(_defaultLiquidityProvider);
    }

    /// @notice Set length of rounds
    /// @param _roundLength Length of a round in miliseconds
    function setRoundLength(uint _roundLength) external onlyOwner {
        require(!started, "Can't change round length after start");
        roundLength = _roundLength;
        emit RoundLengthChanged(_roundLength);
    }

    /// @notice This method only serves as a failsafe to extract tokens from a pool round contract
    /// @param tokens to iterate and transfer
    /// @param account Address where to send the tokens
    /// @param amount Amount of tokens to be sent
    /// @param pool where to transfer from
    /// @param all ignore amount and send whole balance
    function transferTokensFromLiquidityPool(
        address[] calldata tokens,
        address payable account,
        uint amount,
        bool all,
        address pool
    ) external onlyOwner {
        require(tokens.length > 0, "tokens array cant be empty");
        for (uint256 index = 0; index < tokens.length; index++) {
            if (all) {
                IERC20Upgradeable(tokens[index]).safeTransferFrom(
                    pool,
                    account,
                    IERC20Upgradeable(tokens[index]).balanceOf(pool)
                );
            } else {
                IERC20Upgradeable(tokens[index]).safeTransferFrom(pool, account, amount);
            }
        }
    }

    /// @notice This method only serves as a failsafe to extract tokens from this contract
    /// @param tokens to iterate and transfer
    /// @param account Address where to send the tokens
    /// @param amount Amount of tokens to be sent
    /// @param all ignore amount and send whole balance
    function transferTokens(
        address[] calldata tokens,
        address payable account,
        uint amount,
        bool all
    ) external onlyOwner {
        require(tokens.length > 0, "Whitelisted addresses cannot be empty");
        for (uint256 index = 0; index < tokens.length; index++) {
            if (all) {
                IERC20Upgradeable(tokens[index]).safeTransfer(
                    account,
                    IERC20Upgradeable(tokens[index]).balanceOf(address(this))
                );
            } else {
                IERC20Upgradeable(tokens[index]).safeTransfer(account, amount);
            }
        }
    }

    /// @notice set addresses which can deposit into the AMM bypassing the staking checks
    /// @param _whitelistedAddresses Addresses to set the whitelist flag for
    /// @param _flag to set
    function setWhitelistedAddresses(address[] calldata _whitelistedAddresses, bool _flag) external onlyOwner {
        require(_whitelistedAddresses.length > 0, "Whitelisted addresses cannot be empty");
        for (uint256 index = 0; index < _whitelistedAddresses.length; index++) {
            // only if current flag is different, if same skip it
            if (whitelistedDeposits[_whitelistedAddresses[index]] != _flag) {
                whitelistedDeposits[_whitelistedAddresses[index]] = _flag;
                emit AddedIntoWhitelist(_whitelistedAddresses[index], _flag);
            }
        }
    }

    /// @notice set addresses which can deposit into the AMM when only whitelisted stakers are allowed
    /// @param _whitelistedAddresses Addresses to set the whitelist flag for
    /// @param _flag to set
    function setWhitelistedStakerAddresses(address[] calldata _whitelistedAddresses, bool _flag) external onlyOwner {
        require(_whitelistedAddresses.length > 0, "Whitelisted addresses cannot be empty");
        for (uint256 index = 0; index < _whitelistedAddresses.length; index++) {
            // only if current flag is different, if same skip it
            if (whitelistedStakers[_whitelistedAddresses[index]] != _flag) {
                whitelistedStakers[_whitelistedAddresses[index]] = _flag;
                emit AddedIntoWhitelistStaker(_whitelistedAddresses[index], _flag);
            }
        }
    }

    /* ========== MODIFIERS ========== */

    modifier canDeposit(uint amount) {
        require(!withdrawalRequested[msg.sender], "Withdrawal is requested, cannot deposit");
        require(amount >= minDepositAmount, "Amount less than minDepositAmount");
        require(totalDeposited + amount <= maxAllowedDeposit, "Deposit amount exceeds AMM LP cap");
        _;
    }

    modifier onlyAMM() {
        require(msg.sender == address(thalesAMM), "only the AMM may perform these methods");
        _;
    }

    /* ========== EVENTS ========== */
    event PoolStarted();
    event Deposited(address user, uint amount, uint round);
    event WithdrawalRequested(address user);
    event RoundClosed(uint round, uint roundPnL);
    event Claimed(address user, uint amount);
    event RoundPoolCreated(uint _round, address roundPool);
    event PoolRoundMastercopyChanged(address newMastercopy);
    event StakedThalesMultiplierChanged(uint _stakedThalesMultiplier);
    event StakingThalesChanged(address stakingThales);
    event MaxAllowedDepositChanged(uint maxAllowedDeposit);
    event MinAllowedDepositChanged(uint minAllowedDeposit);
    event MaxAllowedUsersChanged(uint MaxAllowedUsersChanged);
    event ThalesAMMChanged(address thalesAMM);
    event DefaultLiquidityProviderChanged(address newProvider);
    event AddedIntoWhitelist(address _whitelistAddress, bool _flag);
    event AddedIntoWhitelistStaker(address _whitelistAddress, bool _flag);
    event RoundLengthChanged(uint roundLength);
}

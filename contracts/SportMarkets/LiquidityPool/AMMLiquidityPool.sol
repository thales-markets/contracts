// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";

import "../../interfaces/ISportsAMM.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/IStakingThales.sol";

import "./AMMLiquidityPoolRound.sol";

contract AMMLiquidityPool is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    /* ========== LIBRARIES ========== */
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct InitParams {
        address _owner;
        ISportsAMM _sportsAmm;
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

    ISportsAMM public sportsAMM;
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
    mapping(uint => uint) public allocationSpentInARound;

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

    /// @return The address of the Staking contract
    IStakingThales public stakingThales;

    /* ========== CONSTRUCTOR ========== */

    function initialize(InitParams calldata params) external initializer {
        setOwner(params._owner);
        initNonReentrant();
        sportsAMM = ISportsAMM(params._sportsAmm);

        sUSD = params._sUSD;
        roundLength = params._roundLength;
        maxAllowedDeposit = params._maxAllowedDeposit;
        minDepositAmount = params._minDepositAmount;
        maxAllowedUsers = params._maxAllowedUsers;

        sUSD.approve(address(sportsAMM), type(uint256).max);
    }

    /// @notice Start vault and begin round #1
    function start() external onlyOwner {
        require(!started, "Liquidity pool has already started");
        round = 1;
        firstRoundStartTime = block.timestamp;
        started = true;
    }

    /// @notice Deposit funds from user into vault for the next round
    /// @param amount Value to be deposited
    function deposit(uint amount) external canDeposit(amount) {
        //TODO: deposit should be called by default treasury depositor whenever a trade is tried for an unstarted round

        address roundPool = _getOrCreateRoundPool(round);
        sUSD.safeTransferFrom(msg.sender, roundPool, amount);

        uint nextRound = round + 1;

        // new user enters the vault
        if (balancesPerRound[round][msg.sender] == 0 && balancesPerRound[nextRound][msg.sender] == 0) {
            require(usersCurrentlyInPool < maxAllowedUsers, "Max amount of users reached");
            usersPerRound[nextRound].push(msg.sender);
            userInRound[nextRound][msg.sender] = true;
            usersCurrentlyInPool = usersCurrentlyInPool + 1;
        }

        balancesPerRound[nextRound][msg.sender] += amount;

        allocationPerRound[nextRound] += amount;

        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(msg.sender, amount);
        }

        emit Deposited(msg.sender, amount, round);
    }

    function _depositAsDefault(uint amount, uint _round) internal {
        require(defaultLiquidityProvider != address(0), "default liquidity provider not set");

        address roundPool = _getOrCreateRoundPool(_round);
        sUSD.safeTransferFrom(defaultLiquidityProvider, roundPool, amount);

        balancesPerRound[_round][msg.sender] += amount;
        allocationPerRound[_round] += amount;

        emit Deposited(defaultLiquidityProvider, amount, _round);
    }

    function commitTrade(
        address market,
        uint sUSDAmount,
        ISportsAMM.Position position
    ) external nonReentrant whenNotPaused onlyAMM returns (address liquidityPoolRound) {
        require(started, "Pool has not started");

        uint marketRound = _getMarketRound(market);
        liquidityPoolRound = _getOrCreateRoundPool(marketRound);

        if (marketRound == round) {
            sUSD.safeTransferFrom(liquidityPoolRound, address(sportsAMM), sUSDAmount);
        } else {
            uint poolBalance = sUSD.balanceOf(liquidityPoolRound);
            if (poolBalance > sUSDAmount) {
                sUSD.safeTransferFrom(liquidityPoolRound, address(sportsAMM), sUSDAmount);
            } else {
                uint differenceToLPAsDefault = sUSDAmount - poolBalance;
                _depositAsDefault(differenceToLPAsDefault, marketRound);
                sUSD.safeTransferFrom(liquidityPoolRound, address(sportsAMM), sUSDAmount);
            }
        }

        if (!isTradingMarketInARound[marketRound][market]) {
            tradingMarketsPerRound[marketRound].push(market);
            isTradingMarketInARound[marketRound][market] = true;
        }
    }

    function getMarketPool(address market) external view returns (address roundPool) {
        roundPool = roundPools[_getMarketRound(market)];
    }

    function getOrCreateMarketPool(address market) external returns (address roundPool) {
        uint marketRound = _getMarketRound(market);
        roundPool = _getOrCreateRoundPool(marketRound);
    }

    function withdrawalRequest() external {
        require(started, "Pool has not started");
        require(!withdrawalRequested[msg.sender], "Withdrawal already requested");
        require(balancesPerRound[round][msg.sender] > 0, "Nothing to withdraw");
        require(balancesPerRound[round + 1][msg.sender] == 0, "Can't withdraw as you already deposited for next round");

        usersCurrentlyInPool = usersCurrentlyInPool - 1;
        withdrawalRequested[msg.sender] = true;
        emit WithdrawalRequested(msg.sender);
    }

    /// @notice Close current round and begin next round,
    /// excercise options of trading markets and calculate profit and loss
    function closeRound() external nonReentrant whenNotPaused {
        require(canCloseCurrentRound(), "Can't close current round");
        // excercise market options
        _exerciseMarketsReadyToExercised();

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
                if (!withdrawalRequested[user]) {
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

        if (round == 1) {
            cumulativeProfitAndLoss[round] = profitAndLossPerRound[round];
        } else {
            cumulativeProfitAndLoss[round] = (cumulativeProfitAndLoss[round - 1] * profitAndLossPerRound[round]) / ONE;
        }

        // start next round
        round += 1;

        //add all carried over sUSD
        allocationPerRound[round] += sUSD.balanceOf(roundPool);

        address roundPoolNewRound = _getOrCreateRoundPool(round);
        sUSD.safeTransferFrom(roundPool, roundPoolNewRound, sUSD.balanceOf(roundPool));

        emit RoundClosed(round - 1, profitAndLossPerRound[round - 1]);
    }

    /* ========== VIEWS ========== */

    /// @notice Checks if all conditions are met to close the round
    /// @return bool
    function canCloseCurrentRound() public view returns (bool) {
        if (!started || block.timestamp < getRoundEndTime(round)) {
            return false;
        }
        for (uint i = 0; i < tradingMarketsPerRound[round].length; i++) {
            IPositionalMarket market = IPositionalMarket(tradingMarketsPerRound[round][i]);
            if ((!market.resolved())) {
                return false;
            }
        }
        return true;
    }

    /// @notice Return multiplied PnLs between rounds
    /// @param roundA Round number from
    /// @param roundB Round number to
    /// @return uint
    function cumulativePnLBetweenRounds(uint roundA, uint roundB) public view returns (uint) {
        return (cumulativeProfitAndLoss[roundB] * profitAndLossPerRound[roundA]) / cumulativeProfitAndLoss[roundA];
    }

    function getRoundStartTime(uint round) public view returns (uint) {
        return firstRoundStartTime + (round - 1) * roundLength;
    }

    function getRoundEndTime(uint round) public view returns (uint) {
        return firstRoundStartTime + round * roundLength;
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function _exerciseMarketsReadyToExercised() internal {
        AMMLiquidityPoolRound poolRound = AMMLiquidityPoolRound(roundPools[round]);
        IPositionalMarket market;
        for (uint i = 0; i < tradingMarketsPerRound[round].length; i++) {
            market = IPositionalMarket(tradingMarketsPerRound[round][i]);
            poolRound.exerciseMarketReadyToExercised(market);
        }
    }

    function _getMarketRound(address market) internal view returns (uint _round) {
        ISportPositionalMarket marketContract = ISportPositionalMarket(market);
        (uint maturity, ) = marketContract.times();
        _round = (maturity - firstRoundStartTime) / roundLength;
    }

    function _getOrCreateRoundPool(uint _round) internal returns (address roundPool) {
        roundPool = roundPools[_round];
        if (roundPool == address(0)) {
            AMMLiquidityPoolRound newRoundPool = new AMMLiquidityPoolRound();
            newRoundPool.initialize(this, sUSD, round + 1, getRoundEndTime(round), getRoundEndTime(round + 1));
            roundPool = address(newRoundPool);
            roundPools[_round] = roundPool;

            emit RoundPoolCreated(_round, roundPool);
        }
    }

    /* ========== MODIFIERS ========== */

    modifier canDeposit(uint amount) {
        require(!withdrawalRequested[msg.sender], "Withdrawal is requested, cannot deposit");
        require(amount >= minDepositAmount, "Invalid amount");
        require((sUSD.balanceOf(address(this)) + amount) <= maxAllowedDeposit, "Deposit amount exceeds pool cap");
        _;
    }

    modifier onlyAMM() {
        require(msg.sender == address(sportsAMM), "only the AMM may perform these methods");
        _;
    }

    /* ========== EVENTS ========== */
    event Deposited(address user, uint amount, uint round);
    event WithdrawalRequested(address user);
    event RoundClosed(uint round, uint roundPnL);
    event Claimed(address user, uint amount);
    event RoundPoolCreated(uint _round, address roundPool);
}

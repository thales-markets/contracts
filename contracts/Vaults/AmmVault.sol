// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";

import "../interfaces/IThalesAMM.sol";
import "../interfaces/ISportPositionalMarket.sol";
import "../interfaces/IStakingThales.sol";

contract AmmVault is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    /* ========== LIBRARIES ========== */
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct DepositReceipt {
        uint round;
        uint amount;
    }

    struct InitParams {
        address _owner;
        IThalesAMM _thalesAmm;
        IERC20Upgradeable _sUSD;
        uint _roundLength;
        uint _priceLowerLimit;
        uint _priceUpperLimit;
        int _skewImpactLimit;
        uint _allocationLimitsPerMarketPerRound;
        uint _maxAllowedDeposit;
        uint _utilizationRate;
        uint _minDepositAmount;
        uint _maxAllowedUsers;
        uint _minTradeAmount;
    }

    /* ========== CONSTANTS ========== */
    uint private constant HUNDRED = 1e20;
    uint private constant ONE = 1e18;

    /* ========== STATE VARIABLES ========== */

    IThalesAMM public thalesAMM;
    IERC20Upgradeable public sUSD;

    bool public vaultStarted;

    uint public round;
    uint public roundLength;
    mapping(uint => uint) public roundStartTime;

    mapping(uint => address[]) public usersPerRound;
    mapping(uint => mapping(address => bool)) public userInRound;

    mapping(uint => mapping(address => uint)) public balancesPerRound;
    mapping(address => bool) public withdrawalRequested;
    mapping(address => DepositReceipt) public depositReceipts;

    mapping(uint => uint) public allocationPerRound;

    mapping(uint => address[]) public tradingMarketsPerRound;
    mapping(uint => mapping(address => IThalesAMM.Position)) public tradingMarketPositionPerRound;
    mapping(uint => mapping(address => bool)) public isTradingMarketInARound;

    mapping(uint => uint) public profitAndLossPerRound;
    mapping(uint => uint) public cumulativeProfitAndLoss;

    uint public maxAllowedDeposit;
    uint public utilizationRate;

    mapping(uint => uint) public capPerRound;

    uint public minDepositAmount;

    uint public maxAllowedUsers;
    uint public usersCurrentlyInVault;

    uint public allocationLimitsPerMarketPerRound;

    mapping(uint => mapping(address => uint)) public allocationSpentPerRound;

    uint public priceLowerLimit;
    uint public priceUpperLimit;
    int public skewImpactLimit;

    uint public minTradeAmount;

    /// @return The address of the Staking contract
    IStakingThales public stakingThales;

    mapping(uint => uint) public allocationSpentInARound;

    /* ========== CONSTRUCTOR ========== */

    function __BaseVault_init(
        address _owner,
        IThalesAMM _thalesAmm,
        IERC20Upgradeable _sUSD,
        uint _roundLength,
        uint _maxAllowedDeposit,
        uint _utilizationRate,
        uint _minDepositAmount,
        uint _maxAllowedUsers
    ) internal onlyInitializing {
        setOwner(_owner);
        initNonReentrant();
        thalesAMM = IThalesAMM(_thalesAmm);

        sUSD = _sUSD;
        roundLength = _roundLength;
        maxAllowedDeposit = _maxAllowedDeposit;
        utilizationRate = _utilizationRate;
        minDepositAmount = _minDepositAmount;
        maxAllowedUsers = _maxAllowedUsers;

        sUSD.approve(address(thalesAMM), type(uint256).max);
    }

    function initialize(InitParams calldata params) external initializer {
        __BaseVault_init(
            params._owner,
            params._thalesAmm,
            params._sUSD,
            params._roundLength,
            params._maxAllowedDeposit,
            params._utilizationRate,
            params._minDepositAmount,
            params._maxAllowedUsers
        );
        priceLowerLimit = params._priceLowerLimit;
        priceUpperLimit = params._priceUpperLimit;
        skewImpactLimit = params._skewImpactLimit;
        allocationLimitsPerMarketPerRound = params._allocationLimitsPerMarketPerRound;
        minTradeAmount = params._minTradeAmount;
    }

    /// @notice Start vault and begin round #1
    function startVault() external onlyOwner {
        require(!vaultStarted, "Vault has already started");
        round = 1;

        roundStartTime[round] = block.timestamp;

        vaultStarted = true;

        capPerRound[2] = capPerRound[1];

        emit VaultStarted();
    }

    /// @notice Close current round and begin next round,
    /// excercise options of trading markets and calculate profit and loss
    function closeRound() external nonReentrant whenNotPaused {
        require(canCloseCurrentRound(), "Can't close current round");
        // excercise market options
        _exerciseMarketsReadyToExercised();

        // balance in next round does not affect PnL in a current round
        uint currentVaultBalance = sUSD.balanceOf(address(this)) - allocationPerRound[round + 1];
        // calculate PnL

        // if no allocation for current round
        if (allocationPerRound[round] == 0) {
            profitAndLossPerRound[round] = 1;
        } else {
            profitAndLossPerRound[round] = (currentVaultBalance * ONE) / allocationPerRound[round];
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
                        stakingThales.updateVolume(user, balancesPerRound[round + 1][user]);
                    }
                } else {
                    balancesPerRound[round + 1][user] = 0;
                    sUSD.safeTransfer(user, balanceAfterCurRound);
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

        roundStartTime[round] = block.timestamp;

        // allocation for next round doesn't include withdrawal queue share from previous round
        allocationPerRound[round] = sUSD.balanceOf(address(this));
        capPerRound[round + 1] = allocationPerRound[round];

        emit RoundClosed(round - 1, profitAndLossPerRound[round - 1]);
    }

    /// @notice Deposit funds from user into vault for the next round
    /// @param amount Value to be deposited
    function deposit(uint amount) external canDeposit(amount) {
        sUSD.safeTransferFrom(msg.sender, address(this), amount);

        uint nextRound = round + 1;

        // new user enters the vault
        if (balancesPerRound[round][msg.sender] == 0 && balancesPerRound[nextRound][msg.sender] == 0) {
            require(usersCurrentlyInVault < maxAllowedUsers, "Max amount of users reached");
            usersPerRound[nextRound].push(msg.sender);
            userInRound[nextRound][msg.sender] = true;
            usersCurrentlyInVault = usersCurrentlyInVault + 1;
        }

        if (balancesPerRound[round][msg.sender] == 0) {
            if (address(stakingThales) != address(0)) {
                stakingThales.updateVolume(msg.sender, amount);
            }
        }

        balancesPerRound[nextRound][msg.sender] += amount;

        // update deposit state of a user
        depositReceipts[msg.sender] = DepositReceipt(nextRound, balancesPerRound[nextRound][msg.sender]);

        allocationPerRound[nextRound] += amount;
        capPerRound[nextRound] += amount;

        emit Deposited(msg.sender, amount);
    }

    function withdrawalRequest() external {
        require(vaultStarted, "Vault has not started");
        require(!withdrawalRequested[msg.sender], "Withdrawal already requested");
        require(balancesPerRound[round][msg.sender] > 0, "Nothing to withdraw");
        require(balancesPerRound[round + 1][msg.sender] == 0, "Can't withdraw as you already deposited for next round");

        uint nextRound = round + 1;
        if (capPerRound[nextRound] > balancesPerRound[round][msg.sender]) {
            capPerRound[nextRound] -= balancesPerRound[round][msg.sender];
        }

        usersCurrentlyInVault = usersCurrentlyInVault - 1;
        withdrawalRequested[msg.sender] = true;
        emit WithdrawalRequested(msg.sender);
    }

    /// @notice Buy market options from Thales AMM
    /// @param market address of a market
    /// @param amount number of options to be bought
    /// @param position to buy options for
    function trade(
        address market,
        uint amount,
        IThalesAMM.Position position
    ) external nonReentrant whenNotPaused {
        require(vaultStarted, "Vault has not started");
        require(amount >= minTradeAmount, "Amount less than minimum");

        IPositionalMarket marketContract = IPositionalMarket(market);
        (uint maturity, ) = marketContract.times();
        require(maturity < (roundStartTime[round] + roundLength), "Market time not valid");

        uint pricePosition = thalesAMM.buyFromAmmQuote(address(market), position, ONE);
        require(pricePosition > 0, "Price not more than 0");

        int pricePositionImpact = thalesAMM.buyPriceImpact(address(market), position, amount);

        require(pricePosition >= priceLowerLimit && pricePosition <= priceUpperLimit, "Market price not valid");
        require(pricePositionImpact < skewImpactLimit, "Skew impact too high");
        _buyFromAmm(market, position, amount);

        if (!isTradingMarketInARound[round][market]) {
            tradingMarketsPerRound[round].push(market);
            isTradingMarketInARound[round][market] = true;
        }
    }

    /// @notice Set length of rounds
    /// @param _roundLength Length of a round in miliseconds
    function setRoundLength(uint _roundLength) external onlyOwner {
        roundLength = _roundLength;
        emit RoundLengthChanged(_roundLength);
    }

    /// @notice Set ThalesAMM contract
    /// @param _thalesAMM ThalesAMM address
    function setThalesAmm(IThalesAMM _thalesAMM) external onlyOwner {
        thalesAMM = _thalesAMM;
        sUSD.approve(address(thalesAMM), type(uint256).max);
        emit ThalesAMMChanged(address(_thalesAMM));
    }

    /// @notice Set IStakingThales contract
    /// @param _stakingThales IStakingThales address
    function setStakingThales(IStakingThales _stakingThales) external onlyOwner {
        stakingThales = _stakingThales;
        emit StakingThalesChanged(address(_stakingThales));
    }

    /// @notice Set utilization rate parameter
    /// @param _utilizationRate Value in percents
    function setUtilizationRate(uint _utilizationRate) external onlyOwner {
        utilizationRate = _utilizationRate;
        emit UtilizationRateChanged(_utilizationRate);
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

    /// @notice Set allocation limits for assets to be spent in one round
    /// @param _allocationLimitsPerMarketPerRound allocation per market in percent
    function setAllocationLimits(uint _allocationLimitsPerMarketPerRound) external onlyOwner {
        require(_allocationLimitsPerMarketPerRound < HUNDRED, "Invalid allocation limit values");
        allocationLimitsPerMarketPerRound = _allocationLimitsPerMarketPerRound;
        emit SetAllocationLimits(allocationLimitsPerMarketPerRound);
    }

    /// @notice Set price limit for options to be bought from AMM
    /// @param _priceLowerLimit lower limit
    /// @param _priceUpperLimit upper limit
    function setPriceLimits(uint _priceLowerLimit, uint _priceUpperLimit) external onlyOwner {
        require(_priceLowerLimit < _priceUpperLimit, "Invalid price limit values");
        priceLowerLimit = _priceLowerLimit;
        priceUpperLimit = _priceUpperLimit;
        emit SetPriceLimits(_priceLowerLimit, _priceUpperLimit);
    }

    /// @notice Set skew impact limit for AMM
    /// @param _skewImpactLimit limit in percents
    function setSkewImpactLimit(int _skewImpactLimit) external onlyOwner {
        skewImpactLimit = _skewImpactLimit;
        emit SetSkewImpactLimit(_skewImpactLimit);
    }

    /// @notice Set _minTradeAmount
    /// @param _minTradeAmount limit in percents
    function setMinTradeAmount(uint _minTradeAmount) external onlyOwner {
        minTradeAmount = _minTradeAmount;
        emit SetMinTradeAmount(_minTradeAmount);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function _exerciseMarketsReadyToExercised() internal {
        ISportPositionalMarket market;
        for (uint i = 0; i < tradingMarketsPerRound[round].length; i++) {
            market = ISportPositionalMarket(tradingMarketsPerRound[round][i]);
            if (!market.paused() && market.resolved()) {
                (uint homeBalance, uint awayBalance, uint drawBalance) = market.balancesOf(address(this));
                if (homeBalance > 0 || awayBalance > 0 || drawBalance > 0) {
                    market.exerciseOptions();
                }
            }
        }
    }

    /// @notice Buy options from AMM
    /// @param market address of a market
    /// @param position position to be bought
    /// @param amount amount of positions to be bought
    function _buyFromAmm(
        address market,
        IThalesAMM.Position position,
        uint amount
    ) internal {
        if (isTradingMarketInARound[round][market]) {
            require(
                tradingMarketPositionPerRound[round][market] == position,
                "Cannot trade different options on the same market"
            );
        }
        uint quote = thalesAMM.buyFromAmmQuote(market, position, amount);
        require(quote < (tradingAllocation() - allocationSpentInARound[round]), "Amount exceeds available allocation");

        uint allocationAsset = (tradingAllocation() * allocationLimitsPerMarketPerRound) / HUNDRED;
        require(
            (quote + allocationSpentPerRound[round][market]) < allocationAsset,
            "Amount exceeds available allocation for asset"
        );

        uint balanceBeforeTrade = sUSD.balanceOf(address(this));

        thalesAMM.buyFromAMM(market, position, amount, quote, 0);

        uint balanceAfterTrade = sUSD.balanceOf(address(this));

        allocationSpentInARound[round] += quote;
        allocationSpentPerRound[round][market] += quote;
        tradingMarketPositionPerRound[round][market] = position;

        emit TradeExecuted(market, position, amount, quote);
    }

    /// @notice Return trading allocation in current round based on utilization rate param
    /// @return uint
    function tradingAllocation() public view returns (uint) {
        return (allocationPerRound[round] * utilizationRate) / ONE;
    }

    /* ========== VIEWS ========== */

    /// @notice Checks if all conditions are met to close the round
    /// @return bool
    function canCloseCurrentRound() public view returns (bool) {
        if (!vaultStarted || block.timestamp < (roundStartTime[round] + roundLength)) {
            return false;
        }
        for (uint i = 0; i < tradingMarketsPerRound[round].length; i++) {
            ISportPositionalMarket market = ISportPositionalMarket(tradingMarketsPerRound[round][i]);
            if ((!market.resolved()) || market.paused()) {
                return false;
            }
        }
        return true;
    }

    /// @notice Get available amount to spend on an asset in a round
    /// @param market to fetch available allocation for
    /// @return uint
    function getAvailableAllocationForMarket(address market) external view returns (uint) {
        uint allocationMarket = (tradingAllocation() * allocationLimitsPerMarketPerRound) / HUNDRED;
        uint remainingAvailable = allocationMarket - allocationSpentPerRound[round][market];

        return
            remainingAvailable < (tradingAllocation() - allocationSpentInARound[round])
                ? remainingAvailable
                : (tradingAllocation() - allocationSpentInARound[round]);
    }

    /// @notice Return user balance in a round
    /// @param _round Round number
    /// @param user Address of the user
    /// @return uint
    function getBalancesPerRound(uint _round, address user) external view returns (uint) {
        return balancesPerRound[_round][user];
    }

    /// @notice Return available to deposit
    /// @return uint
    function getAvailableToDeposit() external view returns (uint) {
        return maxAllowedDeposit - capPerRound[round + 1];
    }

    /// @notice end of current round
    /// @return uint
    function getCurrentRoundEnd() external view returns (uint) {
        return roundStartTime[round] + roundLength;
    }

    /// @notice Return multiplied PnLs between rounds
    /// @param roundA Round number from
    /// @param roundB Round number to
    /// @return uint
    function cumulativePnLBetweenRounds(uint roundA, uint roundB) public view returns (uint) {
        return (cumulativeProfitAndLoss[roundB] * profitAndLossPerRound[roundA]) / cumulativeProfitAndLoss[roundA];
    }

    /* ========== MODIFIERS ========== */

    modifier canDeposit(uint amount) {
        require(!withdrawalRequested[msg.sender], "Withdrawal is requested, cannot deposit");
        require(amount >= minDepositAmount, "Invalid amount");
        require(capPerRound[round + 1] + amount <= maxAllowedDeposit, "Deposit amount exceeds vault cap");
        _;
    }

    /* ========== EVENTS ========== */

    event VaultStarted();
    event RoundClosed(uint round, uint roundPnL);
    event RoundLengthChanged(uint roundLength);
    event ThalesAMMChanged(address thalesAmm);
    event StakingThalesChanged(address stakingThales);
    event SetSUSD(address sUSD);
    event Deposited(address user, uint amount);
    event Claimed(address user, uint amount);
    event WithdrawalRequested(address user);
    event UtilizationRateChanged(uint utilizationRate);
    event MaxAllowedDepositChanged(uint maxAllowedDeposit);
    event MinAllowedDepositChanged(uint minAllowedDeposit);
    event MaxAllowedUsersChanged(uint MaxAllowedUsersChanged);
    event SetAllocationLimits(uint allocationLimitsPerMarketPerRound);
    event SetPriceLimits(uint priceLowerLimit, uint priceUpperLimit);
    event SetSkewImpactLimit(int skewImpact);
    event SetMinTradeAmount(uint SetMinTradeAmount);
    event TradeExecuted(address market, IThalesAMM.Position position, uint amount, uint quote);
}

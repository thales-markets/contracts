// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";

import "../interfaces/ISportsAMM.sol";
import "../interfaces/IParlayMarketsAMM.sol";
import "../interfaces/ISportPositionalMarket.sol";
import "../interfaces/IStakingThales.sol";

import "../SportMarkets/Parlay/ParlayMarket.sol";

contract ParlayVault is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    /* ========== LIBRARIES ========== */
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct DepositReceipt {
        uint round;
        uint amount;
    }

    struct InitParams {
        address _owner;
        IParlayMarketsAMM _parlayAMM;
        IERC20Upgradeable _sUSD;
        uint _roundLength;
        uint _priceLowerLimit;
        uint _priceUpperLimit;
        int _skewImpactLimit;
        uint _maxAllowedDeposit;
        uint _utilizationRate;
        uint _maxTradeRate;
        uint _minDepositAmount;
        uint _maxAllowedUsers;
        uint _minTradeAmount;
        uint _maxMarketUsedInRoundCount;
    }

    /* ========== CONSTANTS ========== */
    uint private constant HUNDRED = 1e20;
    uint private constant ONE = 1e18;

    /* ========== STATE VARIABLES ========== */

    IParlayMarketsAMM public parlayAMM;
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

    mapping(uint => address[]) public tradingParlayMarketsPerRound;
    mapping(uint => mapping(bytes32 => bool)) public isTradingParlayMarketInARound;

    mapping(uint => uint) public profitAndLossPerRound;
    mapping(uint => uint) public cumulativeProfitAndLoss;

    uint public maxAllowedDeposit;
    uint public utilizationRate;
    uint public maxTradeRate;

    mapping(uint => uint) public capPerRound;

    uint public minDepositAmount;

    uint public maxAllowedUsers;
    uint public usersCurrentlyInVault;

    uint public priceLowerLimit;
    uint public priceUpperLimit;
    int public skewImpactLimit;

    uint public minTradeAmount;

    /// @return The address of the Staking contract
    IStakingThales public stakingThales;

    mapping(uint => uint) public allocationSpentInARound;

    mapping(uint => mapping(address => uint)) public marketUsedInRoundCount;
    uint public maxMarketUsedInRoundCount;

    /* ========== CONSTRUCTOR ========== */

    function __BaseSportVault_init(
        address _owner,
        IParlayMarketsAMM _parlayAMM,
        IERC20Upgradeable _sUSD,
        uint _roundLength,
        uint _maxAllowedDeposit,
        uint _utilizationRate,
        uint _maxTradeRate,
        uint _minDepositAmount,
        uint _maxAllowedUsers,
        uint _maxMarketUsedInRoundCount
    ) internal onlyInitializing {
        setOwner(_owner);
        initNonReentrant();
        parlayAMM = IParlayMarketsAMM(_parlayAMM);

        sUSD = _sUSD;
        roundLength = _roundLength;
        maxAllowedDeposit = _maxAllowedDeposit;
        utilizationRate = _utilizationRate;
        maxTradeRate = _maxTradeRate;
        minDepositAmount = _minDepositAmount;
        maxAllowedUsers = _maxAllowedUsers;
        maxMarketUsedInRoundCount = _maxMarketUsedInRoundCount;

        sUSD.approve(address(parlayAMM), type(uint256).max);
    }

    function initialize(InitParams calldata params) external initializer {
        __BaseSportVault_init(
            params._owner,
            params._parlayAMM,
            params._sUSD,
            params._roundLength,
            params._maxAllowedDeposit,
            params._utilizationRate,
            params._maxTradeRate,
            params._minDepositAmount,
            params._maxAllowedUsers,
            params._maxMarketUsedInRoundCount
        );
        priceLowerLimit = params._priceLowerLimit;
        priceUpperLimit = params._priceUpperLimit;
        skewImpactLimit = params._skewImpactLimit;
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
                        stakingThales.updateVolume(user, balanceAfterCurRound);
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

        balancesPerRound[nextRound][msg.sender] += amount;

        // update deposit state of a user
        depositReceipts[msg.sender] = DepositReceipt(nextRound, balancesPerRound[nextRound][msg.sender]);

        allocationPerRound[nextRound] += amount;
        capPerRound[nextRound] += amount;

        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(msg.sender, amount);
        }

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
    /// @param sportMarkets parlay market addresses
    /// @param positions to buy options for
    /// @param sUSDPaid amount to pay for parlay
    function trade(
        address[] calldata sportMarkets,
        uint[] calldata positions,
        uint sUSDPaid
    ) external nonReentrant whenNotPaused {
        require(vaultStarted, "Vault has not started");
        require(sUSDPaid >= minTradeAmount, "Amount less than minimum");
        require(sUSDPaid < (tradingAllocation() * maxTradeRate) / ONE, "Amount exceeds max value per trade");
        require(sUSDPaid < (tradingAllocation() - allocationSpentInARound[round]), "Amount exceeds available allocation");

        require(!parlayExistsInARound(round, sportMarkets), "Parlay market already exists in a round");

        (uint expectedPayout, , , , , uint[] memory finalQuotes, uint[] memory amountsToBuy) = parlayAMM.buyQuoteFromParlay(
            sportMarkets,
            positions,
            sUSDPaid
        );

        for (uint i = 0; i < sportMarkets.length; i++) {
            _checkSportMarket(sportMarkets[i], positions[i], finalQuotes[i], amountsToBuy[i]);
        }

        require(parlayAMM.canCreateParlayMarket(sportMarkets, positions, sUSDPaid), "Cannot create parlay");

        _buyFromParlay(sportMarkets, positions, sUSDPaid, expectedPayout);
    }

    /// @notice Set length of rounds
    /// @param _roundLength Length of a round in miliseconds
    function setRoundLength(uint _roundLength) external onlyOwner {
        roundLength = _roundLength;
        emit RoundLengthChanged(_roundLength);
    }

    /// @notice Set ParlayMarketsAMM contract
    /// @param _parlayAMM ParlayMarketsAMM address
    function setParlayAMM(IParlayMarketsAMM _parlayAMM) external onlyOwner {
        parlayAMM = _parlayAMM;
        sUSD.approve(address(_parlayAMM), type(uint256).max);
        emit ParlayAMMChanged(address(_parlayAMM));
        (address(_parlayAMM));
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

    /// @notice Set max trade rate parameter
    /// @param _maxTradeRate Value in percents
    function setMaxTradeRate(uint _maxTradeRate) external onlyOwner {
        maxTradeRate = _maxTradeRate;
        emit MaxTradeRateChanged(_maxTradeRate);
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

    /// @notice Set maxMarketUsedInRoundCount
    /// @param _maxMarketUsedInRoundCount Deposit value
    function setMaxMarketUsedInRoundCount(uint _maxMarketUsedInRoundCount) external onlyOwner {
        maxMarketUsedInRoundCount = _maxMarketUsedInRoundCount;
        emit MaxMarketUsedInRoundCountChanged(_maxMarketUsedInRoundCount);
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

    /// @notice Set skew impact limit for sports AMM
    /// @param _skewImpactLimit limit in percents
    function setSkewImpactLimit(int _skewImpactLimit) external onlyOwner {
        skewImpactLimit = _skewImpactLimit;
        emit SetSkewImpactLimit(_skewImpactLimit);
    }

    /// @notice Set _minTradeAmount
    /// @param _minTradeAmount limit in sUSD
    function setMinTradeAmount(uint _minTradeAmount) external onlyOwner {
        minTradeAmount = _minTradeAmount;
        emit SetMinTradeAmount(_minTradeAmount);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    // @notice Exercises parlay markets in a round
    function _exerciseMarketsReadyToExercised() internal {
        ParlayMarket parlayMarket;
        for (uint i = 0; i < tradingParlayMarketsPerRound[round].length; i++) {
            parlayMarket = ParlayMarket(tradingParlayMarketsPerRound[round][i]);
            (bool isExercisable, ) = parlayMarket.isParlayExercisable();
            if (isExercisable) {
                parlayAMM.exerciseParlay(address(parlayMarket));
            }
        }
    }

    /// @notice Buys options from AMM
    /// @param sportMarkets parlay market addresses
    /// @param positions positions to be bought
    /// @param sUSDPaid amount to pay
    function _buyFromParlay(
        address[] calldata sportMarkets,
        uint[] calldata positions,
        uint sUSDPaid,
        uint expectedPayout
    ) internal {
        parlayAMM.buyFromParlay(sportMarkets, positions, sUSDPaid, 0, expectedPayout, address(0));

        allocationSpentInARound[round] += sUSDPaid;

        address[] memory parlayMarket = parlayAMM.activeParlayMarkets(parlayAMM.numActiveParlayMarkets() - 1, 1);

        tradingParlayMarketsPerRound[round].push(parlayMarket[0]);
        isTradingParlayMarketInARound[round][_calculateCombinationKey(sportMarkets)] = true;

        for (uint i = 0; i < sportMarkets.length; i++) {
            marketUsedInRoundCount[round][sportMarkets[i]] += 1;
        }

        emit TradeExecuted(parlayMarket[0], sUSDPaid);
    }

    /// @notice Check sport markets conditions
    /// @param market sport market address
    /// @param position option to be bought
    /// @param finalQuote price fetched from parlay amm
    /// @param amount of positions to be bought
    function _checkSportMarket(
        address market,
        uint position,
        uint finalQuote,
        uint amount
    ) internal {
        ISportPositionalMarket marketContract = ISportPositionalMarket(market);
        (uint maturity, ) = marketContract.times();
        require(maturity < (roundStartTime[round] + roundLength), "Market time not valid");

        ISportsAMM.Position ammPosition = (parlayAMM.parlayVerifier()).obtainSportsAMMPosition(position);

        require(finalQuote > 0, "Price not more than 0");

        require(finalQuote >= priceLowerLimit && finalQuote <= priceUpperLimit, "Market price not valid");
        int pricePositionImpact = ISportsAMM(parlayAMM.sportsAmm()).buyPriceImpact(market, ammPosition, amount);
        require(pricePositionImpact < skewImpactLimit, "Skew impact too high");

        require(
            marketUsedInRoundCount[round][market] <= maxMarketUsedInRoundCount,
            "Market is at the maximum number of tickets"
        );
    }

    /// @notice Calculates parlay combination keys
    /// @param _sportMarkets parlay market addresses
    function _calculateCombinationKey(address[] memory _sportMarkets) internal view returns (bytes32) {
        address[] memory sortedAddresses = new address[](_sportMarkets.length);
        sortedAddresses = (parlayAMM.parlayVerifier()).sort(_sportMarkets);
        return keccak256(abi.encodePacked(sortedAddresses));
    }

    /* ========== VIEWS ========== */

    /// @notice Return trading allocation in current round based on utilization rate param
    /// @return uint
    function tradingAllocation() public view returns (uint) {
        return (allocationPerRound[round] * utilizationRate) / ONE;
    }

    /// @notice Check if same parlay exists
    function parlayExistsInARound(uint _round, address[] calldata _sportMarkets) public view returns (bool) {
        bytes32 combinationKey = _calculateCombinationKey(_sportMarkets);

        return isTradingParlayMarketInARound[_round][combinationKey];
    }

    /// @notice Checks if all conditions are met to close the round
    /// @return bool
    function canCloseCurrentRound() public view returns (bool) {
        if (!vaultStarted || block.timestamp < (roundStartTime[round] + roundLength)) {
            return false;
        }
        for (uint i = 0; i < tradingParlayMarketsPerRound[round].length; i++) {
            ParlayMarket parlayMarket = ParlayMarket(tradingParlayMarketsPerRound[round][i]);
            (bool isResolved, address[] memory resolvableMarkets) = parlayMarket.isAnySportMarketResolved();
            if (!isResolved || parlayMarket.paused()) {
                return false;
            }

            if (resolvableMarkets.length != parlayMarket.numOfSportMarkets()) {
                return false;
            }
        }
        return true;
    }

    /// @notice Return user balance in a round
    /// @param _round Round number
    /// @param user Address of the user
    /// @return uint
    function getBalancesPerRound(uint _round, address user) external view returns (uint) {
        return balancesPerRound[_round][user];
    }

    /// @notice Return available to deposit
    /// @return returned how much more users can deposit
    function getAvailableToDeposit() external view returns (uint returned) {
        if (capPerRound[round + 1] < maxAllowedDeposit) {
            returned = maxAllowedDeposit - capPerRound[round + 1];
        }
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
    event ParlayAMMChanged(address parlayAMM);
    event StakingThalesChanged(address stakingThales);
    event SetSUSD(address sUSD);
    event Deposited(address user, uint amount);
    event Claimed(address user, uint amount);
    event WithdrawalRequested(address user);
    event UtilizationRateChanged(uint utilizationRate);
    event MaxTradeRateChanged(uint maxTradeRate);
    event MaxAllowedDepositChanged(uint maxAllowedDeposit);
    event MinAllowedDepositChanged(uint minAllowedDeposit);
    event MaxAllowedUsersChanged(uint maxAllowedUsersChanged);
    event MaxMarketUsedInRoundCountChanged(uint maxMarketUsedInRoundCount);
    event SetPriceLimits(uint priceLowerLimit, uint priceUpperLimit);
    event SetSkewImpactLimit(int skewImpact);
    event SetMinTradeAmount(uint SetMinTradeAmount);
    event TradeExecuted(address parlayMarket, uint sUSDPaid);
}

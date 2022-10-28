// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";

import "../interfaces/ISportsAMM.sol";
import "../interfaces/ISportPositionalMarket.sol";

contract BaseSportVault is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    /* ========== LIBRARIES ========== */
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct DepositReceipt {
        uint round;
        uint amount;
    }

    /* ========== CONSTANTS ========== */
    uint private constant HUNDRED = 1e20;
    uint private constant ONE = 1e18;

    /* ========== STATE VARIABLES ========== */

    ISportsAMM public sportsAMM;
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
    mapping(uint => mapping(address => ISportsAMM.Position)) public tradingMarketPositionPerRound;
    mapping(uint => mapping(address => bool)) public isTradingMarketInARound;

    mapping(uint => uint) public profitAndLossPerRound;

    uint public maxAllowedDeposit;
    uint public utilizationRate;

    mapping(uint => uint) public capPerRound;

    uint public minDepositAmount;

    uint public maxAllowedUsers;
    uint public usersCurrentlyInVault;

    //TODO: add staking thales so gamified staking bonuses are updated on every round closing

    /* ========== CONSTRUCTOR ========== */

    function __BaseSportVault_init(
        address _owner,
        ISportsAMM _sportAmm,
        IERC20Upgradeable _sUSD,
        uint _roundLength,
        uint _maxAllowedDeposit,
        uint _utilizationRate,
        uint _minDepositAmount,
        uint _maxAllowedUsers
    ) internal onlyInitializing {
        setOwner(_owner);
        initNonReentrant();
        sportsAMM = ISportsAMM(_sportAmm);

        sUSD = _sUSD;
        roundLength = _roundLength;
        maxAllowedDeposit = _maxAllowedDeposit;
        utilizationRate = _utilizationRate;
        minDepositAmount = _minDepositAmount;
        maxAllowedUsers = _maxAllowedUsers;

        sUSD.approve(address(sportsAMM), type(uint256).max);
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
        exerciseMarketsReadyToExercise();

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
            if (userInRound[round][user]) {
                if (!withdrawalRequested[user]) {
                    balancesPerRound[round + 1][user] =
                        ((balancesPerRound[round][user] + balancesPerRound[round + 1][user]) *
                            profitAndLossPerRound[round]) /
                        ONE;
                    userInRound[round + 1][user] = true;
                    usersPerRound[round + 1].push(user);
                } else {
                    balancesPerRound[round + 1][user] = 0;
                    uint withdrawable = (balancesPerRound[round][user] * profitAndLossPerRound[round]) / ONE;
                    sUSD.safeTransfer(user, withdrawable);
                    withdrawalRequested[user] = false;
                    userInRound[round + 1][user] = false;
                    usersCurrentlyInVault = usersCurrentlyInVault - 1;
                    emit Claimed(user, withdrawable);
                }
            }
        }

        // start next round
        round += 1;

        roundStartTime[round] = block.timestamp;

        // allocation for next round doesn't include withdrawal queue share from previous round
        allocationPerRound[round] = sUSD.balanceOf(address(this));
        capPerRound[round + 1] = allocationPerRound[round];

        emit RoundClosed(round - 1);
    }

    /// @notice Deposit funds from user into vault for the next round
    /// @param amount Value to be deposited
    function deposit(uint amount) external canDeposit(amount) {
        sUSD.safeTransferFrom(msg.sender, address(this), amount);

        uint nextRound = round + 1;

        // new user enters the vault
        if (balancesPerRound[round][msg.sender] == 0) {
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

        emit Deposited(msg.sender, amount);
    }

    function withdrawalRequest() external {
        require(vaultStarted, "Vault has not started");
        require(!withdrawalRequested[msg.sender], "Withdrawal already requested");
        require(balancesPerRound[round][msg.sender] > 0, "Nothing to withdraw");
        require(balancesPerRound[round + 1][msg.sender] == 0, "Can't withdraw as you already deposited for next round.");

        uint nextRound = round + 1;
        if (capPerRound[nextRound] > balancesPerRound[round][msg.sender]) {
            capPerRound[nextRound] -= balancesPerRound[round][msg.sender];
        }

        withdrawalRequested[msg.sender] = true;
        emit WithdrawalRequested(msg.sender);
    }

    function exerciseMarketsReadyToExercise() public {
        ISportPositionalMarket market;
        for (uint i = 0; i < tradingMarketsPerRound[round].length; i++) {
            market = ISportPositionalMarket(tradingMarketsPerRound[round][i]);
            if (!market.paused()) {
                if (market.resolved() || market.canResolve()) {
                    (uint homeBalance, uint awayBalance, uint drawBalance) = market.balancesOf(msg.sender);
                    if (homeBalance > 0 || awayBalance > 0 || drawBalance > 0) {
                        market.exerciseOptions();
                    }
                }
            }
        }
    }

    /// @notice Set length of rounds
    /// @param _roundLength Length of a round in miliseconds
    function setRoundLength(uint _roundLength) external onlyOwner {
        roundLength = _roundLength;
        emit RoundLengthChanged(_roundLength);
    }

    /// @notice Set ThalesAMM contract
    /// @param _sportAMM ThalesAMM address
    function setSportAmm(ISportsAMM _sportAMM) external onlyOwner {
        sportsAMM = _sportAMM;
        sUSD.approve(address(sportsAMM), type(uint256).max);
        emit SportAMMChanged(address(_sportAMM));
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

    /* ========== INTERNAL FUNCTIONS ========== */

    /// @notice Return trading allocation in current round based on utilization rate param
    /// @return uint
    function tradingAllocation() public view returns (uint) {
        return (allocationPerRound[round] * utilizationRate) / ONE;
    }

    /* ========== VIEWS ========== */

    function canCloseCurrentRound() public view returns (bool) {
        if (!vaultStarted || block.timestamp < (roundStartTime[round] + roundLength)) {
            return false;
        }
        for (uint i = 0; i < tradingMarketsPerRound[round].length; i++) {
            ISportPositionalMarket market = ISportPositionalMarket(tradingMarketsPerRound[round][i]);
            if ((!market.resolved() && !market.canResolve()) || market.paused()) {
                return false;
            }
        }
        return true;
    }

    function hasMarketsReadyToExercise() external view returns (bool) {
        ISportPositionalMarket market;
        for (uint i = 0; i < tradingMarketsPerRound[round].length; i++) {
            market = ISportPositionalMarket(tradingMarketsPerRound[round][i]);
            if (!market.paused()) {
                if (market.resolved() || market.canResolve()) {
                    (uint homeBalance, uint awayBalance, uint drawBalance) = market.balancesOf(msg.sender);
                    if (homeBalance > 0 || awayBalance > 0 || drawBalance > 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /// @notice Return user balance in a round
    /// @param _round Round number
    /// @param user Address of the user
    /// @return uint
    function getBalancesPerRound(uint _round, address user) external view returns (uint) {
        return balancesPerRound[_round][user];
    }

    function getAvailableToDeposit() external view returns (uint) {
        return maxAllowedDeposit - capPerRound[round + 1];
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
    event RoundClosed(uint round);
    event RoundLengthChanged(uint roundLength);
    event SportAMMChanged(address thalesAmm);
    event SetSUSD(address sUSD);
    event Deposited(address user, uint amount);
    event Claimed(address user, uint amount);
    event WithdrawalRequested(address user);
    event UtilizationRateChanged(uint utilizationRate);
    event MaxAllowedDepositChanged(uint maxAllowedDeposit);
    event MinAllowedDepositChanged(uint minAllowedDeposit);
    event MaxAllowedUsersChanged(uint MaxAllowedUsersChanged);
}

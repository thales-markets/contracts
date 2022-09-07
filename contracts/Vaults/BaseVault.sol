// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";

import "../interfaces/IThalesAMM.sol";
import "../interfaces/IPositionalMarket.sol";

contract BaseVault is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    /* ========== LIBRARIES ========== */
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct WithdrawalRequest {
        uint round;
        uint amount;
        bool requested;
    }

    struct DepositReceipt {
        uint round;
        uint amount;
    }

    /* ========== CONSTANTS ========== */
    uint private constant HUNDRED = 1e20;

    /* ========== STATE VARIABLES ========== */

    IThalesAMM public thalesAMM;
    IERC20Upgradeable public sUSD;

    bool public vaultStarted;

    uint public round;
    uint public roundLength;
    mapping(uint => uint) public roundStartTime;
    mapping(uint => uint) public roundEndTime;

    mapping(uint => address[]) public usersPerRound;
    mapping(uint => mapping(address => uint)) public balancesPerRound;
    mapping(uint => mapping(address => bool)) public claimedPerRound;
    mapping(address => WithdrawalRequest) public withdrawalQueue;
    mapping(address => DepositReceipt) public depositReceipts;
    mapping(uint => uint) public withdrawalQueueAmount;

    mapping(uint => uint) public allocationPerRound;

    mapping(uint => address[]) public tradingMarketsPerRound;
    mapping(uint => mapping(address => bool)) public isTradingMarketInARound;

    mapping(uint => uint) public profitAndLossPerRound;
    mapping(uint => uint) public cumulativeProfitAndLoss;

    /* ========== CONSTRUCTOR ========== */

    function __BaseVault_init(
        address _owner,
        IThalesAMM _thalesAmm,
        IERC20Upgradeable _sUSD,
        uint _roundLength
    ) internal onlyInitializing {
        setOwner(_owner);
        initNonReentrant();
        thalesAMM = IThalesAMM(_thalesAmm);
        sUSD = _sUSD;
        roundLength = _roundLength;
        sUSD.approve(address(thalesAMM), type(uint256).max);
    }

    /// @notice Start vault and begin round #1
    function startVault() external onlyOwner {
        require(!vaultStarted, "Vault has already started");
        round = 1;

        roundStartTime[round] = block.timestamp;
        roundEndTime[round] = roundStartTime[round] + roundLength;

        allocationPerRound[round] = sUSD.balanceOf(address(this));

        vaultStarted = true;

        emit VaultStarted();
    }

    /// @notice Close current round and begin next round,
    /// excercise options of trading markets and calculate profit and loss
    function closeRound() external nonReentrant whenNotPaused canCloseRound {
        // excercise market options
        for (uint i = 0; i < tradingMarketsPerRound[round].length; i++) {
            IPositionalMarket(tradingMarketsPerRound[round][i]).exerciseOptions();
        }

        // TODO: exclude sUSD that was sent directly to contract
        // balance in next round does not affect PnL in a current round
        uint currentVaultBalance = sUSD.balanceOf(address(this)) - allocationPerRound[round + 1];
        // calculate PnL

        // if no allocation for current round
        if (allocationPerRound[round] == 0) {
            profitAndLossPerRound[round] = 1;
        } else {
            profitAndLossPerRound[round] = (currentVaultBalance * 1e18) / allocationPerRound[round];
        }

        if (round == 1) {
            cumulativeProfitAndLoss[round] = profitAndLossPerRound[round];
        } else {
            cumulativeProfitAndLoss[round] = (cumulativeProfitAndLoss[round - 1] * profitAndLossPerRound[round]) / 1e18;
        }

        // calculate withdrawal amount share
        withdrawalQueueAmount[round] = (withdrawalQueueAmount[round] * profitAndLossPerRound[round]) / 1e18;

        // start next round
        round += 1;

        roundStartTime[round] = block.timestamp;
        roundEndTime[round] = roundStartTime[round] + roundLength;

        // allocation for next round doesn't include withdrawal queue share from previous round
        allocationPerRound[round] = sUSD.balanceOf(address(this)) - withdrawalQueueAmount[round - 1];

        emit RoundClosed(round - 1);
    }

    /// @notice Deposit funds from user into vault for the next round
    /// @param amount Value to be deposited
    function deposit(uint amount) external canDeposit(amount) {
        sUSD.safeTransferFrom(msg.sender, address(this), amount);

        // calculate previous shares
        if (vaultStarted) {
            _calculateBalanceInARound(msg.sender, round);
        }

        uint nextRound = round + 1;

        if (balancesPerRound[nextRound][msg.sender] == 0) {
            usersPerRound[nextRound].push(msg.sender);
        }

        balancesPerRound[nextRound][msg.sender] += amount;

        // update deposit state of a user
        depositReceipts[msg.sender] = DepositReceipt(nextRound, balancesPerRound[nextRound][msg.sender]);

        allocationPerRound[nextRound] += amount;

        emit Deposited(msg.sender, amount);
    }

    function withdrawalRequest() external {
        require(vaultStarted, "Vault has not started");
        require(!withdrawalQueue[msg.sender].requested, "Withdrawal already requested");

        _calculateBalanceInARound(msg.sender, round);

        withdrawalQueue[msg.sender] = WithdrawalRequest(round, balancesPerRound[round][msg.sender], true);

        withdrawalQueueAmount[round] += balancesPerRound[round][msg.sender];

        emit WithdrawalRequested(msg.sender);
    }

    /// @notice Transfer sUSD to user based on vault success and user deposits
    /// @dev During a round, user can claim amount only from previous rounds if withdrawal request is sent
    function claim() external nonReentrant whenNotPaused {
        WithdrawalRequest memory withdrawalRequest = withdrawalQueue[msg.sender];
        require(withdrawalRequest.requested, "Withdrawal request has not been sent");

        uint amount = (withdrawalRequest.amount * profitAndLossPerRound[withdrawalRequest.round]) / 1e18;
        require(amount > 0, "Nothing to claim");

        sUSD.safeTransfer(msg.sender, amount);
        claimedPerRound[withdrawalRequest.round][msg.sender] = true;
        withdrawalQueueAmount[withdrawalRequest.round] -= amount;

        // reset withdrawal request;
        withdrawalQueue[msg.sender].requested = false;
        withdrawalQueue[msg.sender].amount = 0;
        withdrawalQueue[msg.sender].round = 0;

        // reset deposit receipt;
        depositReceipts[msg.sender].round = 0;
        depositReceipts[msg.sender].amount = 0;

        emit Claimed(msg.sender, amount);
    }

    /// @notice Set length of rounds
    /// @param _roundLength Length of a round in miliseconds
    function setRoundLength(uint _roundLength) external onlyOwner {
        roundLength = _roundLength;
        emit RoundLengthChanged(_roundLength);
    }

    /// @notice Set ThalesAMM contract
    /// @param _thalesAMM ThalesAMM address
    function setThalesAMM(IThalesAMM _thalesAMM) external onlyOwner {
        thalesAMM = _thalesAMM;
        emit ThalesAMMChanged(address(_thalesAMM));
    }

    /// @notice Set sUSD token contract
    /// @param _sUSD sUSD token address
    function setSUSD(IERC20Upgradeable _sUSD) external onlyOwner {
        sUSD = _sUSD;
        emit SetSUSD(address(sUSD));
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /// @notice Calculate user balance in a round based on vaults' PnL
    /// @param user Address of the user
    /// @param _round Round number
    function _calculateBalanceInARound(address user, uint _round) internal {
        for (uint i = 1; i < _round; i++) {
            if (claimedPerRound[i][user]) continue;

            balancesPerRound[i][user] = (balancesPerRound[i][user] * profitAndLossPerRound[i]) / 1e18;
            balancesPerRound[i + 1][user] += balancesPerRound[i][user];
            claimedPerRound[i][user] = true;
        }
    }

    /// @notice Return multiplied PnLs between rounds
    /// @param roundA Round number from
    /// @param roundB Round number to
    /// @return uint
    function _cumulativePnLBetweenRounds(uint roundA, uint roundB) internal view returns (uint) {
        return (cumulativeProfitAndLoss[roundB] * profitAndLossPerRound[roundA]) / cumulativeProfitAndLoss[roundA];
    }

    /* ========== VIEWS ========== */

    /// @notice Return user balance in a round
    /// @param _round Round number
    /// @param user Address of the user
    /// @return uint
    function getBalancesPerRound(uint _round, address user) external view returns (uint) {
        return balancesPerRound[_round][user];
    }

    /// @notice Return if user has claimed in a round
    /// @param _round Round number
    /// @param user Address of the user
    /// @return bool
    function getClaimedPerRound(uint _round, address user) external view returns (bool) {
        return claimedPerRound[_round][user];
    }

    /// @notice Return user's available amount to claim
    /// @param user Address of the user
    /// @return amount Amount to be claimed
    function getAvailableToClaim(address user) external view returns (uint) {
        WithdrawalRequest memory withdrawalRequest = withdrawalQueue[user];
        DepositReceipt memory depositReceipt = depositReceipts[user];

        // if no round has been finished or user already claimed (no withdrawal request and no deposit)
        if (!vaultStarted || round == 1 || (!withdrawalRequest.requested && depositReceipt.round == 0)) {
            return 0;
        }

        //if user requested withrawal, share in previous rounds is already calculated
        if (withdrawalRequest.requested) {
            return
                withdrawalRequest.round == round
                    ? withdrawalRequest.amount
                    : (withdrawalRequest.amount * profitAndLossPerRound[withdrawalRequest.round]) / 1e18;
        }

        if (depositReceipt.round >= round) {
            // if user claimed and deposited in the same round
            if (claimedPerRound[round][user] == true) return 0;
            return balancesPerRound[round - 1][user];
        } else {
            uint initialBalance =
                (balancesPerRound[depositReceipt.round - 1][user] * profitAndLossPerRound[depositReceipt.round - 1]) /
                    1e18 +
                    balancesPerRound[depositReceipt.round][user];

            return (initialBalance * _cumulativePnLBetweenRounds(depositReceipt.round, round - 1)) / 1e18;
        }
    }

    /* ========== MODIFIERS ========== */

    modifier canDeposit(uint amount) {
        require(!withdrawalQueue[msg.sender].requested, "Withdrawal is requested, cannot deposit");
        require(amount > 0, "Invalid amount");
        require(sUSD.balanceOf(msg.sender) >= amount, "No enough sUSD");
        require(sUSD.allowance(msg.sender, address(this)) >= amount, "No allowance");
        _;
    }

    modifier canCloseRound() {
        require(vaultStarted, "Vault has not started");
        require(block.timestamp > (roundStartTime[round] + roundLength), "Can't close round yet");
        _;
    }

    /* ========== EVENTS ========== */

    event VaultStarted();
    event RoundClosed(uint round);
    event RoundLengthChanged(uint roundLength);
    event ThalesAMMChanged(address thalesAmm);
    event SetSUSD(address sUSD);
    event Deposited(address user, uint amount);
    event Claimed(address user, uint amount);
    event WithdrawalRequested(address user);
}

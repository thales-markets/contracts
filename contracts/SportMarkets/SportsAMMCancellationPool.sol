// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "../interfaces/ISportPositionalMarket.sol";
import "../interfaces/ISportPositionalMarketManagerMinimized.sol";
import "../interfaces/ISportsAMM.sol";

/// @title SportsAMM Cancellation Pool for cancelled positions
contract SportsAMMCancellationPool is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    uint private constant ONE = 1e18;
    ISportsAMM public sportsAMM;
    ISportPositionalMarketManagerMinimized public sportManager;
    bool public newCancellationActive;
    mapping(address => mapping(uint => uint)) public firstCancellationMultiplierForMarket;
    mapping(address => mapping(uint => uint)) public cancellationMultiplierForMarket;
    mapping(address => mapping(uint => uint)) public cancellationThresholdForMarket;
    mapping(address => uint) public totalCancellationPayoutPerMarket;
    uint public defaultCancelUpdateAmount;

    /* ========== CONSTRUCTOR ========== */
    function initialize(address _sportsAMM) public initializer {
        setOwner(msg.sender);
        initNonReentrant();
        sportsAMM = ISportsAMM(_sportsAMM);
        sportManager = ISportPositionalMarketManagerMinimized(address(sportsAMM.manager()));
        defaultCancelUpdateAmount = 1000 * ONE;
    }

    /* ========== EXTERNAL VIEW FUNCTIONS ========== */

    /// @notice Obtain the cancellation payout for amount of positions on given market
    /// @param _market the sport market
    /// @param _position the position (HOME/AWAY/DRAW)
    /// @param _positionAmount the position amount of options placed on the market position
    /// @return cancelPayout the cancellation payout given the position amount on the market
    function cancellationPayout(
        address _market,
        uint _position,
        uint _positionAmount
    ) external view returns (uint cancelPayout) {
        uint avgCancellationMultiplier;
        if (cancellationMultiplierForMarket[_market][_position] == 0) {
            avgCancellationMultiplier = firstCancellationMultiplierForMarket[_market][_position];
        } else {
            avgCancellationMultiplier =
                (cancellationMultiplierForMarket[_market][_position] +
                    firstCancellationMultiplierForMarket[_market][_position]) /
                2;
        }
        cancelPayout = (_positionAmount * avgCancellationMultiplier) / ONE;
    }

    /* ========== EXTERNAL FUNCTIONS - UPDATING STATE and ISSUE FUNDS ========== */

    /// @notice Update the cancellation multiplyer. The update is executed until the default threshold amount is reached.
    /// @param _market the sport market
    /// @param _position the position (HOME/AWAY/DRAW)
    /// @param _paidAmount the amount of sUSD/USDC is paid by the user
    /// @param _amount the amount of positions obtained by the user
    function updateCancellationMultiplier(
        address _market,
        uint8 _position,
        uint _paidAmount,
        uint _amount
    ) external nonReentrant whenNotPaused {
        if (newCancellationActive) {
            require(msg.sender == address(sportsAMM), "InvalidSender");
            uint calculatedMultiplyer = (_paidAmount * ONE) / _amount;
            if (firstCancellationMultiplierForMarket[_market][_position] == 0) {
                firstCancellationMultiplierForMarket[_market][_position] = calculatedMultiplyer;
                cancellationThresholdForMarket[_market][_position] = defaultCancelUpdateAmount;
            } else if (
                calculatedMultiplyer > cancellationMultiplierForMarket[_market][_position] &&
                cancellationThresholdForMarket[_market][_position] > 0
            ) {
                cancellationMultiplierForMarket[_market][_position] = calculatedMultiplyer;
                if (cancellationThresholdForMarket[_market][_position] > _amount) {
                    cancellationThresholdForMarket[_market][_position] -= _amount;
                } else {
                    cancellationThresholdForMarket[_market][_position] = 0;
                }
            }
        }
    }

    function sendFunds(
        address _account,
        uint _cancellationPayout,
        IERC20Upgradeable _sUSD
    ) external nonReentrant whenNotPaused {
        require(sportManager.isKnownMarket(msg.sender), "MarketUnknown");
        totalCancellationPayoutPerMarket[msg.sender] += _cancellationPayout;
        IERC20Upgradeable(_sUSD).safeTransfer(_account, _cancellationPayout);
    }

    function setCancellationActive(bool _enable) external onlyOwner {
        newCancellationActive = _enable;
    }

    function setDefaultCancelUpdateAmount(uint _defaultAmount) external onlyOwner {
        defaultCancelUpdateAmount = _defaultAmount;
        emit SetDefaultCancelUpdateAmount(_defaultAmount);
    }

    function retrieveSUSDAmount(address payable _account, uint _amount) external onlyOwner {
        sportManager.sUSD().safeTransfer(_account, _amount);
    }

    event SetDefaultCancelUpdateAmount(uint _defaultAmount);
}

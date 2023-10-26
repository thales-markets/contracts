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

import "hardhat/console.sol";

/// @title SportsAMM Cancellation Pool for cancelled positions
contract SportsAMMCancellationPool is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    uint private constant ONE = 1e18;
    ISportsAMM public sportsAMM;
    ISportPositionalMarketManagerMinimized public sportManager;
    mapping(address => mapping(uint => uint)) public cancellationMultiplierForMarket;
    mapping(address => mapping(address => uint)) public userDeposits;

    function initialize(address _sportsAMM) public initializer {
        setOwner(msg.sender);
        initNonReentrant();
        sportsAMM = ISportsAMM(_sportsAMM);
        sportManager = ISportPositionalMarketManagerMinimized(address(sportsAMM.manager()));
    }

    function updateCancellationMultiplier(
        address _market,
        uint8 _position,
        uint _paidAmount,
        uint _amount
    ) external nonReentrant whenNotPaused {
        require(msg.sender == address(sportsAMM), "InvalidSender");
        console.log(">>> paidAmount: ", _paidAmount);
        console.log(">>> amount: ", _amount);
        console.log(">>> position: ", _position);
        cancellationMultiplierForMarket[_market][_position] = (_paidAmount * ONE) / _amount;
        console.log(">>> cancellationMultiplierForMarket: ", ((_paidAmount * ONE) / _amount));
        console.log(">>> cancellationMultiplierForMarket: ", cancellationMultiplierForMarket[_market][_position]);
    }

    function addUserDepositPerMarket(
        address _user,
        address _market,
        uint _paidAmount
    ) external nonReentrant whenNotPaused {
        require(msg.sender == address(sportsAMM), "InvalidSender");
        userDeposits[_user][_market] = _paidAmount;
    }

    function cancellationPayout(
        address _market,
        uint _position,
        uint _payout
    ) external view returns (uint cancelPayout) {
        // require(sportManager.isKnownMarket(msg.sender), "MarketUnknown");
        // cancelPayout = userDeposits[_account][msg.sender];
        console.log(">> payout: ", _payout);
        console.log(">> position: ", _position);
        cancelPayout = (_payout * cancellationMultiplierForMarket[_market][_position]) / ONE;
        console.log(">> cancellation payout: ", cancelPayout);
        // IERC20Upgradeable(_sUSD).safeTransfer(_account, cancelPayout);
    }

    function sendFunds(
        address _account,
        uint _cancellationPayout,
        IERC20Upgradeable _sUSD
    ) external nonReentrant whenNotPaused {
        require(sportManager.isKnownMarket(msg.sender), "MarketUnknown");
        IERC20Upgradeable(_sUSD).safeTransfer(_account, _cancellationPayout);
    }

    function retrieveSUSDAmount(address payable _account, uint _amount) external onlyOwner {
        sportManager.sUSD().safeTransfer(_account, _amount);
    }
}

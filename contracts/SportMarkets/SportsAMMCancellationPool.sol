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

    ISportsAMM public sportsAMM;
    ISportPositionalMarketManagerMinimized public sportManager;

    function initialize(address _sportsAMM) public initializer {
        setOwner(msg.sender);
        initNonReentrant();
        sportsAMM = ISportsAMM(_sportsAMM);
        sportManager = ISportPositionalMarketManagerMinimized(address(sportsAMM.manager()));
    }

    function cancellationPayout(address _account, uint _cancellationPayout) external nonReentrant whenNotPaused {
        require(sportManager.isKnownMarket(msg.sender), "MarketUnknown");
        sportManager.sUSD().safeTransfer(_account, _cancellationPayout);
    }

    function retrieveSUSDAmount(address payable _account, uint _amount) external onlyOwner {
        sportManager.sUSD().safeTransfer(_account, _amount);
    }
}

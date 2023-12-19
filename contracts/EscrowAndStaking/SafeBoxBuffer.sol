// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "../interfaces/IAddressManager.sol";

/// @title - Cross Chain Collector contract for Thales staking rewards
contract SafeBoxBuffer is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IAddressManager public addressManager;
    IERC20Upgradeable public sUSD;

    /* ========== INITIALIZERS ========== */
    function initialize(address _addressManager, address _sUSD) public initializer {
        setOwner(msg.sender);
        initNonReentrant();
        addressManager = IAddressManager(_addressManager);
        sUSD = IERC20Upgradeable(_sUSD);
    }

    /* ========== VIEW FUNCTIONS ========== */

    /* ========== EXTERNAL FUNCTIONS ========== */

    function pullExtraFunds(uint _amount) external nonReentrant notPaused {
        require(msg.sender == addressManager.stakingThales(), "InvCaller");
        sUSD.safeTransfer(msg.sender, _amount);
        emit FundsPulled(msg.sender, _amount);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /* ========== CONTRACT SETTERS FUNCTIONS ========== */

    function setAddressManager(address _addressManager) external onlyOwner {
        require(_addressManager != address(0), "Addr0");
        addressManager = IAddressManager(_addressManager);
        emit SetAddressManager(_addressManager);
    }

    function setSUSD(address _sUSD) external onlyOwner {
        require(_sUSD != address(0), "Addr0");
        sUSD = IERC20Upgradeable(_sUSD);
        emit SetSUSD(_sUSD);
    }

    /* ========== EVENTS ========== */

    event FundsPulled(address destination, uint amount);
    event SetAddressManager(address _stakingThales);
    event SetSUSD(address _sUSD);
    event SentOnClosePeriod(uint _totalStakedLastPeriodEnd, uint _totalEscrowedLastPeriodEnd, uint _bonusPoints);
}

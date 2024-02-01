// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "../interfaces/IAddressManager.sol";

/// @title - SafeBoxBuffer contract used for revenue share in CCIP Staking scenario
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

    /// @notice Function dedicated for Staking contract to pull extra needed funds for revenue share in a given staking period
    /// @param _amount the extra amount required for revenue share in a period
    function pullExtraFunds(uint _amount) external nonReentrant notPaused {
        require(msg.sender == addressManager.getAddress("StakingThales") || msg.sender == owner, "InvCaller");
        sUSD.safeTransfer(msg.sender, _amount);
        emit FundsPulled(msg.sender, _amount);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /* ========== CONTRACT SETTERS FUNCTIONS ========== */

    /// @notice Set Address manager contract
    /// @param _addressManager the address of the address manager contract
    function setAddressManager(address _addressManager) external onlyOwner {
        require(_addressManager != address(0), "Addr0");
        addressManager = IAddressManager(_addressManager);
        emit SetAddressManager(_addressManager);
    }

    /// @notice Set USD contract used for revenue share
    /// @param _sUSD the address of the USD contract
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

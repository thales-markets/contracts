// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

import "../interfaces/IStakingThales.sol";

/// @title - Cross Chain Collector contract for Thales staking rewards
contract SafeBoxBuffer is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    address public stakingThales;
    IERC20Upgradeable public sUSD;

    /* ========== INITIALIZERS ========== */
    function initialize(address _stakingThales, address _sUSD) public initializer {
        setOwner(msg.sender);
        initNonReentrant();
        stakingThales = _stakingThales;
        sUSD = IERC20Upgradeable(_sUSD);
    }

    /* ========== VIEW FUNCTIONS ========== */

    /* ========== EXTERNAL FUNCTIONS ========== */

    function pullExtraFunds(uint _amount) external nonReentrant notPaused {
        require(msg.sender == stakingThales, "InvCaller");
        sUSD.safeTransfer(msg.sender, _amount);
        emit FundsPulled(msg.sender, _amount);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /* ========== CONTRACT SETTERS FUNCTIONS ========== */

    function setStakingThales(address _stakingThales) external onlyOwner {
        require(_stakingThales != address(0), "Addr0");
        stakingThales = _stakingThales;
        emit SetStakingThales(_stakingThales);
    }

    /* ========== EVENTS ========== */

    event FundsPulled(address destination, uint amount);
    event SetStakingThales(address _stakingThales);
    event SentOnClosePeriod(uint _totalStakedLastPeriodEnd, uint _totalEscrowedLastPeriodEnd, uint _bonusPoints);
}

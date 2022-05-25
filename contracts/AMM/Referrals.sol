// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-4.4.1/proxy/Clones.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "../utils/libraries/AddressSetLib.sol";

contract Referrals is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    mapping(address => bool) public whitelistedAddresses;
    mapping(address => address) public referrals;

    function initialize(
        address _owner,
        address thalesAmm,
        address rangedAMM
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        whitelistedAddresses[thalesAmm] = true;
        whitelistedAddresses[rangedAMM] = true;
    }

    function setReferrer(address referrer, address referred) external {
        require(
            whitelistedAddresses[msg.sender] || owner == msg.sender,
            "Only whitelisted addresses or owner set referrers"
        );
        if (referrals[referred] != referrer) {
            require(referrals[referred] != address(0), "Referred address already has a referrer");
            referrals[referred] = referrer;
        }
    }

    function setWhitelistedAddress(address _address, bool enabled) external onlyOwner {
        whitelistedAddresses[_address] = enabled;
    }
}

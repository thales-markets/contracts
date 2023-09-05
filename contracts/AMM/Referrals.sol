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
    mapping(address => uint) public referralStarted;

    mapping(address => bool) public tradedBefore;

    mapping(address => address) public sportReferrals;
    mapping(address => uint) public sportReferralStarted;
    mapping(address => bool) public sportTradedBefore;
    address public sportsAMM;
    address public parlayAMM;

    uint public referrerFeeDefault;
    uint public referrerFeeSilver;
    uint public referrerFeeGold;

    mapping(address => bool) public silverAddresses;
    mapping(address => bool) public goldAddresses;

    function initialize(
        address _owner,
        address thalesAmm,
        address rangedAMM,
        address speedMarketsAmm
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        whitelistedAddresses[thalesAmm] = true;
        whitelistedAddresses[rangedAMM] = true;
        whitelistedAddresses[speedMarketsAmm] = true;
    }

    function getReferrerFee(address referrer) public view returns (uint referrerFee) {
        referrerFee = referrerFeeDefault;

        if (silverAddresses[referrer]) {
            referrerFee = referrerFeeSilver;
        }
        if (goldAddresses[referrer]) {
            referrerFee = referrerFeeGold;
        }
    }

    function setReferrer(address referrer, address referred) external {
        require(referrer != address(0) && referred != address(0), "Cant refer zero addresses");
        require(referrer != referred, "Cant refer to yourself");
        require(
            whitelistedAddresses[msg.sender] || owner == msg.sender,
            "Only whitelisted addresses or owner set referrers"
        );
        if (msg.sender == sportsAMM || msg.sender == parlayAMM) {
            sportReferrals[referred] = referrer;
            sportReferralStarted[referred] = block.timestamp;
            emit SportReferralAdded(referrer, referred, block.timestamp);
        } else {
            referrals[referred] = referrer;
            referralStarted[referred] = block.timestamp;
            emit ReferralAdded(referrer, referred, block.timestamp);
        }
    }

    /// @notice set Referral fees
    /// @param _referrerFeeDefault how much of a fee to pay to referrers
    /// @param _referrerFeeSilver how much of a fee to pay to silver referrers
    /// @param _referrerFeeGold how much of a fee to pay to gold referrers
    function setReferrerFees(
        uint _referrerFeeDefault,
        uint _referrerFeeSilver,
        uint _referrerFeeGold
    ) external onlyOwner {
        referrerFeeDefault = _referrerFeeDefault;
        referrerFeeSilver = _referrerFeeSilver;
        referrerFeeGold = _referrerFeeGold;
    }

    /// @notice adding/removing silver address depending on a flag
    /// @param _silverAddress address that needed to be added as silver or removed from silver addresses
    /// @param _flag adding or removing from silver addresses (true: add, false: remove)
    function setSilverAddress(address _silverAddress, bool _flag) external onlyOwner {
        require(_silverAddress != address(0) && silverAddresses[_silverAddress] != _flag);
        silverAddresses[_silverAddress] = _flag;
        emit SetSilverAddress(_silverAddress, _flag);
    }

    /// @notice adding/removing gold address depending on a flag
    /// @param _goldAddress address that needed to be added as gold or removed from gold addresses
    /// @param _flag adding or removing from gold addresses (true: add, false: remove)
    function setGoldAddress(address _goldAddress, bool _flag) external onlyOwner {
        require(_goldAddress != address(0) && goldAddresses[_goldAddress] != _flag);
        goldAddresses[_goldAddress] = _flag;
        emit SetGoldAddress(_goldAddress, _flag);
    }

    function setWhitelistedAddress(address _address, bool enabled) external onlyOwner {
        require(whitelistedAddresses[_address] != enabled, "Address already enabled/disabled");
        whitelistedAddresses[_address] = enabled;
        emit SetWhitelistedAddress(_address, enabled);
    }

    function setTradedBefore(address[] calldata _addresses) external onlyOwner {
        for (uint256 index = 0; index < _addresses.length; index++) {
            tradedBefore[_addresses[index]] = true;
            emit TradedBefore(_addresses[index]);
        }
    }

    function setSportTradedBefore(address[] calldata _addresses) external onlyOwner {
        for (uint256 index = 0; index < _addresses.length; index++) {
            sportTradedBefore[_addresses[index]] = true;
            emit SportTradedBefore(_addresses[index]);
        }
    }

    function setSportsAMM(address _sportsAMM, address _parlayAMM) external onlyOwner {
        if (!whitelistedAddresses[_sportsAMM]) {
            whitelistedAddresses[sportsAMM] = false;
            whitelistedAddresses[_sportsAMM] = true;
            sportsAMM = _sportsAMM;
            emit SetWhitelistedAddress(_sportsAMM, true);
        }
        if (!whitelistedAddresses[_parlayAMM]) {
            whitelistedAddresses[parlayAMM] = false;
            whitelistedAddresses[_parlayAMM] = true;
            parlayAMM = _parlayAMM;
            emit SetWhitelistedAddress(_parlayAMM, true);
        }
    }

    event SportReferralAdded(address referrer, address referred, uint timeStarted);
    event ReferralAdded(address referrer, address referred, uint timeStarted);
    event SetSilverAddress(address silverAddress, bool flag);
    event SetGoldAddress(address goldAddress, bool flag);
    event TradedBefore(address trader);
    event SportTradedBefore(address trader);
    event SetWhitelistedAddress(address whitelisted, bool enabled);
}

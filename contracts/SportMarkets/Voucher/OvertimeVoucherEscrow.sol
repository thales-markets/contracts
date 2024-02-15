// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

// internal
import "../../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";

import "./OvertimeVoucher.sol";

contract OvertimeVoucherEscrow is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    /* ========== LIBRARIES ========== */
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /* ========== STATE VARIABLES ========== */

    /// @return The sUSD contract used for payment
    IERC20Upgradeable public sUSD;

    /// @return OvertimeVoucher used for minting tokens
    OvertimeVoucher public overtimeVoucher;

    /// @return Address whitelisted for claiming voucher in claiming period
    mapping(uint => mapping(address => bool)) public whitelistedAddressesPerPeriod;

    /// @return Address already claimed voucher in claiming period
    mapping(uint => mapping(address => bool)) public addressClaimedVoucherPerPeriod;

    /// @return Amount of sUSD in voucher to be minted/claimed
    uint public voucherAmount;

    /// @return Timestamp until claiming period is open
    mapping(uint => uint) public periodEnd;

    /// @return Current claiming period number
    uint public period;

    /* ========== CONSTRUCTOR ========== */
    function initialize(
        address _owner,
        IERC20Upgradeable _sUSD,
        address _overtimeVoucher,
        address[] calldata _whitelistedAddresses,
        uint _voucherAmount,
        uint _periodEnd
    ) external initializer {
        setOwner(_owner);
        initNonReentrant();
        sUSD = _sUSD;
        overtimeVoucher = OvertimeVoucher(_overtimeVoucher);
        voucherAmount = _voucherAmount;

        period = 1;
        periodEnd[1] = _periodEnd;

        setWhitelistedAddresses(_whitelistedAddresses, true);

        sUSD.approve(_overtimeVoucher, type(uint256).max);
    }

    /// @notice Mints OvertimeVoucher and sends it to the user if given address
    /// is whitelisted and claiming period is not closed yet
    function claimVoucher() external canClaim {
        overtimeVoucher.mint(msg.sender, voucherAmount);
        addressClaimedVoucherPerPeriod[period][msg.sender] = true;

        emit VoucherClaimed(msg.sender, voucherAmount);
    }

    /* ========== SETTERS ========== */

    /// @notice sets address of sUSD contract
    /// @param _address sUSD address
    function setsUSD(address _address) external onlyOwner {
        sUSD = IERC20Upgradeable(_address);
        emit SetsUSD(_address);
    }

    /// @notice sets address of OvertimeVoucher contract
    /// @param _address OvertimeVoucher address
    function setOvertimeVoucher(address _address) external onlyOwner {
        overtimeVoucher = OvertimeVoucher(_address);
        emit SetOvertimeVoucher(_address);
    }

    /// @notice setWhitelistedAddresses enables whitelist addresses of given array
    /// @param _whitelistedAddresses array of whitelisted addresses
    /// @param _flag adding or removing from whitelist (true: add, false: remove)
    function setWhitelistedAddresses(address[] calldata _whitelistedAddresses, bool _flag) public onlyOwner {
        require(_whitelistedAddresses.length > 0, "Whitelisted addresses cannot be empty");
        for (uint i = 0; i < _whitelistedAddresses.length; i++) {
            if (whitelistedAddressesPerPeriod[period][_whitelistedAddresses[i]] != _flag) {
                whitelistedAddressesPerPeriod[period][_whitelistedAddresses[i]] = _flag;
                emit WhitelistChanged(_whitelistedAddresses[i], period, _flag);
            }
        }
    }

    /// @notice sets amount in voucher to be claimed/minted
    /// @param _voucherAmount sUSD amount
    function setVoucherAmount(uint _voucherAmount) external onlyOwner {
        voucherAmount = _voucherAmount;
        emit VoucherAmountChanged(_voucherAmount);
    }

    /// @notice sets timestamp until claiming is open
    /// @param _periodEnd new timestamp
    /// @param _startNextPeriod extend current period if false, start next period if true
    function setPeriodEndTimestamp(uint _periodEnd, bool _startNextPeriod) external onlyOwner {
        require(_periodEnd > periodEnd[period], "Invalid timestamp");
        if (_startNextPeriod) {
            period += 1;
        }

        periodEnd[period] = _periodEnd;

        emit PeriodEndTimestampChanged(_periodEnd);
    }

    /* ========== VIEWS ========== */

    /// @notice checks if address is whitelisted
    /// @param _address address to be checked
    /// @return bool
    function isWhitelistedAddress(address _address) public view returns (bool) {
        return whitelistedAddressesPerPeriod[period][_address];
    }

    /// @notice checks if current claiming period is closed
    /// @return bool
    function claimingPeriodEnded() public view returns (bool) {
        return block.timestamp >= periodEnd[period];
    }

    /// @notice retrieveSUSDAmount retrieves sUSD from this contract
    /// @param amount how much to retrieve
    function retrieveSUSDAmount(uint amount) external onlyOwner {
        sUSD.transfer(msg.sender, amount);
    }

    /* ========== MODIFIERS ========== */

    modifier canClaim() {
        require(!claimingPeriodEnded(), "Claiming period ended");
        require(isWhitelistedAddress(msg.sender), "Invalid address");
        require(!addressClaimedVoucherPerPeriod[period][msg.sender], "Address has already claimed voucher");

        require(sUSD.balanceOf(address(this)) >= voucherAmount, "Not enough sUSD in the contract");
        _;
    }

    /* ========== EVENTS ========== */

    event WhitelistChanged(address _address, uint period, bool _flag);
    event SetsUSD(address _address);
    event SetOvertimeVoucher(address _address);
    event VoucherAmountChanged(uint _amount);
    event PeriodEndTimestampChanged(uint _timestamp);
    event VoucherClaimed(address _address, uint _amount);
}

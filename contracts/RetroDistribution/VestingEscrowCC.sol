// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

contract VestingEscrowCC is Initializable, ProxyReentrancyGuard, ProxyOwned, ProxyPausable {
    using SafeMathUpgradeable for uint;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct LockedEntry {
        uint timestamp;
        uint amount;
    }

    address public token;
    mapping(address => uint) public startTime;
    mapping(address => uint) public endTime;
    mapping(address => uint) public initialLocked;
    mapping(address => uint) public totalClaimed;
    mapping(address => bool) public disabled;
    mapping(address => uint) public pausedAt;

    uint public initialLockedSupply;
    uint public vestingPeriod;
    address[] public recipients;

    function initialize(
        address _owner,
        address _token,
        uint _vestingPeriod
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        token = _token;
        vestingPeriod = _vestingPeriod;
    }

    function fund(
        address _recipient,
        uint _amount,
        uint _startTime
    ) external onlyOwner {
        require(_recipient != address(0), "Invalid address");

        if (initialLocked[_recipient] == 0) {
            recipients.push(_recipient);
            startTime[_recipient] = _startTime;
            endTime[_recipient] = _startTime + vestingPeriod;
        }
        initialLocked[_recipient] = initialLocked[_recipient] + _amount;

        initialLockedSupply = initialLockedSupply + _amount;

        emit Fund(_recipient, _amount);
    }

    function increaseAllocation(address _recipient, uint _amount) external onlyOwner {
        require(initialLocked[_recipient] > 0, "Invalid recipient");
        initialLocked[_recipient] = initialLocked[_recipient] + _amount;

        initialLockedSupply = initialLockedSupply + _amount;

        emit AllocationIncreased(_recipient, _amount);
    }

    function decreaseAllocation(address _recipient, uint _amount) external onlyOwner {
        require(initialLocked[_recipient] > 0, "Invalid recipient");
        require(initialLocked[_recipient] - balanceOf(_recipient) > _amount, "Invalid amount");
        initialLocked[_recipient] = initialLocked[_recipient] - _amount;

        initialLockedSupply = initialLockedSupply - _amount;

        emit AllocationDecreased(_recipient, _amount);
    }

    function _totalVestedOf(address _recipient, uint _time) internal view returns (uint) {
        uint start = startTime[_recipient];
        uint end = endTime[_recipient];
        uint locked = initialLocked[_recipient];

        if (_time < start) return 0;
        return MathUpgradeable.min(locked * (_time - start) / (end - start), locked);
    }

    function _totalVested() internal view returns (uint totalVested) {
        for (uint i = 0; i < recipients.length; i++) {
            totalVested += _totalVestedOf(recipients[i], block.timestamp);
        }
    }

    function vestedSupply() public view returns (uint) {
        return _totalVested();
    }

    function vestedOf(address _recipient) public view returns (uint) {
        return _totalVestedOf(_recipient, block.timestamp);
    }

    function lockedSupply() public view returns (uint) {
        return initialLockedSupply.sub(_totalVested());
    }

    function balanceOf(address _recipient) public view returns (uint) {
        return _totalVestedOf(_recipient, block.timestamp) - totalClaimed[_recipient];
    }

    function lockedOf(address _recipient) public view returns (uint) {
        return initialLocked[_recipient] - _totalVestedOf(_recipient, block.timestamp);
    }

    function claim() external nonReentrant notPaused {
        require(disabled[msg.sender] == false, "Account disabled");

        uint timestamp = pausedAt[msg.sender];
        if (timestamp == 0) {
            timestamp = block.timestamp;
        }
        uint claimable = _totalVestedOf(msg.sender, timestamp) - totalClaimed[msg.sender];
        require(claimable > 0, "Nothing to claim");

        IERC20Upgradeable(token).safeTransfer(msg.sender, claimable);

        totalClaimed[msg.sender] = totalClaimed[msg.sender] + claimable;
        emit Claim(msg.sender, claimable);
    }

    function pauseClaim(address _recipient) external onlyOwner {
        pausedAt[_recipient] = block.timestamp;
        emit ClaimPaused(_recipient);
    }

    function unpauseClaim(address _recipient) external onlyOwner {
        pausedAt[_recipient] = 0;
        emit ClaimUnpaused(_recipient);
    }

    function disableClaim(address _recipient) external onlyOwner {
        disabled[_recipient] = true;
        emit ClaimDisabled(_recipient);
    }

    function enableClaim(address _recipient) external onlyOwner {
        disabled[_recipient] = false;
        emit ClaimEnabled(_recipient);
    }

    function changeWallet(address _oldAddress, address _newAddress) external onlyOwner {
        require(initialLocked[_oldAddress] > 0, "Invalid recipient");
        require(initialLocked[_newAddress] == 0, "Address is already a recipient");

        startTime[_newAddress] = startTime[_oldAddress];
        startTime[_oldAddress] = 0;

        endTime[_newAddress] = endTime[_oldAddress];
        endTime[_oldAddress] = 0;

        initialLocked[_newAddress] = initialLocked[_oldAddress];
        initialLocked[_oldAddress] = 0;

        totalClaimed[_newAddress] = totalClaimed[_oldAddress];
        totalClaimed[_oldAddress] = 0;

        emit WalletChanged(_oldAddress, _newAddress);
    }

    function setStartTime(address _recipient, uint _startTime) external onlyOwner {
        require(_startTime < endTime[_recipient], "End time must be greater than start time");
        startTime[_recipient] = _startTime;
        emit StartTimeChanged(_recipient, _startTime);
    }

    function setEndTime(address _recipient, uint _endTime) external onlyOwner {
        require(_endTime >= block.timestamp, "End time must be in future");
        endTime[_recipient] = _endTime;
        emit EndTimeChanged(_recipient, _endTime);
    }

    function setToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid address");
        token = _token;
        emit TokenChanged(_token);
    }

    function setVestingPeriod(uint _vestingPeriod) external onlyOwner {
       vestingPeriod = _vestingPeriod;
       emit VestingPeriodChanged(_vestingPeriod);
    }

    event Fund(address _recipient, uint _amount);
    event AllocationIncreased(address _recipient, uint _amount);
    event AllocationDecreased(address _recipient, uint _amount);
    event Claim(address _address, uint _amount);
    event StartTimeChanged(address _recipient, uint _startTime);
    event EndTimeChanged(address _recipient, uint _endTime);
    event TokenChanged(address _token);
    event ClaimDisabled(address _recipient);
    event ClaimEnabled(address _recipient);
    event ClaimPaused(address _recipient);
    event ClaimUnpaused(address _recipient);
    event WalletChanged(address _oldAddress, address _newAddress);
    event VestingPeriodChanged(uint _vestingPeriod);
}

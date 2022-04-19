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

contract VestingEscrowProxy is Initializable, ProxyReentrancyGuard, ProxyOwned, ProxyPausable {
    using SafeMathUpgradeable for uint;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    address public token;
    mapping(address => uint) public startTime;
    mapping(address => uint) public endTime;
    mapping(address => uint) public initialLocked;
    mapping(address => uint) public totalClaimed;
    mapping(address => uint) public disabledAt;

    uint public initialLockedSupply;
    uint public vestingPeriod;
    address[] public recipients;

    function initialize(address _owner, address _token, uint _vestingPeriod) public initializer {
        setOwner(_owner);
        initNonReentrant();
        token = _token;
        vestingPeriod = _vestingPeriod;
    }

    function fund(
        address[] memory _recipients,
        uint[] memory _amounts,
        uint[] memory _startTimes
    ) external onlyOwner {
        uint _totalAmount = 0;
        for (uint index = 0; index < _recipients.length; index++) {
            require(_startTimes[index] >= block.timestamp, "Start time must be in future");
            uint amount = _amounts[index];
            address recipient = _recipients[index];
            if (recipient == address(0)) {
                break;
            }
            _totalAmount = _totalAmount + amount;
            if(initialLocked[recipient] == 0) {
                recipients.push(recipient);
                startTime[recipient] = _startTimes[index];
                endTime[recipient] = _startTimes[index] + vestingPeriod;
            }
            initialLocked[recipient] = initialLocked[recipient] + amount;

            emit Fund(recipient, amount);
        }

        initialLockedSupply = initialLockedSupply + _totalAmount;
    }

    function _totalVestedOf(address _recipient, uint _time) internal view returns (uint) {
        uint start = startTime[_recipient];
        uint end = endTime[_recipient];
        uint locked = initialLocked[_recipient];

        if (_time < start) return 0;
        return MathUpgradeable.min(locked.mul(_time.sub(start)).div(end.sub(start)), locked);
    }

    function _totalVested() internal view returns (uint totalVested) {
        for(uint i = 0; i < recipients.length; i++) {
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
        return _totalVestedOf(_recipient, block.timestamp).sub(totalClaimed[_recipient]);
    }

    function lockedOf(address _recipient) public view returns (uint) {
        return initialLocked[_recipient].sub(_totalVestedOf(_recipient, block.timestamp));
    }

    function claim() external nonReentrant notPaused {
        uint timestamp = disabledAt[msg.sender];
        if(timestamp == 0) {
            timestamp = block.timestamp;
        }
        uint claimable = _totalVestedOf(msg.sender, timestamp) - totalClaimed[msg.sender];
        require(claimable > 0, "nothing to claim");
        
        IERC20Upgradeable(token).safeTransfer(msg.sender, claimable);

        totalClaimed[msg.sender] = totalClaimed[msg.sender] + claimable;
        emit Claim(msg.sender, claimable);
    }

    function disableClaim(address _recipient) external onlyOwner {
        disabledAt[_recipient] = block.timestamp;
        emit DisableClaim(_recipient);
    }

    function enableClaim(address _recipient) external onlyOwner {
        disabledAt[_recipient] = 0;
        emit EnableClaim(_recipient);
    }

    function setStartTime(address _recipient, uint _startTime) external onlyOwner {
        startTime[_recipient] = _startTime;
        emit StartTimeChanged(_recipient, _startTime);
    }

    function setEndTime(address _recipient, uint _endTime) external onlyOwner {
        endTime[_recipient] = _endTime;
        emit EndTimeChanged(_recipient, _endTime);
    }

    function setToken(address _token) external onlyOwner {
        token = _token;
        emit TokenChanged(_token);
    }

    event Fund(address _recipient, uint _amount);
    event Claim(address _address, uint _amount);
    event StartTimeChanged(address _recipient, uint _startTime);
    event EndTimeChanged(address _recipient, uint _endTime);
    event TokenChanged(address _token);
    event DisableClaim(address _recipient);
    event EnableClaim(address _recipient);
}

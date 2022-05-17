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
    uint256 public startTime;
    uint256 public endTime;
    mapping(address => uint256) public initialLocked;
    mapping(address => uint256) public totalClaimed;

    uint256 public initialLockedSupply;

    function initialize(
        address _owner,
        address _token,
        uint256 _startTime,
        uint256 _endTime
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        require(_startTime >= block.timestamp, "Start time must be in future");
        require(_endTime > _startTime, "End time must be greater than start time");
        token = _token;
        startTime = _startTime;
        endTime = _endTime;
    }

    function fund(address[] calldata _recipients, uint256[] calldata _amounts) external onlyOwner {
        uint256 _totalAmount = 0;
        for (uint256 index = 0; index < _recipients.length; index++) {
            uint256 amount = _amounts[index];
            address recipient = _recipients[index];
            if (recipient == address(0)) {
                break;
            }
            _totalAmount = _totalAmount.add(amount);
            initialLocked[recipient] = initialLocked[recipient].add(amount);
            emit Fund(recipient, amount);
        }

        initialLockedSupply = initialLockedSupply.add(_totalAmount);
    }

    function _totalVestedOf(address _recipient, uint256 _time) internal view returns (uint256) {
        uint256 start = startTime;
        uint256 end = endTime;
        uint256 locked = initialLocked[_recipient];

        if (_time < start) return 0;
        return MathUpgradeable.min(locked.mul(_time.sub(start)).div(end.sub(start)), locked);
    }

    function _totalVested() internal view returns (uint256) {
        uint256 start = startTime;
        uint256 end = endTime;
        uint256 locked = initialLockedSupply;

        if (block.timestamp < start) {
            return 0;
        }

        return MathUpgradeable.min(locked.mul(block.timestamp.sub(start)).div(end.sub(start)), locked);
    }

    function vestedSupply() public view returns (uint256) {
        return _totalVested();
    }

    function vestedOf(address _recipient) public view returns (uint256) {
        return _totalVestedOf(_recipient, block.timestamp);
    }

    function lockedSupply() public view returns (uint256) {
        return initialLockedSupply.sub(_totalVested());
    }

    function balanceOf(address _recipient) public view returns (uint256) {
        return _totalVestedOf(_recipient, block.timestamp).sub(totalClaimed[_recipient]);
    }

    function lockedOf(address _recipient) public view returns (uint256) {
        return initialLocked[_recipient].sub(_totalVestedOf(_recipient, block.timestamp));
    }

    function claim() external nonReentrant notPaused {
        uint256 claimable = balanceOf(msg.sender);
        require(claimable > 0, "nothing to claim");
        totalClaimed[msg.sender] = totalClaimed[msg.sender].add(claimable);
        IERC20Upgradeable(token).safeTransfer(msg.sender, claimable);
        emit Claim(msg.sender, claimable);
    }

    function setStartTime(uint256 _startTime) external onlyOwner {
        startTime = _startTime;
    }

    function setEndTime(uint256 _endTime) external onlyOwner {
        endTime = _endTime;
    }

    function setToken(address _token) external onlyOwner {
        token = _token;
    }

    event Fund(address indexed _recipient, uint256 _amount);
    event Claim(address indexed _address, uint256 _amount);
}
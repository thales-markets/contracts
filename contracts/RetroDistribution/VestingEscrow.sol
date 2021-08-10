pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity-2.3.0/contracts/math/Math.sol";
import "openzeppelin-solidity-2.3.0/contracts/math/SafeMath.sol";

import "synthetix-2.43.1/contracts/SafeDecimalMath.sol";
import "openzeppelin-solidity-2.3.0/contracts/utils/ReentrancyGuard.sol";

contract VestingEscrow is ReentrancyGuard {
    using Math for uint256;
    using SafeMath for uint256;

    address public token;
    uint256 public startTime;
    uint256 public endTime;
    mapping(address => uint256) public initialLocked;
    mapping(address => uint256) public totalClaimed;

    uint256 public initialLockedSupply;
    uint256 public unallocatedSupply;

    bool public canDisable;
    mapping(address => uint256) public disabledAt;

    address public admin;
    address public futureAdmin;

    bool public fundAdminsEnabled;
    mapping(address => bool) public fundAdmins;

    constructor(
        address _token,
        uint256 _startTime,
        uint256 _endTime,
        bool _canDisable,
        address[4] memory _fundAdmins
    ) public {
        require(_startTime >= block.timestamp, "Start time must be in future");
        require(_endTime > _startTime, "End time must be greater than start time");

        token = _token;
        admin = msg.sender;
        startTime = _startTime;
        endTime = _endTime;
        canDisable = _canDisable;

        bool _fundAdminsEnabled = false;
        for (uint256 index = 0; index < _fundAdmins.length; index++) {
            address adminAddress = _fundAdmins[index];
            if (adminAddress != address(0)) {
                fundAdmins[adminAddress] = true;
                if (!_fundAdminsEnabled) {
                    _fundAdminsEnabled = true;
                    fundAdminsEnabled = true;
                }
            }
        }
    }

    function addTokens(uint256 _amount) external onlyAdmin {
        require(ERC20(token).transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        unallocatedSupply = unallocatedSupply.add(_amount);
    }

    function fund(address[100] calldata _recipients, uint256[100] calldata _amounts) external {
        if (msg.sender != admin) {
            require(fundAdmins[msg.sender], "Admin only");
            require(fundAdminsEnabled, "Fund admins disabled");
        }

        uint256 _totalAmount = 0;
        for (uint256 index = 0; index < 100; index++) {
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
        unallocatedSupply -= _totalAmount;
    }

    function toggleDisable(address _recipient) public onlyAdmin {
        require(canDisable, "Cannot disable");

        bool isDisabled = disabledAt[_recipient] == 0;
        if (isDisabled) {
            disabledAt[_recipient] = block.timestamp;
        } else {
            disabledAt[_recipient] = 0;
        }

        emit ToggleDisable(_recipient, isDisabled);
    }

    function disableCanDisable() external onlyAdmin {
        canDisable = false;
    }

    function disableFundAdmins() external onlyAdmin {
        fundAdminsEnabled = false;
    }

    function _totalVestedOf(address _recipient, uint256 _time) internal view returns (uint256) {
        uint256 start = startTime;
        uint256 end = endTime;
        uint256 locked = initialLocked[_recipient];

        if (_time < start) return 0;
        return Math.min(locked.mul(_time.sub(start)).div(end.sub(start)), locked);
    }

    function _totalVested() internal view returns (uint256) {
        uint256 start = startTime;
        uint256 end = endTime;
        uint256 locked = initialLockedSupply;

        if (block.timestamp < start) {
            return 0;
        }

        return Math.min(locked.mul(block.timestamp.sub(start)).div(end.sub(start)), locked);
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

    function claim(address _address) external nonReentrant {
        uint256 t = disabledAt[_address];
        if (t == 0) {
            t = block.timestamp;
        }

        uint256 claimable = _totalVestedOf(_address, t).sub(totalClaimed[_address]);
        totalClaimed[_address] = totalClaimed[_address].add(claimable);
        require(ERC20(token).transfer(_address, claimable));

        emit Claim(_address, claimable);
    }

    function commitTransferOwnership(address _address) external onlyAdmin returns (bool) {
        futureAdmin = _address;

        emit CommitOwnership(_address);
        return true;
    }

    function applyTransferOwnership() external onlyAdmin returns (bool) {
        address _admin = futureAdmin;
        require(_admin != address(0), "Admin not set");

        admin = _admin;
        emit ApplyOwnership(_admin);
        return true;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Admin only");
        _;
    }

    event Fund(address indexed _recipient, uint256 _amount);
    event ToggleDisable(address indexed _recipient, bool _isDisabled);
    event Claim(address indexed _address, uint256 _amount);
    event CommitOwnership(address indexed _address);
    event ApplyOwnership(address indexed _address);
}

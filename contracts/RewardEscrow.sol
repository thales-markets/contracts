pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/ERC20.sol";
import "synthetix-2.43.1/contracts/SafeDecimalMath.sol";

contract RewardEscrow {

    using SafeMath for uint;
    using SafeDecimalMath for uint;

    address public token;

    address public admin;
    address public futureAdmin;

    bool public fundAdminsEnabled;
    mapping(address => bool) public fundAdmins;
    
    mapping(address => uint[2][]) public vestingSchedules;
    mapping(address => uint) public totalEscrowedAccountBalance;

    uint public totalEscrowedBalance;

    mapping(address => uint) public totalVestedAccountBalance;

    uint public constant MAX_VESTING_ENTRIES = 52;

    uint internal constant TIME_INDEX = 0;
    uint internal constant AMOUNT_INDEX = 1;

    constructor(
        address _token,
        address[4] memory _fundAdmins
    ) public {

        token = _token;
        admin = msg.sender;

        bool _fundAdminsEnabled = false;
        for (uint index = 0; index < _fundAdmins.length; index++) {
            address adminAddress = _fundAdmins[index];
            if(adminAddress != address(0)) {
                fundAdmins[adminAddress] = true;
                if(!_fundAdminsEnabled) {
                    _fundAdminsEnabled = true;
                    fundAdminsEnabled = true;
                }
            }
            
        }
    }

    function addTokens(uint _amount) external onlyAdmin {
        require(ERC20(token).transferFrom(msg.sender, address(this), _amount), "Transfer failed");
    }

    function fund(address[100] calldata _recipients, uint[100] calldata _amounts) external {
        if(msg.sender != admin) {
            require(fundAdmins[msg.sender], "Admin only");
            require(fundAdminsEnabled, "Fund admins disabled");
        }

        uint _totalAmount = 0;
        for (uint index = 0; index < 100; index++) {
            uint amount = _amounts[index];
            address recipient = _recipients[index];
            if(recipient == address(0)) {
                break;
            }
            uint scheduleLength = vestingSchedules[recipient].length;
            require(scheduleLength <= MAX_VESTING_ENTRIES, "Vesting schedule is too long");

            /* Escrow the tokens for 4 weeks. */
            uint time = now + 4 weeks;

            if (scheduleLength == 0) {
                totalEscrowedAccountBalance[recipient] = amount;
            } else {
                /* Disallow adding new vested THALES earlier than the last one.
                * Since entries are only appended, this means that no vesting date can be repeated. */
                require(
                    getVestingTime(recipient, scheduleLength - 1) < time,
                    "Cannot add new vested entries earlier than the last one"
                );
                totalEscrowedAccountBalance[recipient] = totalEscrowedAccountBalance[recipient].add(amount);
            }

            vestingSchedules[recipient].push([time, amount]);

            _totalAmount = _totalAmount.add(amount);
            emit Fund(recipient, amount);
        }

        totalEscrowedBalance = totalEscrowedBalance.add(_totalAmount);
       
        /* There must be enough balance in the contract to provide for the vesting entries. */
        require(
            totalEscrowedBalance <= ERC20(token).balanceOf(address(this)),
            "Must be enough balance in the contract to provide for the vesting entries"
        );
    }

    function getVestingScheduleEntry(address account, uint index) public view returns (uint[2] memory) {
        return vestingSchedules[account][index];
    }

    function getVestingTime(address account, uint index) public view returns (uint) {
        return getVestingScheduleEntry(account, index)[TIME_INDEX];
    }

    function _numVestingEntries(address account) internal view returns (uint) {
        return vestingSchedules[account].length;
    }

    function numVestingEntries(address account) external view returns (uint) {
        return vestingSchedules[account].length;
    }

    function getVestingQuantity(address account, uint index) public view returns (uint) {
        return getVestingScheduleEntry(account, index)[AMOUNT_INDEX];
    }

    function getNextVestingIndex(address account) public view returns (uint) {
        uint len = _numVestingEntries(account);
        for (uint i = 0; i < len; i++) {
            if (getVestingTime(account, i) != 0) {
                return i;
            }
        }
        return len;
    }

    function getNextVestingEntry(address account) public view returns (uint[2] memory) {
        uint index = getNextVestingIndex(account);
        if (index == _numVestingEntries(account)) {
            return [uint(0), 0];
        }
        return getVestingScheduleEntry(account, index);
    }

    function getNextVestingTime(address account) external view returns (uint) {
        return getNextVestingEntry(account)[TIME_INDEX];
    }

    function getNextVestingQuantity(address account) external view returns (uint) {
        return getNextVestingEntry(account)[AMOUNT_INDEX];
    }

    /**
     * @notice return the full vesting schedule entries vest for a given user.
     * @dev For DApps to display the vesting schedule for the
     * inflationary supply over 52 weeks. Solidity can't return variable length arrays
     * so this is returning pairs of data. Vesting Time at [0] and quantity at [1] and so on
     */
    function checkAccountSchedule(address account) public view returns (uint[104] memory) {
        uint[104] memory _result;
        uint schedules = _numVestingEntries(account);
        for (uint i = 0; i < schedules; i++) {
            uint[2] memory pair = getVestingScheduleEntry(account, i);
            _result[i * 2] = pair[0];
            _result[i * 2 + 1] = pair[1];
        }
        return _result;
    }

    function balanceOf(address _recipient) public view returns (uint) {
        return totalEscrowedAccountBalance[_recipient];
    }

    function claim() external {
        uint numEntries = _numVestingEntries(msg.sender);
        uint total;
        for (uint i = 0; i < numEntries; i++) {
            uint time = getVestingTime(msg.sender, i);
            /* The list is sorted; when we reach the first future time, bail out. */
            if (time > now) {
                break;
            }
            uint qty = getVestingQuantity(msg.sender, i);
            if (qty > 0) {
                vestingSchedules[msg.sender][i] = [0, 0];
                total = total.add(qty);
            }
        }

        if (total != 0) {
            totalEscrowedBalance = totalEscrowedBalance.sub(total);
            totalEscrowedAccountBalance[msg.sender] = totalEscrowedAccountBalance[msg.sender].sub(total);
            totalVestedAccountBalance[msg.sender] = totalVestedAccountBalance[msg.sender].add(total);
            ERC20(token).transfer(msg.sender, total);
            emit Claim(msg.sender, now, total);
        }
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Admin only");
        _;
    }

    event Fund(address indexed _recipient, uint _amount);
    event Claim(address indexed _address, uint now, uint _amount);
}
pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/math/Math.sol";
import "synthetix-2.43.1/contracts/SafeDecimalMath.sol";
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity-2.3.0/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity-2.3.0/contracts/utils/ReentrancyGuard.sol";
import "synthetix-2.43.1/contracts/Pausable.sol";
import "./interfaces/IEscrowThales.sol";

contract EscrowThales is IEscrowThales, Owned, ReentrancyGuard, Pausable {

    using SafeMath for uint;
    using SafeDecimalMath for uint;
    using SafeERC20 for IERC20;

    IERC20 public vestingToken;

    uint private _totalVestingSupply = 0;
    address private _StakingThalesContract;
    uint private _weeksOfStaking = 0;
    uint private _totalAvailableForVesting = 0;
    uint private _totalVested = 0;

    mapping(address => uint) private _lastStakedWeek;
    mapping(address => uint) private _stakerSilo;
    mapping(address => uint[10]) private _stakerWeeks;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _owner,
        address _vestingToken, //THALES
        address _stakingThalesContract
    ) public Owned(_owner) {
        vestingToken = IERC20(_vestingToken);
        _StakingThalesContract = _stakingThalesContract;
    }

    function claimable(address account) external view returns (uint) {
        require(account != address(0), "Invalid address");
        if (_weeksOfStaking.sub(_lastStakedWeek[account]) > _stakerWeeks[account].length) {
            return pendingClaimable(account).add(_stakerSilo[account]);
        } else {
            return _stakerSilo[account];
        }
    }

    function addToEscrow(address account, uint amount) external {
        require(account != address(0), "Invalid address");
        require(amount > 0, "Amount is 0");
        require(_weeksOfStaking > 0, "Claiming rewards still not available");
        // This can be removed if it is open for different contracts
        require(msg.sender == _StakingThalesContract, "Invalid StakingToken, please update");
        require(_lastStakedWeek[account] <= _weeksOfStaking, "Critical error");

        if (_lastStakedWeek[account] < _weeksOfStaking) {
            moveToStakerSilo(account, _lastStakedWeek[account], _weeksOfStaking);
            _lastStakedWeek[account] = _weeksOfStaking;
            _stakerWeeks[account][_weeksOfStaking.sub(1).mod(_stakerWeeks[account].length)].add(amount);
            _totalVestingSupply = _totalVestingSupply.add(amount);
            //Transfering THALES from StakingThales to EscrowThales
            vestingToken.transferFrom(msg.sender, address(this), amount);
            emit AddedToEscrow(account, amount);
        } else {
            _stakerWeeks[account][_weeksOfStaking.sub(1).mod(_stakerWeeks[account].length)].add(amount);
            _totalVestingSupply = _totalVestingSupply.add(amount);
            //Transfering THALES from StakingThales to EscrowThales
            vestingToken.transferFrom(msg.sender, address(this), amount);
            emit AddedToEscrow(account, amount);
        }
    }

    function vest(uint amount) external nonReentrant notPaused returns (bool) {
        require(msg.sender != address(0), "Invalid address");
        require(amount > 0, "Claimed amount is 0");
        require(_weeksOfStaking > 0, "Claiming rewards still not available");
        require(_lastStakedWeek[msg.sender] <= _weeksOfStaking, "Critical error");

        // If user has not recently staked anything, move the older rewards to stakerSilo
        if (_lastStakedWeek[msg.sender] < _weeksOfStaking) {
            moveToStakerSilo(msg.sender, _lastStakedWeek[msg.sender], _weeksOfStaking);
            _lastStakedWeek[msg.sender] = _weeksOfStaking;
        }
        // Amount must be lower than the reward
        require(amount <= _stakerSilo[msg.sender], "Amount exceeds the claimable rewards");
        _stakerSilo[msg.sender] = _stakerSilo[msg.sender].sub(amount);
        _totalVestingSupply = _totalVestingSupply.sub(amount);
        _totalAvailableForVesting = _totalAvailableForVesting.sub(amount);
        _totalVested = _totalVested.add(amount);
        vestingToken.transfer(msg.sender, amount);
        emit Vested(msg.sender, amount);
        return true;
    }

    function updateCurrentWeek(uint currentWeek) external returns (bool) {
        require(msg.sender == _StakingThalesContract, "Invalid StakingToken, please update");
        require(currentWeek > 0, "Invalid update value");
        _weeksOfStaking = currentWeek;
        return true;
    }
    
    function getCurrentWeek() external view returns (uint) {
        return _weeksOfStaking;
    }

    function getStakingThalesContract() external view onlyOwner returns (address) {
        return _StakingThalesContract;
    }

    function setStakingThalesContract(address StakingThalesContract) external onlyOwner {
        require(StakingThalesContract != address(0), "Invalid address set");
        _StakingThalesContract = StakingThalesContract;
    }

    function selfDestruct(address payable account) external onlyOwner {
        vestingToken.transfer(account, vestingToken.balanceOf(address(this)));
        selfdestruct(account);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function moveToStakerSilo(
        address account,
        uint lastStakedWeek,
        uint currentWeek
    ) internal returns (bool) {
        require(account != address(0), "Invalid account");
        require(currentWeek > 0, "Current week can not be 0");
        require(lastStakedWeek < currentWeek, "LastStakedWeek not lower than CurrentWeek");
        if (currentWeek.sub(lastStakedWeek) > _stakerWeeks[account].length) {
            // Move all to stakerSilo
            for (uint i = 0; i < _stakerWeeks[account].length; i++) {
                _stakerSilo[account].add(_stakerWeeks[account][i]);
                _totalAvailableForVesting = _totalAvailableForVesting.add(_stakerWeeks[account][i]);
                _stakerWeeks[account][i] = 0;
            }
            return true;
        } else {
            //lastStakedWeek can not be lower than 0, currentWeek is covered by require
            if (lastStakedWeek == 0) {
                lastStakedWeek = 0;
            } else {
                lastStakedWeek = lastStakedWeek.sub(1);
            }

            // Move only the difference between
            for (
                uint i = lastStakedWeek.mod(_stakerWeeks[account].length);
                i < (currentWeek.sub(1)).mod(_stakerWeeks[account].length);
                i++
            ) {
                _stakerSilo[account].add(_stakerWeeks[account][i]);
                _totalAvailableForVesting = _totalAvailableForVesting.add(_stakerWeeks[account][i]);
                _stakerWeeks[account][i] = 0;
            }
            return true;
        }
    }

    function pendingClaimable(address account) internal view returns (uint) {
        require(_lastStakedWeek[account] > 0, "Account never staked anything");
        uint totalPending = 0;
        for (uint i = 0; i < _stakerWeeks[account].length; i++) {
            totalPending.add(_stakerWeeks[account][i]);
        }
        return totalPending;
    }

    /* ========== EVENTS ========== */

    event AddedToEscrow(address acount, uint amount);
    event Vested(address account, uint amount);
}

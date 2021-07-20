pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/math/Math.sol";
import "synthetix-2.43.1/contracts/SafeDecimalMath.sol";
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity-2.3.0/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity-2.3.0/contracts/utils/ReentrancyGuard.sol";
import "synthetix-2.43.1/contracts/Pausable.sol";
import "./interfaces/IEscrowThales.sol";

contract EscrowThales is IEscrowThales, Owned, IERC20, ReentrancyGuard, Pausable {
    using SafeMath for uint;
    using SafeDecimalMath for uint;
    using SafeERC20 for IERC20;

    address private _StakingThalesContract;
    uint private _weeksOfStaking = 0;

    mapping(address => uint) private _lastStakedWeek;
    mapping(address => uint) private _stakerSilo;
    mapping(address => uint[10]) private _stakerWeeks;

    function claimable(address account) external view returns (uint) {
        require(account != address(0), "Invalid address");
        if (_weeksOfStaking.sub(_lastStakedWeek[account]) > _stakerWeeks[account].length) {
            return pendingClaimable(account).add(_stakerSilo[account]);
        } else {
            return _stakerSilo[account];
        }
    }

    function addToEscrow(address account, uint amount) external returns (bool) {
        require(account != address(0), "Invalid address");
        require(amount > 0, "Amount is 0");
        require(_weeksOfStaking > 0, "Claiming rewards still not available");
        // This can be removed if it is open for different contracts
        require(msg.sender == _StakingThalesContract, "Invalid StakingToken, please update");
        require(_lastStakedWeek[account] <= _weeksOfStaking, "Critical error");

        if (_lastStakedWeek[account] < _weeksOfStaking) {
            moveToStakerSilo(account, _lastStakedWeek[account], _weeksOfStaking);
            _lastStakedWeek[account] = _weeksOfStaking;
            _stakerWeeks[account][_weeksOfStaking.sub(1)].add(amount);
            emit AddedToEscrow(account, amount);
        } else {
            _stakerWeeks[account][_weeksOfStaking.sub(1)].add(amount);
            emit AddedToEscrow(account, amount);
        }
    }

    function claim(uint amount) external nonReentrant notPaused {
        // CONTINUE HERE
        emit Claimed(msg.sender, amount);
    }

    function updateCurrentWeek(uint currentWeek) external returns (bool) {
        require(msg.sender == _StakingThalesContract, "Invalid StakingToken, please update");
        require(currentWeek > 0, "Invalid update value");
        _weeksOfStaking = currentWeek;
        return true;
    }

    function setStakingThalesContract(address StakingThalesContract) external onlyOwner {
        require(StakingThalesContract != address(0), "Invalid address set");
        _StakingThalesContract = StakingThalesContract;
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function moveToStakerSilo(
        address account,
        uint lastStakedWeek,
        uint currentWeek
    ) internal returns (bool) {
        require(account != address(0), "Invalid account");
        require(lastStakedWeek < currentWeek, "LastStakedWeek not lower than CurrentWeek");
        if (currentWeek.sub(lastStakedWeek) > _stakerWeeks[account].length) {
            // Move all to stakerSilo
            for (uint i = 0; i < _stakerWeeks[account].length; i++) {
                _stakerSilo[account].add(_stakerWeeks[account][i]);
                _stakerWeeks[account][i] = 0;
            }
            return true;
        } else {
            // Move only the difference between
            for (
                uint i = (lastStakedWeek.sub(1)).mod(_stakerWeeks[account].length);
                i < (currentWeek.sub(1)).mod(_stakerWeeks[account].length);
                i++
            ) {
                _stakerSilo[account].add(_stakerWeeks[account][i]);
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
    event Claimed(address account, uint amount);
}

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

    mapping(address => uint) private _lastClaimedWeek;
    mapping(address => uint) private _lastMoveToSilo;
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

    function getStakerWeeks(address account) external view returns (uint[10] memory) {
        require(account != address(0), "Invalid account address");
        return _stakerWeeks[account];
    }

    function getLastStakedWeek(address account) external view returns (uint) {
        require(account != address(0), "Invalid account address");
        return _lastClaimedWeek[account];
    }

    function getStakerSilo(address account) external view returns (uint) {
        require(account != address(0), "Invalid account address");
        return _stakerSilo[account];
    }

    function getStakerWeeksLength(address account) external view returns (uint) {
        require(account != address(0), "Invalid account address");
        return _stakerWeeks[account].length;
    }

    function claimable(address account) external view returns (uint) {
        require(account != address(0), "Invalid address");
        require(_weeksOfStaking > 0, "WeeksOfStaking = 0");
        if (pendingClaimable(account) == 0) {
            return _stakerSilo[account];
        } else if (_weeksOfStaking.sub(_lastMoveToSilo[account]) > _stakerWeeks[account].length.mul(2)) {
            return pendingClaimable(account).add(_stakerSilo[account]);
        } else {
            uint total_pending = 0;
            if (
                (_lastMoveToSilo[account].mod(_stakerWeeks[account].length)) <
                (_weeksOfStaking.mod(_stakerWeeks[account].length))
            ) {
                for (
                    uint i = (_lastMoveToSilo[account].mod(_stakerWeeks[account].length));
                    i < (_weeksOfStaking.mod(_stakerWeeks[account].length));
                    i++
                ) {
                    total_pending = total_pending.add(_stakerWeeks[account][i]);
                }
            }
            total_pending = total_pending.add(_stakerSilo[account]);
            return total_pending;
        }
    }

    function addToEscrow(address account, uint amount) external {
        require(account != address(0), "Invalid address");
        require(amount > 0, "Amount is 0");
        require(_weeksOfStaking > 0, "Claiming rewards still not available");
        // This can be removed if it is open for different contracts
        require(msg.sender == _StakingThalesContract, "Invalid StakingToken, please update");
        require(_lastClaimedWeek[account] <= _weeksOfStaking, "Critical error");

        if (_weeksOfStaking > _stakerWeeks[account].length) {
            if (_weeksOfStaking.sub(_lastMoveToSilo[account]) <= _stakerWeeks[account].length.mul(2)) {
                if (
                    (_weeksOfStaking.sub(1).mod(_stakerWeeks[account].length)) >
                    (_lastMoveToSilo[account].mod(_stakerWeeks[account].length)) &&
                    (_weeksOfStaking.sub(1).mod(_stakerWeeks[account].length)).sub(
                        _lastMoveToSilo[account].mod(_stakerWeeks[account].length)
                    ) >
                    1
                ) {
                    moveToStakerSilo(
                        account,
                        (_lastMoveToSilo[account].mod(_stakerWeeks[account].length)),
                        _weeksOfStaking.sub(1).mod(_stakerWeeks[account].length)
                    );
                }
                _lastMoveToSilo[account] = _weeksOfStaking.sub(_stakerWeeks[account].length);
            } else {
                moveToStakerSilo(account, 0, _stakerWeeks[account].length);
                _lastMoveToSilo[account] = _weeksOfStaking;
            }
        }

        if (_stakerWeeks[account][_weeksOfStaking.sub(1).mod(_stakerWeeks[account].length)] > 0) {
            _stakerSilo[account] = _stakerSilo[account].add(
                _stakerWeeks[account][_weeksOfStaking.sub(1).mod(_stakerWeeks[account].length)]
            );
            _totalAvailableForVesting = _totalAvailableForVesting.add(
                _stakerWeeks[account][_weeksOfStaking.sub(1).mod(_stakerWeeks[account].length)]
            );
            _stakerWeeks[account][_weeksOfStaking.sub(1).mod(_stakerWeeks[account].length)] = 0;
        }

        _lastClaimedWeek[account] = _weeksOfStaking;
        _stakerWeeks[account][_weeksOfStaking.sub(1).mod(_stakerWeeks[account].length)] = _stakerWeeks[account][
            _weeksOfStaking.sub(1).mod(_stakerWeeks[account].length)
        ]
            .add(amount);
        _totalVestingSupply = _totalVestingSupply.add(amount);
        //Transfering THALES from StakingThales to EscrowThales
        vestingToken.transferFrom(msg.sender, address(this), amount);
        emit AddedToEscrow(account, amount);
    }

    function vest(uint amount) external nonReentrant notPaused returns (bool) {
        require(msg.sender != address(0), "Invalid address");
        require(amount > 0, "Claimed amount is 0");
        require(_weeksOfStaking > 0, "Claiming rewards still not available");
        require(_lastClaimedWeek[msg.sender] <= _weeksOfStaking, "Critical error");

        // If user has not recently staked anything, move the older rewards to stakerSilo
        if (_weeksOfStaking.sub(_lastMoveToSilo[msg.sender]) > _stakerWeeks[msg.sender].length) {
            moveToStakerSilo(msg.sender, _lastMoveToSilo[msg.sender], _weeksOfStaking);
            _lastMoveToSilo[msg.sender] = _weeksOfStaking;
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

    //remove this:
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
        uint start,
        uint finish
    ) internal returns (bool) {
        require(account != address(0), "Invalid account");
        require(start < finish, "Invalid moving fields (start < finish)");
        for (uint i = start; i < finish; i++) {
            _stakerSilo[account] = _stakerSilo[account].add(_stakerWeeks[account][i]);
            _totalAvailableForVesting = _totalAvailableForVesting.add(_stakerWeeks[account][i]);
            _stakerWeeks[account][i] = 0;
        }
        return true;
    }

    function pendingClaimable(address account) internal view returns (uint) {
        require(_lastClaimedWeek[account] > 0, "Account never staked anything");
        uint totalPending = 0;
        for (uint i = 0; i < _stakerWeeks[account].length; i++) {
            totalPending = totalPending.add(_stakerWeeks[account][i]);
        }
        return totalPending;
    }

    /* ========== EVENTS ========== */

    event AddedToEscrow(address acount, uint amount);
    event Vested(address account, uint amount);
}

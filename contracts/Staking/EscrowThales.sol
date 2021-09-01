pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/math/Math.sol";
import "synthetix-2.43.1/contracts/SafeDecimalMath.sol";
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity-2.3.0/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity-2.3.0/contracts/utils/ReentrancyGuard.sol";
import "synthetix-2.43.1/contracts/Pausable.sol";
import "../interfaces/IEscrowThales.sol";
import "../interfaces/IStakingThales.sol";

contract EscrowThales is IEscrowThales, Owned, ReentrancyGuard, Pausable {
    using SafeMath for uint;
    using SafeDecimalMath for uint;
    using SafeERC20 for IERC20;

    IERC20 public vestingToken;
    IStakingThales public iStakingThales;
    address public _StakingThalesContract;
    address public _AirdropContract;

    uint public constant NUM_WEEKS = 10;
    uint public totalEscrowedRewards = 0;
    uint public _weeksOfVesting = 0;

    uint private _totalVested = 0;

    struct VestingEntry {
        uint amount;
        uint vesting_week;
    }

    mapping(address => VestingEntry[NUM_WEEKS]) private vestingEntry;
    mapping(address => uint) public _lastWeekAddedReward;
    mapping(address => uint) private _totalEscrowedAmount;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _owner,
        address _vestingToken //THALES
    ) public Owned(_owner) {
        vestingToken = IERC20(_vestingToken);
    }

    function getStakerWeek(address account, uint index) external view returns (uint) {
        require(account != address(0), "Invalid account address");
        return vestingEntry[account][index].vesting_week;
    }
    
    function getStakerAmounts(address account, uint index) external view returns (uint) {
        require(account != address(0), "Invalid account address");
        return vestingEntry[account][index].amount;
    }

    function getEscrowedBalance(address account) external view returns (uint) {
        return _totalEscrowedAmount[account];
    }

    function getStakedEscrowedBalance(address account) external view returns (uint) {
        if (_lastWeekAddedReward[account] > 0) {
            return
                _totalEscrowedAmount[account].sub(
                    vestingEntry[account][_weeksOfVesting.mod(NUM_WEEKS)].amount
                );
        } else {
            return 0;
        }
    }

    function getLastWeekAddedReward(address account) external view returns (uint) {
        require(account != address(0), "Invalid account address");
        return _lastWeekAddedReward[account];
    }

    function getTotalEscrowedRewards() external view returns (uint) {
        return totalEscrowedRewards;
    }


    function claimable(address account) external view returns (uint) {
        require(account != address(0), "Invalid address");
        require(_weeksOfVesting > 0, "WeeksOfStaking = 0");
        return _totalEscrowedAmount[msg.sender].sub(getVestingNotAvailable(account));
    }

    function addToEscrow(address account, uint amount) external {
        require(account != address(0), "Invalid address");
        require(amount > 0, "Amount is 0");
        require(_weeksOfVesting > 0, "Claiming rewards still not available");
        // This can be removed if it is open for different contracts
        require(
            msg.sender == _StakingThalesContract || msg.sender == _AirdropContract,
            "Invalid StakingToken, please update"
        );
        require(_lastWeekAddedReward[account] <= _weeksOfVesting, "Critical error");

        _totalEscrowedAmount[account] = _totalEscrowedAmount[account].add(amount);

        vestingEntry[account][_weeksOfVesting.mod(NUM_WEEKS)].amount = amount;
        vestingEntry[account][_weeksOfVesting.mod(NUM_WEEKS)].vesting_week = _weeksOfVesting.add(NUM_WEEKS);
        
        totalEscrowedRewards = totalEscrowedRewards.add(amount);
        //Transfering THALES from StakingThales to EscrowThales
        vestingToken.transferFrom(msg.sender, address(this), amount);
        emit AddedToEscrow(account, amount);
    }

    function vest(uint amount) external nonReentrant notPaused returns (bool) {
        require(msg.sender != address(0), "Invalid address");
        require(amount > 0, "Claimed amount is 0");
        require(_weeksOfVesting > NUM_WEEKS, "Vesting rewards still not available");
        require(_lastWeekAddedReward[msg.sender] <= _weeksOfVesting, "Critical error");
        // User can not vest if it is still staking, or it has staked balance > 0
        // Needs to unstake, then vest the claimable amount
        require(iStakingThales.stakedBalanceOf(msg.sender) == 0, "User is still staking. Please unstake before vesting");

        uint vestingAmount = 0;
        vestingAmount = _totalEscrowedAmount[msg.sender].sub(getVestingNotAvailable(msg.sender));
        // Amount must be lower than the reward
        require(amount <= vestingAmount, "Amount exceeds the claimable rewards");
        _totalEscrowedAmount[msg.sender] = _totalEscrowedAmount[msg.sender].sub(amount);
        totalEscrowedRewards = totalEscrowedRewards.sub(amount);
        _totalVested = _totalVested.add(amount);
        vestingToken.transfer(msg.sender, amount);
        emit Vested(msg.sender, amount);
        return true;
    }

    function updateCurrentWeek() external returns (bool) {
        require(msg.sender == _StakingThalesContract, "Invalid StakingToken, please update");
        _weeksOfVesting = _weeksOfVesting.add(1);
        return true;
    }

    function getCurrentWeek() external view returns (uint) {
        return _weeksOfVesting;
    }

    function setStakingThalesContract(address StakingThalesContract) external onlyOwner {
        require(StakingThalesContract != address(0), "Invalid address set");
        _StakingThalesContract = StakingThalesContract;
        iStakingThales = IStakingThales(StakingThalesContract);
    }

    function setAirdropContract(address AirdropContract) external onlyOwner {
        require(AirdropContract != address(0), "Invalid address set");
        _AirdropContract = AirdropContract;
    }

    function selfDestruct(address payable account) external onlyOwner {
        vestingToken.transfer(account, vestingToken.balanceOf(address(this)));
        selfdestruct(account);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function getVestingNotAvailable(address account) internal view returns (uint) {
        uint vesting_not_available = 0;
        for (uint i=0; i<NUM_WEEKS; i++) {
            if(vestingEntry[account][i].vesting_week >= _weeksOfVesting) {
                vesting_not_available = vesting_not_available.add(vestingEntry[account][i].amount);
            }
        }
        return vesting_not_available;
    }


    /* ========== EVENTS ========== */

    event AddedToEscrow(address acount, uint amount);
    event Vested(address account, uint amount);
}

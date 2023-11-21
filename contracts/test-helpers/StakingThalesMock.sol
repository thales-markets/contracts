pragma solidity ^0.8.0;

import "../interfaces/IStakingThalesBonusRewardsManager.sol";
import "../interfaces/ICCIPCollector.sol";

contract StakingThalesMock {
    uint private constant ONE = 1e18;

    IStakingThalesBonusRewardsManager public stakingThalesBonusRewardsManager;
    address public ccipCollector;
    uint public fixedRewards;
    uint public extraRewards;
    uint public stakedAmount;
    uint public escrowedAmount;

    bool public paused;

    uint public round;

    uint public periodExtraReward = 30000000000000000000000;

    mapping(address => uint) private _stakedBalances;
    mapping(address => uint) public volume;

    constructor() public {}

    function stakedBalanceOf(address account) external view returns (uint) {
        return _stakedBalances[account];
    }

    function stake(uint amount) external {
        _stakedBalances[msg.sender] = amount;
        stakedAmount += amount;
        escrowedAmount += (amount * 10 * 1e16) / 1e18;
    }

    function updateVolumeWithOrigin(
        address account,
        uint amount,
        address origin
    ) external {
        stakingThalesBonusRewardsManager.storePoints(account, origin, amount, round);
    }

    function setStakingThalesBonusRewardsManager(IStakingThalesBonusRewardsManager _stakingThalesBonusRewardsManager)
        external
    {
        stakingThalesBonusRewardsManager = _stakingThalesBonusRewardsManager;
    }

    function incrementRound() external {
        round = round + 1;
    }

    function getRewards(address account) external view returns (uint) {
        return (periodExtraReward * (stakingThalesBonusRewardsManager.getUserRoundBonusShare(account, round))) / ONE;
    }

    function closePeriod() external {
        ++round;
        fixedRewards = 0;
        extraRewards = 0;
        paused = true;
        ICCIPCollector(ccipCollector).sendOnClosePeriod(
            stakedAmount,
            escrowedAmount,
            stakingThalesBonusRewardsManager.totalRoundBonusPoints(round - 1)
        );
        emit RoundClosed(stakedAmount, escrowedAmount, stakingThalesBonusRewardsManager.totalRoundBonusPoints(round - 1));
    }

    function updateStakingRewards(
        uint _baseRewards,
        uint _extraRewards,
        uint _stakedAmount,
        uint _escrowedAmount
    ) external {
        fixedRewards = _baseRewards;
        extraRewards = _extraRewards;
        stakedAmount = _stakedAmount;
        escrowedAmount = _escrowedAmount;
        emit RewardsUpdated(_baseRewards, _extraRewards, _stakedAmount, _escrowedAmount);
    }

    function setCCIPCollector(address _ccipCollector) external {
        ccipCollector = _ccipCollector;
    }

    event RewardsUpdated(uint _baseRewards, uint _extraRewards, uint _stakedAmount, uint _escrowedAmount);
    event RoundClosed(uint stakedAmount, uint escrowedAmount, uint stakingPoints);
}

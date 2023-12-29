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
    uint public revenueShare;

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
        revenueShare += 10 * amount;
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
            stakingThalesBonusRewardsManager.totalRoundBonusPoints(round - 1),
            revenueShare
        );
        emit RoundClosed(
            stakedAmount,
            escrowedAmount,
            stakingThalesBonusRewardsManager.totalRoundBonusPoints(round - 1),
            revenueShare
        );
    }

    function updateStakingRewards(
        uint _baseRewards,
        uint _extraRewards,
        uint _revenueShare
    ) external {
        fixedRewards = _baseRewards;
        extraRewards = _extraRewards;
        revenueShare = _revenueShare;
        emit RewardsUpdated(_baseRewards, _extraRewards, _revenueShare);
    }

    function setCCIPCollector(address _ccipCollector) external {
        ccipCollector = _ccipCollector;
    }

    event RewardsUpdated(uint _baseRewards, uint _extraRewards, uint _revenueShare);
    event RoundClosed(uint stakedAmount, uint escrowedAmount, uint stakingPoints, uint revenueShare);
}

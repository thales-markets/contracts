pragma solidity ^0.8.0;

import "../interfaces/IStakingThalesBonusRewardsManager.sol";

contract StakingThalesMock {
    uint private constant ONE = 1e18;

    IStakingThalesBonusRewardsManager public stakingThalesBonusRewardsManager;

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
}

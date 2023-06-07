pragma solidity ^0.5.16;

import "../interfaces/IStakingThalesBonusRewardsManager.sol";

contract StakingThalesMock {
    IStakingThalesBonusRewardsManager public stakingThalesBonusRewardsManager;

    uint public round;

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
}

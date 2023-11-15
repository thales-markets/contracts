pragma solidity ^0.5.16;

import "../interfaces/ICCIPCollector.sol";

contract MockStakingThales {
    mapping(address => uint) private _stakedBalances;
    mapping(address => uint) public volume;

    uint public baseRewards;
    uint public extraRewards;
    uint public totalStaked;
    uint public totalEscrowed;

    constructor() public {}

    function stakedBalanceOf(address account) external view returns (uint) {
        return _stakedBalances[account];
    }

    function stake(uint amount) external {
        _stakedBalances[msg.sender] = amount;
    }

    function updateVolume(address account, uint amount) external {
        volume[msg.sender] = amount;
    }

    function sendOnClosePeriod(
        uint totalStakedLastPeriodEnd,
        uint totalEscrowedLastPeriodEnd,
        address ccipCollector
    ) external {
        ICCIPCollector(ccipCollector).sendOnClosePeriod(totalStakedLastPeriodEnd, totalEscrowedLastPeriodEnd);
    }

    function updateStakingRewards(
        uint _baseRewards,
        uint _extraRewards,
        uint _stakedAmount,
        uint _escrowedAmount
    ) external {
        baseRewards = _baseRewards;
        extraRewards = _extraRewards;
        totalStaked = _stakedAmount;
        totalEscrowed = _escrowedAmount;
        emit UpdatedStakingRewards(_baseRewards, _extraRewards, _stakedAmount, _escrowedAmount);
    }

    event UpdatedStakingRewards(uint baseRewards, uint extraRewards, uint stakedAmount, uint escrowedAmount);
}

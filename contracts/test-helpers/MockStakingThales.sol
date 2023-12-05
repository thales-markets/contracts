pragma solidity ^0.5.16;

import "../interfaces/ICCIPCollector.sol";

contract MockStakingThales {
    mapping(address => uint) private _stakedBalances;
    mapping(address => uint) public volume;

    uint public baseRewards;
    uint public extraRewards;
    uint public bonusPoints;
    uint public totalStaked;
    uint public totalEscrowed;
    uint public revenueShare;

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
        address ccipCollector,
        uint totalStakedLastPeriodEnd,
        uint totalEscrowedLastPeriodEnd,
        uint totalBonusPoints,
        uint revShare
    ) external {
        ICCIPCollector(ccipCollector).sendOnClosePeriod(
            totalStakedLastPeriodEnd,
            totalEscrowedLastPeriodEnd,
            totalBonusPoints,
            revShare
        );
    }

    function updateStakingRewards(
        uint _baseRewards,
        uint _extraRewards,
        uint _stakedAmount,
        uint _escrowedAmount,
        uint _revShare
    ) external {
        baseRewards = _baseRewards;
        extraRewards = _extraRewards;
        totalStaked = _stakedAmount;
        totalEscrowed = _escrowedAmount;
        revenueShare = _revShare;
        emit UpdatedStakingRewards(_baseRewards, _extraRewards, _stakedAmount, _escrowedAmount, _revShare);
    }

    event UpdatedStakingRewards(
        uint baseRewards,
        uint extraRewards,
        uint stakedAmount,
        uint escrowedAmount,
        uint revenueShare
    );
}

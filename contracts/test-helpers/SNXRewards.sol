pragma solidity ^0.5.16;

import "../interfaces/ISNXRewards.sol";

contract SNXRewards is ISNXRewards {

    uint public rewards;
    uint public fees;
    
    uint public totalRewards;
    uint public totalFees;

    constructor() public {}
    /* ========== VIEWS / VARIABLES ========== */
    function totalFeesAvailable() external view returns (uint) {
        return totalFees;
    }

    function totalRewardsAvailable() external view returns (uint) {
        return totalRewards;
    }

    function feesAvailable(address account) external view returns (uint, uint) {
        return (fees, rewards);
    }

    function setRewards(uint _rewards) external {
        rewards = _rewards;
    }
    function setFees(uint _fees) external {
        fees = _fees;
    }
    function setTotalRewards(uint _rewards) external {
        totalRewards = _rewards;
    }
    function setTotalFees(uint _fees) external {
        totalFees = _fees;
    }
}

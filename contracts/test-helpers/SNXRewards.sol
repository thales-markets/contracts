pragma solidity ^0.5.16;

import "../interfaces/ISNXRewards.sol";

contract SNXRewards is ISNXRewards {
    constructor() public {}
    /* ========== VIEWS / VARIABLES ========== */
    function totalFeesAvailable() external view returns (uint) {
        return 1*1e18;
    }

    function totalRewardsAvailable() external view returns (uint) {
        return 1*1e18;
    }

    function feesAvailable(address account) external view returns (uint, uint) {
        return (0, 0);
    }
}

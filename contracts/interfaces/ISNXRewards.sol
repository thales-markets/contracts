pragma solidity ^0.5.16;



interface ISNXRewards {
    /* ========== VIEWS / VARIABLES ========== */
    function totalFeesAvailable() external view returns (uint);

    function totalRewardsAvailable() external view returns (uint);

    function feesAvailable(address account) external view returns (uint, uint);
}

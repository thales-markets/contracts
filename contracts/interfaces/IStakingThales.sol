pragma solidity >=0.4.24;



interface IStakingThales {
    /* ========== VIEWS / VARIABLES ========== */
    function totalStakedAmount() external view returns (uint);

    function stakedBalanceOf(address account) external view returns (uint); 

    function getLastWeekRewards() external view returns (uint);

    function getLastWeekFees() external view returns (uint);

    function getLastWeekOfClaimedRewards(address account) external view returns (uint);

    function getRewardsAvailable(address account) external view returns (uint);

    function getRewardFeesAvailable(address account) external view returns (uint);

    function getAlreadyClaimedRewards(address account) external view returns (uint);

    function getAlreadyClaimedFees(address account) external view returns (uint);

    function getContractRewardFunds() external view returns (uint);

    function getContractFeeFunds() external view returns (uint);
    
}

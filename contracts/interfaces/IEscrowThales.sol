pragma solidity >=0.4.24;

interface IEscrowThales {
    /* ========== VIEWS / VARIABLES ========== */
    function getStakerPeriod(address account, uint index) external view returns (uint);

    function getStakerAmounts(address account, uint index) external view returns (uint);

    function totalAccountEscrowedAmount(address account) external view returns (uint);

    function getStakedEscrowedBalanceForRewards(address account) external view returns (uint);

    function totalEscrowedRewards() external view returns (uint);

    function currentVestingPeriod() external view returns (uint);

    function updateCurrentPeriod() external returns (bool);
    
    function claimable(address account) external view returns (uint);

    function addToEscrow(address account, uint amount) external;

    function vest(uint amount) external returns (bool);

}

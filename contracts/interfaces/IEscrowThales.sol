pragma solidity >=0.4.24;

interface IEscrowThales {
    /* ========== VIEWS / VARIABLES ========== */
    function getStakerWeek(address account, uint index) external view returns (uint);

    function getStakerAmounts(address account, uint index) external view returns (uint);

    function getEscrowedBalance(address account) external view returns (uint);

    function getStakedEscrowedBalance(address account) external view returns (uint);

    function getStakerWeeksLength(address account) external view returns (uint);

    function getTotalEscrowedRewards() external view returns (uint);

    function getCurrentWeek() external view returns (uint);

    function updateCurrentWeek() external returns (bool);
    
    function claimable(address account) external view returns (uint);

    function addToEscrow(address account, uint amount) external;

    function vest(uint amount) external returns (bool);

}

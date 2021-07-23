pragma solidity >=0.4.24;

interface IEscrowThales {
    /* ========== VIEWS / VARIABLES ========== */

    function claimable(address account) external view returns (uint);

    function addToEscrow(address account, uint amount) external;

    function vest(uint amount) external returns (bool);

    function updateCurrentWeek(uint currentWeek) external returns (bool);
}

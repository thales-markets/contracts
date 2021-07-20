pragma solidity >=0.4.24;

interface IEscrowThales {
    /* ========== VIEWS / VARIABLES ========== */

    function addToEscrow(address account, uint amount) external returns (bool);

    function claimable(address account) external view returns (uint);

    function updateCurrentWeek(uint currentWeek) external returns (bool);
}

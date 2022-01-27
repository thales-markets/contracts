pragma solidity ^0.5.16;



interface ISNXRewardsState {
    /* ========== VIEWS / VARIABLES ========== */
    function getAccountsDebtEntry(address account, uint index) external view returns (uint, uint);
    function setAccountsDebtEntry(address account, uint index, uint _debtPercentage, uint _debtEntryIndex) external;

}
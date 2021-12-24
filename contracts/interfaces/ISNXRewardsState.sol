pragma solidity ^0.5.16;



interface ISNXRewards {
    /* ========== VIEWS / VARIABLES ========== */
    function getAccountsDebtEntry(address account, uint index) public view returns (uint, uint);
    function setAccountsDebtEntry(address account, uint index, uint _debtPercentage, uint _debtEntryIndex) external;

}
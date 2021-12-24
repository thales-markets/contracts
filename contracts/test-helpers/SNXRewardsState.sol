pragma solidity ^0.5.16;

import "../interfaces/ISNXRewards.sol";

contract SNXRewardsState is ISNXRewardsState {

    uint public debtPercentage;
    uint public debtEntryIndex;
    
    uint public totalRewards;
    uint public totalFees;

    constructor() public {}
    /* ========== VIEWS / VARIABLES ========== */
    function getAccountsDebtEntry(address account, uint index) public view returns (uint debtPercentage, uint debtEntryIndex)  {
        
    }
    function setAccountsDebtEntry(address account, uint index, uint _debtPercentage, uint _debtEntryIndex) external{
        debtPercentage = _debtPercentage;
        debtEntryIndex = _debtEntryIndex;
    }

}

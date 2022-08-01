// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import "../interfaces/ISNXRewardsState.sol";

contract SNXRewardsState is ISNXRewardsState {
    uint public debtPercentage;
    uint public debtEntryIndex;

    constructor() public {}

    /* ========== VIEWS / VARIABLES ========== */
    function getAccountsDebtEntry(address account, uint index)
        public
        view
        returns (uint _debtPercentage, uint _debtEntryIndex)
    {}

    function setAccountsDebtEntry(
        address account,
        uint index,
        uint _debtPercentage,
        uint _debtEntryIndex
    ) external {
        account = account;
        index = index;
        debtPercentage = _debtPercentage;
        debtEntryIndex = _debtEntryIndex;
    }
}

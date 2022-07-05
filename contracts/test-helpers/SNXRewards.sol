// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/ISNXRewards.sol";

contract SNXRewards is ISNXRewards {
    mapping(address => uint) public c_ratio;
    mapping(address => uint) public debtBalance;
    uint public issuanceGeneralRatio;

    constructor() {}

    /* ========== VIEWS / VARIABLES ========== */
    function collateralisationRatioAndAnyRatesInvalid(address _account) external view override returns (uint, bool) {
        return (c_ratio[_account], false);
    }

    function debtBalanceOf(address _issuer, bytes32 currencyKey) external view override returns (uint) {
        // to silence compile warning
        currencyKey = currencyKey;
        return debtBalance[_issuer];
    }

    function issuanceRatio() external view override returns (uint) {
        return issuanceGeneralRatio;
    }

    function setCRatio(address account, uint _c_ratio) external override {
        c_ratio[account] = _c_ratio;
    }

    function setDebtBalance(address account, uint _debtBalance) external {
        debtBalance[account] = _debtBalance;
    }

    function setIssuanceRatio(uint _issuanceRation) external override {
        issuanceGeneralRatio = _issuanceRation;
    }
}

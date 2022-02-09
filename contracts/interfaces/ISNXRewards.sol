// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISNXRewards {
    /* ========== VIEWS / VARIABLES ========== */
    function collateralisationRatioAndAnyRatesInvalid(address account) external view returns (uint, bool);
    function debtBalanceOf(address _issuer, bytes32 currencyKey) external view returns (uint);
    function issuanceRatio() external view returns (uint);

    function setCRatio(address account, uint _c_ratio) external;
    function setIssuanceRatio(uint _issuanceRation) external;
    
}

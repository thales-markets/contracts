pragma solidity ^0.5.16;

import "../interfaces/ISNXRewards.sol";

contract SNXRewards is ISNXRewards {

    mapping(address => uint) public c_ratio;
    mapping(address => uint) public debtBalance;
    uint public issuanceGeneralRatio;


    constructor() public {}
    /* ========== VIEWS / VARIABLES ========== */
    function collateralisationRatioAndAnyRatesInvalid(address _account)
        external
        view
        returns (uint, bool) {

        return (c_ratio[_account], false);
    }
    
    function debtBalanceOf(address _issuer, bytes32 currencyKey) external view returns (uint) {
        return debtBalance[_issuer];
    }

    function issuanceRatio() external view returns (uint) {
        return issuanceGeneralRatio;
    }

    function setCRatio(address account, uint _c_ratio) external {
        c_ratio[account] = _c_ratio;
    }
    
    function setDebtBalance(address account, uint _debtBalance) external {
        debtBalance[account] = _debtBalance;
    }
    function setIssuanceRatio(uint _issuanceRation) external {
        issuanceGeneralRatio = _issuanceRation;
    }
    
}

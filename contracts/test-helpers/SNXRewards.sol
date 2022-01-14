pragma solidity ^0.5.16;

import "../interfaces/ISNXRewards.sol";

contract SNXRewards is ISNXRewards {

    mapping(address => uint) public accountDebtRatio;
    mapping(address => bool) public feesClaimable;

    constructor() public {}
    /* ========== VIEWS / VARIABLES ========== */
    function isFeesClaimable(address account) external view returns (bool){
        return feesClaimable[account];
    }

    function effectiveDebtRatioForPeriod(address account, uint period) external view returns (uint){
        require(period != 0, "Current period is not closed yet");
        require(period < 2, "Exceeds the FEE_PERIOD_LENGTH");
        return accountDebtRatio[account];
    }

    function setAccountDebtRatio(address account, uint debtRatio) external {
        accountDebtRatio[account] = debtRatio;
    }
    function setFeesClaimable(address account, bool claimable) external {
        feesClaimable[account] = claimable;
    }
    
}

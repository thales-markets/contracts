pragma solidity ^0.5.16;



interface ISNXRewards {
    /* ========== VIEWS / VARIABLES ========== */
    function isFeesClaimable(address account) external view returns (bool);
    function effectiveDebtRatioForPeriod(address account, uint period) external view returns (uint);

    function setAccountDebtRatio(address account, uint debtRatio) external;
    function setFeesClaimable(address account, bool claimable) external;
    
}

pragma solidity ^0.8.0;

interface IExoticPositionalMarketManager {
    /* ========== VIEWS / VARIABLES ========== */
    function getActiveMarketAddress(uint _index) external view returns(address);
    function getActiveMarketIndex(address _marketAddress) external view returns(uint);
    function isActiveMarket(address _marketAddress) external view returns(bool);
    function getMarketBondAmount(address _market) external view returns (uint);
    function fixedBondAmount() external view returns(uint);
    function safeBoxAddress() external view returns(address);


    function disputeMarket(address _marketAddress) external;
    function resolveMarket(address _marketAddress, uint _outcomePosition) external;
    function cancelMarket(address _market) external ;
    function setBackstopTimeout(address _market) external; 
    function sendBondAmountTo(address _market, address _recepient, uint _amount) external;
}   

pragma solidity ^0.8.0;

interface IExoticPositionalMarket {
    /* ========== VIEWS / VARIABLES ========== */
    function isMarketCreated() external view returns (bool);
    function canUsersPlacePosition() external view returns (bool);
    function canMarketBeResolved() external view returns (bool);
    function canUsersClaim() external view returns (bool);
    function winningPosition() external view returns (uint);
    function disputed() external view returns (bool);
    function creatorAddress() external view returns (address);
    function resolverAddress() external view returns (address);
    function totalBondAmount() external view returns(uint);

    function fixedBondAmount() external view returns(uint);
    function disputePrice() external view returns(uint);
    function safeBoxLowAmount() external view returns(uint);
    function arbitraryRewardForDisputor() external view returns(uint);

    function transferBondToMarket(address _sender, uint _amount) external;
}

pragma solidity ^0.8.0;

interface IExoticPositionalMarket {
    /* ========== VIEWS / VARIABLES ========== */
    function isMarketCreated() external view returns (bool);
    function canUsersPlacePosition() external view returns (bool);
    function canMarketBeResolved() external view returns (bool);
    function canHoldersClaim() external view returns (bool);
    function winningPosition() external view returns (uint);

}

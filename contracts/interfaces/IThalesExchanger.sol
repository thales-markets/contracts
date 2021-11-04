pragma solidity ^0.5.16;



interface IThalesExchanger {
    /* ========== VIEWS / VARIABLES ========== */
    function setThalesAddress(address thalesAddress) external;

    function setOpThalesAddress(address opThalesAddress) external;

    function exchangeThalesToOpThales(uint amount) external;

    function exchangeOpThalesToThales(uint amount) external;    
    
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISportsAMM {
    /* ========== VIEWS / VARIABLES ========== */
    
    enum Position {Home, Away, Draw}

    function getMarketDefaultOdds(address _market, bool isSell) external view returns (uint[] memory);
    function isMarketInAMMTrading(address _market) external view returns (bool);
    function availableToBuyFromAMM(address market, Position position) external view returns (uint _available);


    function buyFromAMM(
        address market,
        Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) external;

    function buyFromAmmQuote(
        address market,
        Position position,
        uint amount
    ) external view returns (uint);

}

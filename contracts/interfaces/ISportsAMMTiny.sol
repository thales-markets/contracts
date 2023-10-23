// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISportsAMMTiny {
    /* ========== VIEWS / VARIABLES ========== */

    enum Position {
        Home,
        Away,
        Draw
    }

    function theRundownConsumer() external view returns (address);

    function getMarketDefaultOdds(address _market, bool isSell) external view returns (uint[] memory);

    function isMarketInAMMTrading(address _market) external view returns (bool);

    function parlayAMM() external view returns (address);

    function manager() external view returns (address);

    function getLiquidityPool() external view returns (address);
}

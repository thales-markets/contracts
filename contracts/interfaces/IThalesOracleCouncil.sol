// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IThalesOracleCouncil {
    /* ========== VIEWS / VARIABLES ========== */
    function isOracleCouncilMember(address _councilMember) external view returns (bool);

    function isMarketClosedForDisputes(address _market) external view returns (bool);

    function closeMarketForDisputes(address _market) external;
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IGameChildMarket {
    function mainMarketChildMarketIndex(address _main, uint _index) external view returns (address);

    function numberOfChildMarkets(address _main) external view returns (uint);
}

// SPDX-License-Identifier: MIT
pragma solidity >=0.5.16;

interface IParlayAMMLiquidityPool {
    function commitTrade(address market, uint amountToMint) external;

    function getMarketRound(address market) external view returns (uint _round);

    function getMarketPool(address market) external view returns (address roundPool);

    function transferToPool(address market, uint amount) external;

    function isUserLPing(address user) external view returns (bool isUserInLP);
}

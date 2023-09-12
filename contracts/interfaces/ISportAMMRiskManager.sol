// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ISportAMMRiskManager {
    function calculateCapToBeUsed(address _market) external view returns (uint toReturn);

    function isTotalSpendingLessThanTotalRisk(uint _totalSpent, address _market) external view returns (bool _isNotRisky);

    function isMarketForSportOnePositional(uint _tag) external view returns (bool);

    function isMarketForPlayerPorpsOnePositional(uint _tag) external view returns (bool);
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ISportAMMRiskManager {
    function calculateCapToBeUsed(address _market) external view returns (uint toReturn);

    function isTotalSpendingLessThanTotalRisk(uint _totalSpent, address _market) external view returns (bool _isNotRisky);
}

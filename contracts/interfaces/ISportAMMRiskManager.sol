// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ISportAMMRiskManager {
    function calculateCapToBeUsed(address _market) external view returns (uint toReturn);

    function isTotalSpendingLessThanTotalRisk(uint _totalSpent, address _market) external view returns (bool _isNotRisky);

    function isMarketForSportOnePositional(uint _tag) external view returns (bool);

    function isMarketForPlayerPorpsOnePositional(uint _tag) external view returns (bool);

    function minSupportedOddsPerSport(uint tag) external view returns (uint);

    function minSpreadPerSport(uint tag1, uint tag2) external view returns (uint);

    function maxSpreadPerSport(uint tag) external view returns (uint);

    function getMinSpreadToUse(
        bool useDefaultMinSpread,
        address market,
        uint min_spread,
        uint min_spreadPerAddress
    ) external view returns (uint);

    function getMaxSpreadForMarket(address _market, uint max_spread) external view returns (uint);

    function getMinOddsForMarket(address _market, uint minSupportedOdds) external view returns (uint minOdds);
}

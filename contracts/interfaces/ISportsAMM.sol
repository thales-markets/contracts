// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/ISportAMMRiskManager.sol";

interface ISportsAMM {
    /* ========== VIEWS / VARIABLES ========== */

    enum Position {
        Home,
        Away,
        Draw
    }

    struct SellRequirements {
        address user;
        address market;
        Position position;
        uint amount;
        uint expectedPayout;
        uint additionalSlippage;
    }

    struct DoubleChanceStruct {
        bool isDoubleChance;
        ISportsAMM.Position position1;
        ISportsAMM.Position position2;
        address parentMarket;
    }

    function theRundownConsumer() external view returns (address);

    function riskManager() external view returns (ISportAMMRiskManager riskManager);

    function getMarketDefaultOdds(address _market, bool isSell) external view returns (uint[] memory);

    function isMarketInAMMTrading(address _market) external view returns (bool);

    function isMarketForSportOnePositional(uint _tag) external view returns (bool);

    function availableToBuyFromAMM(address market, Position position) external view returns (uint _available);

    function parlayAMM() external view returns (address);

    function minSupportedOdds() external view returns (uint);

    function maxSupportedOdds() external view returns (uint);

    function minSupportedOddsPerSport(uint) external view returns (uint);

    function min_spread() external view returns (uint);

    function max_spread() external view returns (uint);

    function minimalTimeLeftToMaturity() external view returns (uint);

    function getSpentOnGame(address market) external view returns (uint);

    function safeBoxImpact() external view returns (uint);

    function manager() external view returns (address);

    function getLiquidityPool() external view returns (address);

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

    function buyFromAmmQuoteForParlayAMM(
        address market,
        Position position,
        uint amount
    ) external view returns (uint);

    function updateParlayVolume(address _account, uint _amount) external;

    function buyPriceImpact(
        address market,
        ISportsAMM.Position position,
        uint amount
    ) external view returns (int impact);

    function obtainOdds(address _market, ISportsAMM.Position _position) external view returns (uint oddsToReturn);

    function buyFromAmmQuoteWithDifferentCollateral(
        address market,
        ISportsAMM.Position position,
        uint amount,
        address collateral
    ) external view returns (uint collateralQuote, uint sUSDToPay);

    function availableToBuyFromAMMWithBaseOdds(
        address market,
        ISportsAMM.Position position,
        uint baseOdds,
        uint balance,
        bool useBalance
    ) external view returns (uint availableAmount);

    function floorBaseOdds(uint baseOdds, address market) external view returns (uint);

    function buyFromAmmQuoteWithBaseOdds(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint baseOdds,
        uint useSafeBoxSkewImpact,
        uint available,
        bool useAvailable,
        bool useDefaultMinSpread,
        DoubleChanceStruct memory dcs
    ) external view returns (uint);

    function getDoubleChanceStruct(address market) external view returns (DoubleChanceStruct memory);
}

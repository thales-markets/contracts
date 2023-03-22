// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "../SportMarkets/Parlay/ParlayVerifier.sol";

interface IParlayMarketsAMM {
    /* ========== VIEWS / VARIABLES ========== */

    function parlaySize() external view returns (uint);

    function sUSD() external view returns (IERC20Upgradeable);

    function sportsAmm() external view returns (address);

    function parlayAmmFee() external view returns (uint);

    function maxAllowedRiskPerCombination() external view returns (uint);

    function maxSupportedOdds() external view returns (uint);

    function getSgpFeePerSport(uint tag1) external view returns (uint sgpFee);

    function riskPerCombination(
        address _sportMarkets1,
        uint _position1,
        address _sportMarkets2,
        uint _position2,
        address _sportMarkets3,
        uint _position3,
        address _sportMarkets4,
        uint _position4
    ) external view returns (uint);

    function riskPerGameCombination(
        address _sportMarkets1,
        address _sportMarkets2,
        address _sportMarkets3,
        address _sportMarkets4,
        address _sportMarkets5,
        address _sportMarkets6,
        address _sportMarkets7,
        address _sportMarkets8
    ) external view returns (uint);

    function riskPerPackedGamesCombination(bytes32 gamesPacked) external view returns (uint);

    function isActiveParlay(address _parlayMarket) external view returns (bool isActiveParlayMarket);

    function exerciseParlay(address _parlayMarket) external;

    function exerciseSportMarketInParlay(address _parlayMarket, address _sportMarket) external;

    function triggerResolvedEvent(address _account, bool _userWon) external;

    function resolveParlay() external;

    function buyFromParlay(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDPaid,
        uint _additionalSlippage,
        uint _expectedPayout,
        address _differentRecepient
    ) external;

    function buyQuoteFromParlay(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDPaid
    )
        external
        view
        returns (
            uint sUSDAfterFees,
            uint totalBuyAmount,
            uint totalQuote,
            uint initialQuote,
            uint skewImpact,
            uint[] memory finalQuotes,
            uint[] memory amountsToBuy
        );

    function canCreateParlayMarket(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDToPay
    ) external view returns (bool canBeCreated);

    function numActiveParlayMarkets() external view returns (uint);

    function activeParlayMarkets(uint index, uint pageSize) external view returns (address[] memory);

    function parlayVerifier() external view returns (ParlayVerifier);
}

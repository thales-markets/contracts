// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISpeedMarketsAMMResolver {
    function resolveMarket(address market, bytes[] calldata priceUpdateData) external payable;

    function resolveMarketWithOfframp(
        address market,
        bytes[] calldata priceUpdateData,
        address collateral,
        bool toEth
    ) external payable;

    function resolveMarketsBatch(address[] calldata markets, bytes[] calldata priceUpdateData) external payable;

    function resolveMarketsBatchOffRamp(
        address[] calldata markets,
        bytes[] calldata priceUpdateData,
        address collateral,
        bool toEth
    ) external payable;

    function resolveMarketManually(address _market, int64 _finalPrice) external;

    function resolveMarketManuallyBatch(address[] calldata markets, int64[] calldata finalPrices) external;

    function resolveChainedMarket(address market, bytes[][] calldata priceUpdateData) external payable;

    function resolveChainedMarketWithOfframp(
        address market,
        bytes[][] calldata priceUpdateData,
        address collateral,
        bool toEth
    ) external payable;

    function resolveChainedMarketsBatch(address[] calldata markets, bytes[][][] calldata priceUpdateData) external payable;

    function resolveChainedMarketsBatchOffRamp(
        address[] calldata markets,
        bytes[][][] calldata priceUpdateData,
        address collateral,
        bool toEth
    ) external payable;

    function resolveChainedMarketManually(address _market, int64[] calldata _finalPrices) external;

    function resolveChainedMarketManuallyBatch(address[] calldata markets, int64[][] calldata finalPrices) external;
}

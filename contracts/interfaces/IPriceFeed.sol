pragma solidity >=0.4.24;

interface IPriceFeed {
    // Mutative functions
    function addAggregator(bytes32 currencyKey, address aggregatorAddress) external;

    function removeAggregator(bytes32 currencyKey) external;

    // Views
    function aggregators(bytes32 currencyKey) external view returns (address);

    function rateForCurrency(bytes32 currencyKey) external view returns (uint);

    function getRates() external view returns (uint[] memory);

    function getCurrencies() external view returns (bytes32[] memory);
}

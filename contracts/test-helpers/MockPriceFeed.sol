// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Contracts
import "../utils/Owned.sol";

// Inheritance
import "../interfaces/IPriceFeed.sol";

// Libraries
import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";

// Internal references
// AggregatorInterface from Chainlink represents a decentralized pricing network for a single currency key
import "@chainlink/contracts-0.0.10/src/v0.5/interfaces/AggregatorV2V3Interface.sol";

contract MockPriceFeed is Owned, IPriceFeed {
    using SafeMath for uint;

    // Decentralized oracle networks that feed into pricing aggregators
    mapping(bytes32 => AggregatorV2V3Interface) public aggregators;
    mapping(bytes32 => uint8) public currencyKeyDecimals;

    // List of aggregator keys for convenient iteration
    bytes32[] public aggregatorKeys;

    uint public priceToReturn;
    uint public timestampToReturn;

    // ========== CONSTRUCTOR ==========
    constructor(address _owner) Owned(_owner) {}

    /* ========== MUTATIVE FUNCTIONS ========== */
    function addAggregator(bytes32 currencyKey, address aggregatorAddress) external override onlyOwner {
        AggregatorV2V3Interface aggregator = AggregatorV2V3Interface(aggregatorAddress);
        // require(aggregator.latestRound() >= 0, "Given Aggregator is invalid");
        uint8 decimals = 18;
        require(decimals <= 18, "Aggregator decimals should be lower or equal to 18");
        if (address(aggregators[currencyKey]) == address(0)) {
            aggregatorKeys.push(currencyKey);
        }
        aggregators[currencyKey] = aggregator;
        currencyKeyDecimals[currencyKey] = decimals;
        emit AggregatorAdded(currencyKey, address(aggregator));
    }

    function removeAggregator(bytes32 currencyKey) external override onlyOwner {
        address aggregator = address(aggregators[currencyKey]);
        require(aggregator != address(0), "No aggregator exists for key");
        delete aggregators[currencyKey];
        delete currencyKeyDecimals[currencyKey];

        bool wasRemoved = removeFromArray(currencyKey, aggregatorKeys);

        if (wasRemoved) {
            emit AggregatorRemoved(currencyKey, aggregator);
        }
    }

    function getRates() external view override returns (uint[] memory rates) {
        uint count = 0;
        rates = new uint[](aggregatorKeys.length);
        for (uint i = 0; i < aggregatorKeys.length; i++) {
            bytes32 currencyKey = aggregatorKeys[i];
            rates[count++] =_getRateAndUpdatedTime(currencyKey).rate;
        }
    }

    function getCurrencies() external view override returns (bytes32[] memory) {
        return aggregatorKeys;
    }

    function rateForCurrency(bytes32 currencyKey) external view override returns (uint) {
        return _getRateAndUpdatedTime(currencyKey).rate;
    }

    function rateAndUpdatedTime(bytes32 currencyKey) external view override returns (uint rate, uint time) {
        RateAndUpdatedTime memory rateAndTime = _getRateAndUpdatedTime(currencyKey);
        return (rateAndTime.rate, rateAndTime.time);
    }

    function removeFromArray(bytes32 entry, bytes32[] storage array) internal returns (bool) {
        for (uint i = 0; i < array.length; i++) {
            if (array[i] == entry) {
                delete array[i];
                array[i] = array[array.length - 1];
                return true;
            }
        }
        return false;
    }

    function _formatAggregatorAnswer(bytes32 currencyKey, int256 rate) internal view returns (uint) {
        require(rate >= 0, "Negative rate not supported");
        if (currencyKeyDecimals[currencyKey] > 0) {
            uint multiplier = 10**uint(SafeMath.sub(18, currencyKeyDecimals[currencyKey]));
            return uint(uint(rate).mul(multiplier));
        }
        return uint(rate);
    }

    function _getRateAndUpdatedTime(bytes32 currencyKey) internal view returns (RateAndUpdatedTime memory) {
        return
            RateAndUpdatedTime({rate:  uint216(_formatAggregatorAnswer(currencyKey, int256(priceToReturn))), time: uint40(timestampToReturn)});
        
    }

    function setPricetoReturn(uint priceToSet) external {
        priceToReturn = priceToSet;
    }

    function setTimestamptoReturn(uint timestampToSet) external {
        timestampToReturn = timestampToSet;
    }

    /* ========== EVENTS ========== */
    event AggregatorAdded(bytes32 currencyKey, address aggregator);
    event AggregatorRemoved(bytes32 currencyKey, address aggregator);
}

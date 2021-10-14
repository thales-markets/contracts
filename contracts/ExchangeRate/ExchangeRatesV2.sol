pragma solidity ^0.5.16;

// Contracts
import "synthetix-2.43.1/contracts/Owned.sol";

// Inheritance
import "../interfaces/IExchangeRates.sol";

// Libraries
import "synthetix-2.43.1/contracts/SafeDecimalMath.sol";

// Internal references
// AggregatorInterface from Chainlink represents a decentralized pricing network for a single currency key
import "@chainlink/contracts-0.0.10/src/v0.5/interfaces/AggregatorV2V3Interface.sol";

// https://docs.synthetix.io/contracts/source/contracts/exchangerates
contract ExchangeRatesV2 is Owned, IExchangeRates {
    using SafeMath for uint;
    using SafeDecimalMath for uint;

    // Exchange rates and update times stored by currency code, e.g. 'SNX', or 'sUSD'
    mapping(bytes32 => mapping(uint => RateAndUpdatedTime)) private _rates;

    // Decentralized oracle networks that feed into pricing aggregators
    mapping(bytes32 => AggregatorV2V3Interface) public aggregators;
    mapping(bytes32 => uint8) public currencyKeyDecimals;

    // List of aggregator keys for convenient iteration
    bytes32[] public aggregatorKeys;

    mapping(bytes32 => InversePricing) public inversePricing;
    bytes32[] public invertedKeys;

    mapping(bytes32 => uint) public currentRoundForRate;
    mapping(bytes32 => uint) public roundFrozen;

    uint private constant FUTURE_LIMIT = 10 minutes;

    // ========== CONSTRUCTOR ==========
    constructor(address _owner) public Owned(_owner) {
        // The sUSD rate is always 1 and is never stale.
        _setRate("sUSD", SafeDecimalMath.unit(), now);

        //internalUpdateRates(_currencyKeys, _newRates, now);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */
    function updateRates(
        bytes32[] calldata currencyKeys,
        uint[] calldata newRates,
        uint timeSent
    ) external onlyOwner returns (bool) {
        return internalUpdateRates(currencyKeys, newRates, timeSent);
    }

    function addAggregator(bytes32 currencyKey, address aggregatorAddress) external onlyOwner {
        AggregatorV2V3Interface aggregator = AggregatorV2V3Interface(aggregatorAddress);
        require(aggregator.latestRound() >= 0, "Given Aggregator is invalid");
        uint8 decimals = aggregator.decimals();
        require(decimals <= 18, "Aggregator decimals should be lower or equal to 18");
        if (address(aggregators[currencyKey]) == address(0)) {
            aggregatorKeys.push(currencyKey);
        }
        aggregators[currencyKey] = aggregator;
        currencyKeyDecimals[currencyKey] = decimals;
        emit AggregatorAdded(currencyKey, address(aggregator));
    }

    function removeAggregator(bytes32 currencyKey) external onlyOwner {
        address aggregator = address(aggregators[currencyKey]);
        require(aggregator != address(0), "No aggregator exists for key");
        delete aggregators[currencyKey];
        delete currencyKeyDecimals[currencyKey];

        bool wasRemoved = removeFromArray(currencyKey, aggregatorKeys);

        if (wasRemoved) {
            emit AggregatorRemoved(currencyKey, aggregator);
        }
    }

    function setInversePricing(
        bytes32 currencyKey,
        uint entryPoint,
        uint upperLimit,
        uint lowerLimit,
        bool freezeAtUpperLimit,
        bool freezeAtLowerLimit
    ) external onlyOwner {
        // 0 < lowerLimit < entryPoint => 0 < entryPoint
        require(lowerLimit > 0, "lowerLimit must be above 0");
        require(upperLimit > entryPoint, "upperLimit must be above the entryPoint");
        require(upperLimit < entryPoint.mul(2), "upperLimit must be less than double entryPoint");
        require(lowerLimit < entryPoint, "lowerLimit must be below the entryPoint");

        require(!(freezeAtUpperLimit && freezeAtLowerLimit), "Cannot freeze at both limits");

        InversePricing storage inverse = inversePricing[currencyKey];
        if (inverse.entryPoint == 0) {
            // then we are adding a new inverse pricing, so add this
            invertedKeys.push(currencyKey);
        }
        inverse.entryPoint = entryPoint;
        inverse.upperLimit = upperLimit;
        inverse.lowerLimit = lowerLimit;

        if (freezeAtUpperLimit || freezeAtLowerLimit) {
            // When indicating to freeze, we need to know the rate to freeze it at - either upper or lower
            // this is useful in situations where ExchangeRates is updated and there are existing inverted
            // rates already frozen in the current contract that need persisting across the upgrade

            inverse.frozenAtUpperLimit = freezeAtUpperLimit;
            inverse.frozenAtLowerLimit = freezeAtLowerLimit;
            uint roundId = _getCurrentRoundId(currencyKey);
            roundFrozen[currencyKey] = roundId;
            emit InversePriceFrozen(currencyKey, freezeAtUpperLimit ? upperLimit : lowerLimit, roundId, msg.sender);
        } else {
            // unfreeze if need be
            inverse.frozenAtUpperLimit = false;
            inverse.frozenAtLowerLimit = false;
            // remove any tracking
            roundFrozen[currencyKey] = 0;
        }

        // SIP-78
        uint rate = _getRate(currencyKey);
        if (rate > 0) {
            //exchanger().setLastExchangeRateForSynth(currencyKey, rate);
        }

        emit InversePriceConfigured(currencyKey, entryPoint, upperLimit, lowerLimit);
    }

    function removeInversePricing(bytes32 currencyKey) external onlyOwner {
        require(inversePricing[currencyKey].entryPoint > 0, "No inverted price exists");

        delete inversePricing[currencyKey];

        // now remove inverted key from array
        bool wasRemoved = removeFromArray(currencyKey, invertedKeys);

        if (wasRemoved) {
            emit InversePriceConfigured(currencyKey, 0, 0, 0);
        }
    }

    function _setRate(
        bytes32 currencyKey,
        uint256 rate,
        uint256 time
    ) internal {
        // Note: this will effectively start the rounds at 1, which matches Chainlink's Agggregators
        currentRoundForRate[currencyKey]++;

        _rates[currencyKey][currentRoundForRate[currencyKey]] = RateAndUpdatedTime({
            rate: uint216(rate),
            time: uint40(time)
        });
    }

    function internalUpdateRates(
        bytes32[] memory currencyKeys,
        uint[] memory newRates,
        uint timeSent
    ) internal returns (bool) {
        require(currencyKeys.length == newRates.length, "Currency key array length must match rates array length.");
        require(timeSent < (now + FUTURE_LIMIT), "Time is too far into the future");

        // Loop through each key and perform update.
        for (uint i = 0; i < currencyKeys.length; i++) {
            bytes32 currencyKey = currencyKeys[i];

            // Should not set any rate to zero ever, as no asset will ever be
            // truely worthless and still valid. In this scenario, we should
            // delete the rate and remove it from the system.
            require(newRates[i] != 0, "Zero is not a valid rate, please call deleteRate instead.");
            require(currencyKey != "sUSD", "Rate of sUSD cannot be updated, it's always UNIT.");

            // We should only update the rate if it's at least the same age as the last rate we've got.
            if (timeSent < _getUpdatedTime(currencyKey)) {
                continue;
            }

            // Ok, go ahead with the update.
            _setRate(currencyKey, newRates[i], timeSent);
        }

        emit RatesUpdated(currencyKeys, newRates);

        return true;
    }

    function rateAndUpdatedTime(bytes32 currencyKey) external view returns (uint rate, uint time) {
        RateAndUpdatedTime memory rateAndTime = _getRateAndUpdatedTime(currencyKey);
        return (rateAndTime.rate, rateAndTime.time);
    }

    function lastRateUpdateTimes(bytes32 currencyKey) external view returns (uint256) {
        return _getUpdatedTime(currencyKey);
    }

    function rateForCurrency(bytes32 currencyKey) external view returns (uint) {
        return _getRateAndUpdatedTime(currencyKey).rate;
    }

    function _getRate(bytes32 currencyKey) internal view returns (uint256) {
        return _getRateAndUpdatedTime(currencyKey).rate;
    }

    function removeFromArray(bytes32 entry, bytes32[] storage array) internal returns (bool) {
        for (uint i = 0; i < array.length; i++) {
            if (array[i] == entry) {
                delete array[i];
                array[i] = array[array.length - 1];
                array.length--;
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

    function _getCurrentRoundId(bytes32 currencyKey) internal view returns (uint) {
        AggregatorV2V3Interface aggregator = aggregators[currencyKey];

        if (aggregator != AggregatorV2V3Interface(0)) {
            return aggregator.latestRound();
        } else {
            return currentRoundForRate[currencyKey];
        }
    }

    function _getRateAndUpdatedTime(bytes32 currencyKey) internal view returns (RateAndUpdatedTime memory) {
        AggregatorV2V3Interface aggregator = aggregators[currencyKey];
        //require(aggregator != AggregatorV2V3Interface(0), "No aggregator exists for key");

        // bytes memory payload = abi.encodeWithSignature("latestRoundData()");
        // (bool success, bytes memory returnData) = address(aggregator).staticcall(payload);

        // if (success) {
        //     (, int256 answer, , uint256 updatedAt, ) = abi.decode(returnData, (uint80, int256, uint256, uint256, uint80));
        //     return
        //         RateAndUpdatedTime({rate: uint216(_formatAggregatorAnswer(currencyKey, answer)), time: uint40(updatedAt)});
        // }

        if (aggregator != AggregatorV2V3Interface(0)) {
            // this view from the aggregator is the most gas efficient but it can throw when there's no data,
            // so let's call it low-level to suppress any reverts
            bytes memory payload = abi.encodeWithSignature("latestRoundData()");
            // solhint-disable avoid-low-level-calls
            (bool success, bytes memory returnData) = address(aggregator).staticcall(payload);

            if (success) {
                (uint80 roundId, int256 answer, , uint256 updatedAt, ) =
                    abi.decode(returnData, (uint80, int256, uint256, uint256, uint80));
                return
                    RateAndUpdatedTime({
                        rate: uint216(_rateOrInverted(currencyKey, _formatAggregatorAnswer(currencyKey, answer), roundId)),
                        time: uint40(updatedAt)
                    });
            }
        } else {
            uint roundId = currentRoundForRate[currencyKey];
            RateAndUpdatedTime memory entry = _rates[currencyKey][roundId];

            return RateAndUpdatedTime({rate: uint216(_rateOrInverted(currencyKey, entry.rate, roundId)), time: entry.time});
        }
    }

    function _rateOrInverted(
        bytes32 currencyKey,
        uint rate,
        uint roundId
    ) internal view returns (uint newRate) {
        // if an inverse mapping exists, adjust the price accordingly
        InversePricing memory inverse = inversePricing[currencyKey];
        if (inverse.entryPoint == 0 || rate == 0) {
            // when no inverse is set or when given a 0 rate, return the rate, regardless of the inverse status
            // (the latter is so when a new inverse is set but the underlying has no rate, it will return 0 as
            // the rate, not the lowerLimit)
            return rate;
        }

        newRate = rate;

        // Determine when round was frozen (if any)
        uint roundWhenRateFrozen = roundFrozen[currencyKey];
        // And if we're looking at a rate after frozen, and it's currently frozen, then apply the bounds limit even
        // if the current price is back within bounds
        if (roundId >= roundWhenRateFrozen && inverse.frozenAtUpperLimit) {
            newRate = inverse.upperLimit;
        } else if (roundId >= roundWhenRateFrozen && inverse.frozenAtLowerLimit) {
            newRate = inverse.lowerLimit;
        } else {
            // this ensures any rate outside the limit will never be returned
            uint doubleEntryPoint = inverse.entryPoint.mul(2);
            if (doubleEntryPoint <= rate) {
                // avoid negative numbers for unsigned ints, so set this to 0
                // which by the requirement that lowerLimit be > 0 will
                // cause this to freeze the price to the lowerLimit
                newRate = 0;
            } else {
                newRate = doubleEntryPoint.sub(rate);
            }

            // now ensure the rate is between the bounds
            if (newRate >= inverse.upperLimit) {
                newRate = inverse.upperLimit;
            } else if (newRate <= inverse.lowerLimit) {
                newRate = inverse.lowerLimit;
            }
        }
    }

    function _getUpdatedTime(bytes32 currencyKey) internal view returns (uint256) {
        return _getRateAndUpdatedTime(currencyKey).time;
    }

    /* ========== EVENTS ========== */
    event AggregatorAdded(bytes32 currencyKey, address aggregator);
    event AggregatorRemoved(bytes32 currencyKey, address aggregator);
    event InversePriceConfigured(bytes32 currencyKey, uint entryPoint, uint upperLimit, uint lowerLimit);
    event InversePriceFrozen(bytes32 currencyKey, uint rate, uint roundId, address initiator);
    event RatesUpdated(bytes32[] currencyKeys, uint[] newRates);
}

// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <=0.7.6;

// Inheritance
import "../utils/proxy/ProxyOwned.sol";
import "./TwapGetter.sol";

// Libraries
import "@openzeppelin/upgrades-core/contracts/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

// Internal references
// AggregatorInterface from Chainlink represents a decentralized pricing network for a single currency key
import "@chainlink/contracts-0.0.10/src/v0.5/interfaces/AggregatorV2V3Interface.sol";

contract PriceFeed is Initializable, ProxyOwned, TwapGetter {
    using SafeMath for uint;

    // Decentralized oracle networks that feed into pricing aggregators
    mapping(bytes32 => AggregatorV2V3Interface) public aggregators;

    mapping(bytes32 => uint8) public currencyKeyDecimals;

    bytes32[] public aggregatorKeys;

    // List of currency keys for convenient iteration
    bytes32[] public currencyKeys;
    mapping(bytes32 => IUniswapV3Pool) public pools;

    struct RateAndUpdatedTime {
        uint216 rate;
        uint40 time;
    }

    function initialize(address _owner) public initializer {
        setOwner(_owner);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */
    function addAggregator(bytes32 currencyKey, address aggregatorAddress) external onlyOwner {
        AggregatorV2V3Interface aggregator = AggregatorV2V3Interface(aggregatorAddress);
        require(aggregator.latestRound() >= 0, "Given Aggregator is invalid");
        uint8 decimals = aggregator.decimals();
        require(decimals <= 18, "Aggregator decimals should be lower or equal to 18");
        if (address(aggregators[currencyKey]) == address(0)) {
            currencyKeys.push(currencyKey);
        }
        aggregators[currencyKey] = aggregator;
        currencyKeyDecimals[currencyKey] = decimals;
        emit AggregatorAdded(currencyKey, address(aggregator));
    }

    function addPool(bytes32 currencyKey, address poolAddress) external onlyOwner {
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
        (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();
        require(sqrtPriceX96 > 0, "Given Pool is invalid");
        if (address(pools[currencyKey]) == address(0)) {
            currencyKeys.push(currencyKey);
        }
        pools[currencyKey] = pool;
        emit PoolAdded(currencyKey, address(pool));
    }

    function removeAggregator(bytes32 currencyKey) external onlyOwner {
        address aggregator = address(aggregators[currencyKey]);
        require(aggregator != address(0), "No aggregator exists for key");
        delete aggregators[currencyKey];
        delete currencyKeyDecimals[currencyKey];

        bool wasRemoved = removeFromArray(currencyKey, currencyKeys);

        if (wasRemoved) {
            emit AggregatorRemoved(currencyKey, aggregator);
        }
    }

    function removePool(bytes32 currencyKey) external onlyOwner {
        address pool = address(pools[currencyKey]);
        require(pool != address(0), "No pool exists for key");
        delete pools[currencyKey];

        bool wasRemoved = removeFromArray(currencyKey, currencyKeys);
        if (wasRemoved) {
            emit PoolRemoved(currencyKey, pool);
        }
    }

    function getRates() external view returns (uint[] memory rates) {
        uint count = 0;
        rates = new uint[](currencyKeys.length );
        for (uint i = 0; i < currencyKeys.length; i++) {
            bytes32 currencyKey = currencyKeys[i];
            rates[count++] = _getRateAndUpdatedTime(currencyKey).rate;
        }
    }

    function getCurrencies() external view returns (bytes32[] memory) {
        return currencyKeys;
    }

    function rateForCurrency(bytes32 currencyKey) external view returns (uint) {
        return _getRateAndUpdatedTime(currencyKey).rate;
    }

    function rateAndUpdatedTime(bytes32 currencyKey) external view returns (uint rate, uint time) {
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

    function _formatAnswer(bytes32 currencyKey, int256 rate) internal view returns (uint) {
        require(rate >= 0, "Negative rate not supported");
        if (currencyKeyDecimals[currencyKey] > 0) {
            uint multiplier = 10**uint(SafeMath.sub(18, currencyKeyDecimals[currencyKey]));
            return uint(uint(rate).mul(multiplier));
        }
        return uint(rate);
    }

    function _getRateAndUpdatedTime(bytes32 currencyKey) internal view returns (RateAndUpdatedTime memory) {
        AggregatorV2V3Interface aggregator = aggregators[currencyKey];
        IUniswapV3Pool pool = pools[currencyKey];
        require(address(aggregator) != address(0) && address(pool) != address(0), "No aggregator or pool exists for key");

        if (aggregator != AggregatorV2V3Interface(0)) {
            // this view from the aggregator is the most gas efficient but it can throw when there's no data,
            // so let's call it low-level to suppress any reverts
            bytes memory payload = abi.encodeWithSignature("latestRoundData()");
            // solhint-disable avoid-low-level-calls
            (bool success, bytes memory returnData) = address(aggregator).staticcall(payload);

            if (success) {
                (, int256 answer, , uint256 updatedAt, ) = abi.decode(
                    returnData,
                    (uint80, int256, uint256, uint256, uint80)
                );
                return RateAndUpdatedTime({rate: uint216(_formatAnswer(currencyKey, answer)), time: uint40(updatedAt)});
            }
        } else {
            uint256 answer = getPriceX96FromSqrtPriceX96(getSqrtTwapX96(address(pool), 300));
            return RateAndUpdatedTime({rate: uint216(answer), time: uint40(block.timestamp)});
        }
    }

    /* ========== EVENTS ========== */
    event AggregatorAdded(bytes32 currencyKey, address aggregator);
    event AggregatorRemoved(bytes32 currencyKey, address aggregator);
    event PoolAdded(bytes32 currencyKey, address pool);
    event PoolRemoved(bytes32 currencyKey, address pool);
}

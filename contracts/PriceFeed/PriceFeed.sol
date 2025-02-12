// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// Inheritance
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/libraries/UniswapMath.sol";

// Libraries
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";

// Internal references
// AggregatorInterface from Chainlink represents a decentralized pricing network for a single currency key
import "@chainlink/contracts-0.0.10/src/v0.5/interfaces/AggregatorV2V3Interface.sol";

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

contract PriceFeed is Initializable, ProxyOwned {
    using SafeMath for uint;

    // Decentralized oracle networks that feed into pricing aggregators
    mapping(bytes32 => AggregatorV2V3Interface) public aggregators;

    mapping(bytes32 => uint8) public currencyKeyDecimals;

    bytes32[] public aggregatorKeys;

    // List of currency keys for convenient iteration
    bytes32[] public currencyKeys;
    mapping(bytes32 => IUniswapV3Pool) public pools;

    int56 public twapInterval;

    struct RateAndUpdatedTime {
        uint216 rate;
        uint40 time;
    }

    address public _ETH;
    address public _wETH;

    mapping(bytes32 => bool) public useLastTickForTWAP;

    mapping(bytes32 => RateAndUpdatedTime) public staticPricePerAsset;

    mapping(address => bool) public whitelistedAddresses;

    uint public constant ONE = 1e18;

    uint public allowedRateUpdatePercentage;

    uint public rateUpdateInterval;

    function initialize(address _owner) external initializer {
        setOwner(_owner);
        twapInterval = 300;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @notice Add a new aggregator for a given currency.
     * @dev Only the contract owner can call this function. The aggregator must have a valid latestRound and its decimals should be <= 18.
     * @param currencyKey The key identifying the currency.
     * @param aggregatorAddress The address of the Chainlink aggregator.
     */
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

    /**
     * @notice Add a new Uniswap V3 pool for a specified currency.
     * @dev Only the contract owner can call this function. Ensures that the pool exists and that one token is either ETH or wETH.
     * @param currencyKey The identifier for the currency.
     * @param currencyAddress The address of the currency token.
     * @param poolAddress The address of the Uniswap V3 pool.
     */
    function addPool(
        bytes32 currencyKey,
        address currencyAddress,
        address poolAddress
    ) external onlyOwner {
        // Check if an aggregator exists for the given currency key.
        AggregatorV2V3Interface aggregator = aggregators[currencyKey];
        require(address(aggregator) == address(0), "Aggregator already exists for key");

        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
        address token0 = pool.token0();
        address token1 = pool.token1();
        bool token0valid = token0 == _wETH || token0 == _ETH;
        bool token1valid = token1 == _wETH || token1 == _ETH;

        // Check if one of the tokens is wETH or ETH.
        require(token0valid || token1valid, "Pool not valid: ETH is not an asset");
        // Check if the currency token is part of the pool.
        require(currencyAddress == token0 || currencyAddress == token1, "Pool not valid: currency is not an asset");
        (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();
        require(sqrtPriceX96 > 0, "Pool not valid");
        if (address(pools[currencyKey]) == address(0)) {
            currencyKeys.push(currencyKey);
        }
        pools[currencyKey] = pool;
        currencyKeyDecimals[currencyKey] = 18;
        emit PoolAdded(currencyKey, address(pool));
    }

    /**
     * @notice Remove an aggregator associated with a currency.
     * @dev Only the owner can remove an aggregator. Also removes the currency key from the list if present.
     * @param currencyKey The key identifying the currency.
     */
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

    /**
     * @notice Remove a pool associated with a currency.
     * @dev Only the owner can remove a pool. Also removes the currency key from the list if present.
     * @param currencyKey The key identifying the currency.
     */
    function removePool(bytes32 currencyKey) external onlyOwner {
        address pool = address(pools[currencyKey]);
        require(pool != address(0), "No pool exists for key");
        delete pools[currencyKey];

        bool wasRemoved = removeFromArray(currencyKey, currencyKeys);
        if (wasRemoved) {
            emit PoolRemoved(currencyKey, pool);
        }
    }

    /**
     * @notice Retrieve the array of rates for all registered currency keys.
     * @return rates An array containing the rate for each currency.
     */
    function getRates() external view returns (uint[] memory rates) {
        uint count = 0;
        rates = new uint[](currencyKeys.length);
        for (uint i = 0; i < currencyKeys.length; i++) {
            bytes32 currencyKey = currencyKeys[i];
            rates[count++] = _getRateAndUpdatedTime(currencyKey).rate;
        }
    }

    /**
     * @notice Retrieve the list of all registered currency keys.
     * @return An array of currency keys.
     */
    function getCurrencies() external view returns (bytes32[] memory) {
        return currencyKeys;
    }

    /**
     * @notice Get the current rate for a specific currency.
     * @param currencyKey The identifier of the currency.
     * @return The current rate.
     */
    function rateForCurrency(bytes32 currencyKey) external view returns (uint) {
        return _getRateAndUpdatedTime(currencyKey).rate;
    }

    /**
     * @notice Retrieve both the rate and the timestamp of the last update for a given currency.
     * @param currencyKey The identifier of the currency.
     * @return rate The current rate for the currency.
     * @return time The timestamp when the rate was last updated.
     */
    function rateAndUpdatedTime(bytes32 currencyKey) external view returns (uint rate, uint time) {
        RateAndUpdatedTime memory rateAndTime = _getRateAndUpdatedTime(currencyKey);
        return (rateAndTime.rate, rateAndTime.time);
    }

    /**
     * @notice Set the TWAP (Time-Weighted Average Price) calculation interval.
     * @dev Only the owner can update the interval.
     * @param _twapInterval The new TWAP interval in seconds.
     */
    function setTwapInterval(int56 _twapInterval) external onlyOwner {
        twapInterval = _twapInterval;
        emit TwapIntervalChanged(_twapInterval);
    }

    /**
     * @notice Toggle the use of the last tick for TWAP calculation for a specified currency.
     * @dev Only the owner can call this function.
     * @param _currencyKey The identifier of the currency.
     */
    function setLastTickForTWAP(bytes32 _currencyKey) external onlyOwner {
        useLastTickForTWAP[_currencyKey] = !useLastTickForTWAP[_currencyKey];
        emit LastTickForTWAPChanged(_currencyKey);
    }

    /**
     * @notice Set the address for the wrapped ETH (wETH) token.
     * @dev Only the owner can update the wETH token address.
     * @param token The address of the wETH token.
     */
    function setWETH(address token) external onlyOwner {
        _wETH = token;
        emit AddressChangedwETH(token);
    }

    /**
     * @notice Set the address for the ETH token.
     * @dev Only the owner can update the ETH token address.
     * @param token The address of the ETH token.
     */
    function setETH(address token) external onlyOwner {
        _ETH = token;
        emit AddressChangedETH(token);
    }

    /**
     * @notice Set a static price for a given asset.
     * @dev Only the owner can call this function. If the currency key does not exist in the list, it will be added.
     * @param currencyKey The identifier of the asset.
     * @param rate The static price to be set.
     */
    function setStaticPricePerAsset(bytes32 currencyKey, uint216 rate) external onlyOwner {
        bool hasCurrencyKey = false;
        for (uint i = 0; i < currencyKeys.length; i++) {
            if (currencyKeys[i] == currencyKey) {
                hasCurrencyKey = true;
                break;
            }
        }
        if (!hasCurrencyKey) {
            currencyKeys.push(currencyKey);
        }
        _updateStaticPricePerAsset(currencyKey, rate);
    }

    /**
     * @notice Update the static price for a given asset.
     * @dev The caller must be whitelisted or the owner. Updates are allowed only if at least one day has passed since the last update and the new rate does not exceed the permitted increase.
     * @param currencyKey The identifier of the asset.
     * @param rate The new static price.
     */
    function updateStaticPricePerAsset(bytes32 currencyKey, uint216 rate) external {
        require(whitelistedAddresses[msg.sender] || msg.sender == owner, "Only whitelisted can set static price");
        uint40 currentUpdateTime = staticPricePerAsset[currencyKey].time;
        uint216 currentRate = staticPricePerAsset[currencyKey].rate;
        require(uint40(block.timestamp) - currentUpdateTime > rateUpdateInterval, "Rate update too frequent");
        require(
            currentRate > 0 &&
                ((rate > currentRate && rate < ((currentRate * (ONE + allowedRateUpdatePercentage)) / ONE)) ||
                    (rate < currentRate && rate > ((currentRate * (ONE - allowedRateUpdatePercentage)) / ONE))),
            "Rate update too high"
        );
        _updateStaticPricePerAsset(currencyKey, rate);
    }

    /**
     * @notice Set the list of whitelisted addresses.
     * @dev Only the owner can call this function.
     * @param _whitelistedAddresses The list of addresses to be whitelisted.
     * @param _areWhitelisted Whether the addresses should be whitelisted or not.
     */
    function setWhitelistedAddresses(address[] memory _whitelistedAddresses, bool _areWhitelisted) external onlyOwner {
        for (uint i = 0; i < _whitelistedAddresses.length; i++) {
            whitelistedAddresses[_whitelistedAddresses[i]] = _areWhitelisted;
        }
    }

    function setRateUpdateIntervalAndAllowedRateUpdatePercentage(uint _rateUpdateInterval, uint _allowedRateUpdatePercentage)
        external
        onlyOwner
    {
        rateUpdateInterval = _rateUpdateInterval;
        allowedRateUpdatePercentage = _allowedRateUpdatePercentage;
    }

    /**
     * @notice Transfer aggregator keys to the main currency keys array.
     * @dev Only the owner can invoke this function and it only works if the currencyKeys array is empty.
     */
    function transferCurrencyKeys() external onlyOwner {
        require(currencyKeys.length == 0, "Currency keys is not empty");
        for (uint i = 0; i < aggregatorKeys.length; i++) {
            currencyKeys[i] = aggregatorKeys[i];
        }
    }

    // ====================================================
    // =========== INTERNAL FUNCTIONS & EVENTS ==========
    // ====================================================

    function removeFromArray(bytes32 entry, bytes32[] storage array) internal returns (bool) {
        for (uint i = 0; i < array.length; i++) {
            if (array[i] == entry) {
                delete array[i];
                array[i] = array[array.length - 1];
                array.pop();
                return true;
            }
        }
        return false;
    }

    function _updateStaticPricePerAsset(bytes32 currencyKey, uint216 rate) internal {
        staticPricePerAsset[currencyKey] = RateAndUpdatedTime({rate: rate, time: uint40(block.timestamp)});
        emit SetStaticPricePerAsset(currencyKey, rate, block.timestamp);
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
        if (staticPricePerAsset[currencyKey].rate > 0) {
            return staticPricePerAsset[currencyKey];
        }

        AggregatorV2V3Interface aggregator = aggregators[currencyKey];
        IUniswapV3Pool pool = pools[currencyKey];
        require(address(aggregator) != address(0) || address(pool) != address(0), "No aggregator or pool exists for key");

        if (aggregator != AggregatorV2V3Interface(address(0))) {
            return _getAggregatorRate(address(aggregator), currencyKey);
        } else {
            require(address(aggregators["ETH"]) != address(0), "Price for ETH does not exist");
            uint256 ratio = _getPriceFromSqrtPrice(_getTwap(address(pool), currencyKey));
            uint256 ethPrice = _getAggregatorRate(address(aggregators["ETH"]), "ETH").rate * 10**18;
            address token0 = pool.token0();
            uint answer;

            if (token0 == _ETH || token0 == _wETH) {
                answer = ethPrice / ratio;
            } else {
                answer = ethPrice * ratio;
            }
            return
                RateAndUpdatedTime({
                    rate: uint216(_formatAnswer(currencyKey, int256(answer))),
                    time: uint40(block.timestamp)
                });
        }
    }

    function _getAggregatorRate(address aggregator, bytes32 currencyKey) internal view returns (RateAndUpdatedTime memory) {
        // This view from the aggregator is the most gas efficient but it can throw when there's no data,
        // so let's call it low-level to suppress reverts.
        bytes memory payload = abi.encodeWithSignature("latestRoundData()");
        // solhint-disable avoid-low-level-calls
        (bool success, bytes memory returnData) = aggregator.staticcall(payload);

        if (success) {
            (, int256 answer, , uint256 updatedAt, ) = abi.decode(returnData, (uint80, int256, uint256, uint256, uint80));
            return RateAndUpdatedTime({rate: uint216(_formatAnswer(currencyKey, answer)), time: uint40(updatedAt)});
        }

        // Must return an assigned value even if the low-level call fails.
        return RateAndUpdatedTime({rate: 0, time: 0});
    }

    function _getTwap(address pool, bytes32 currencyKey) internal view returns (uint160 sqrtPriceX96) {
        if (twapInterval == 0 || useLastTickForTWAP[currencyKey]) {
            // Return the current price.
            (sqrtPriceX96, , , , , , ) = IUniswapV3Pool(pool).slot0();
        } else {
            uint32[] memory secondsAgos = new uint32[](2);
            secondsAgos[0] = uint32(uint56(twapInterval));
            secondsAgos[1] = 0; // from now

            (int56[] memory tickCumulatives, ) = IUniswapV3Pool(pool).observe(secondsAgos);
            // Convert tick (imprecise as it's an integer) to price.
            sqrtPriceX96 = UniswapMath.getSqrtRatioAtTick(int24((tickCumulatives[1] - tickCumulatives[0]) / twapInterval));
        }
    }

    function _getPriceFromSqrtPrice(uint160 sqrtPriceX96) internal pure returns (uint256 priceX96) {
        uint256 price = UniswapMath.mulDiv(sqrtPriceX96, sqrtPriceX96, UniswapMath.Q96);
        return UniswapMath.mulDiv(price, 10**18, UniswapMath.Q96);
    }

    /* ========== EVENTS ========== */
    event AggregatorAdded(bytes32 currencyKey, address aggregator);
    event AggregatorRemoved(bytes32 currencyKey, address aggregator);
    event PoolAdded(bytes32 currencyKey, address pool);
    event PoolRemoved(bytes32 currencyKey, address pool);
    event AddressChangedETH(address token);
    event AddressChangedwETH(address token);
    event LastTickForTWAPChanged(bytes32 currencyKey);
    event TwapIntervalChanged(int56 twapInterval);
    event SetStaticPricePerAsset(bytes32 currencyKey, uint216 rate, uint timestamp);
}

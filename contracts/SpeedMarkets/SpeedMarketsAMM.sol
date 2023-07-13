// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "@openzeppelin/contracts-4.4.1/proxy/Clones.sol";

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "../utils/libraries/AddressSetLib.sol";

import "./SpeedMarket.sol";

/// @title An AMM for Thales speed markets
contract SpeedMarketsAMM is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressSetLib for AddressSetLib.AddressSet;

    AddressSetLib.AddressSet internal _activeMarkets;
    AddressSetLib.AddressSet internal _maturedMarkets;

    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;

    IERC20Upgradeable public sUSD;

    address public speedMarketMastercopy;

    uint public safeBoxImpact;
    uint public lpFee;

    mapping(bytes32 => bool) public supportedAsset;

    uint public minimalTimeToMaturity;
    uint public maximalTimeToMaturity;

    uint public minBuyinAmount;
    uint public maxBuyinAmount;

    mapping(bytes32 => uint) public maxRiskPerAsset;
    mapping(bytes32 => uint) public currentRiskPerAsset;

    mapping(bytes32 => bytes32) public assetToPythId;

    //eth 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
    IPyth pyth;

    uint64 public maximumPriceDelay;

    function initialize(
        address _owner,
        IERC20Upgradeable _sUSD,
        IPyth _pyth
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        sUSD = _sUSD;
        pyth = _pyth;
    }

    function createNewMarket(
        bytes32 asset,
        uint64 strikeTime,
        SpeedMarket.Direction direction,
        uint buyinAmount,
        bytes[] calldata priceUpdateData
    ) external payable nonReentrant {
        _createNewMarket(asset, strikeTime, direction, buyinAmount, priceUpdateData);
    }

    function createNewMarketWithDelta(
        bytes32 asset,
        uint64 delta,
        SpeedMarket.Direction direction,
        uint buyinAmount,
        bytes[] calldata priceUpdateData
    ) external payable nonReentrant {
        _createNewMarket(asset, uint64(block.timestamp + delta), direction, buyinAmount, priceUpdateData);
    }

    function _createNewMarket(
        bytes32 asset,
        uint64 strikeTime,
        SpeedMarket.Direction direction,
        uint buyinAmount,
        bytes[] memory priceUpdateData
    ) internal {
        require(buyinAmount >= minBuyinAmount && buyinAmount <= maxBuyinAmount, "wrong buy in amount");
        require(
            strikeTime >= (block.timestamp + minimalTimeToMaturity),
            "time has to be in the future + minimalTimeToMaturity"
        );
        require(strikeTime <= block.timestamp + maximalTimeToMaturity, "time too far into the future");

        // PYTH SPECIFIC code
        uint fee = pyth.getUpdateFee(priceUpdateData);
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);

        PythStructs.Price memory price = pyth.getPrice(assetToPythId[asset]);

        require((price.publishTime + maximumPriceDelay) > block.timestamp, "Stale price");

        uint totalAmountToTransfer = (buyinAmount * (ONE + safeBoxImpact + lpFee)) / ONE;
        sUSD.safeTransferFrom(msg.sender, address(this), totalAmountToTransfer);

        SpeedMarket srm = SpeedMarket(Clones.clone(speedMarketMastercopy));
        srm.initialize(
            SpeedMarket.InitParams(address(this), msg.sender, asset, strikeTime, price.price, direction, buyinAmount)
        );

        sUSD.safeTransfer(address(srm), buyinAmount * 2);

        _activeMarkets.add(address(srm));

        currentRiskPerAsset[asset] += buyinAmount;
        require(currentRiskPerAsset[asset] < maxRiskPerAsset[asset], "OI cap breached");

        emit MarketCreated(address(srm), msg.sender, asset, strikeTime, price.price, direction, buyinAmount);
    }

    /// @notice resolveMarket resolves an active market
    /// @param market address of the market
    function resolveMarket(address market, bytes[] calldata priceUpdateData) external payable {
        _resolveMarket(market, priceUpdateData);
    }

    function _resolveMarket(address market, bytes[] memory priceUpdateData) internal {
        require(_activeMarkets.contains(market), "Not an active market");
        require(SpeedMarket(market).strikeTime() < block.timestamp, "Not ready to be resolved");
        require(!SpeedMarket(market).resolved(), "Already resolved");

        // PYTH SPECIFIC code
        uint fee = pyth.getUpdateFee(priceUpdateData);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = assetToPythId[SpeedMarket(market).asset()];
        PythStructs.PriceFeed[] memory prices = pyth.parsePriceFeedUpdates{value: fee}(
            priceUpdateData,
            priceIds,
            SpeedMarket(market).strikeTime(),
            SpeedMarket(market).strikeTime() + maximumPriceDelay
        );

        PythStructs.Price memory price = prices[0].price;

        SpeedMarket(market).resolve(price.price);
        _activeMarkets.remove(market);
        _maturedMarkets.add(market);

        if (!SpeedMarket(market).isUserWinner()) {
            if (currentRiskPerAsset[SpeedMarket(market).asset()] > SpeedMarket(market).buyinAmount()) {
                currentRiskPerAsset[SpeedMarket(market).asset()] -= (SpeedMarket(market).buyinAmount());
            } else {
                currentRiskPerAsset[SpeedMarket(market).asset()] = 0;
            }
        }
    }

    function resolveMarketsBatch(address[] calldata markets, bytes[] calldata priceUpdateData) external payable {
        for (uint i = 0; i < markets.length; i++) {
            address market = markets[i];
            if (canResolveMarket(market)) {
                bytes[] memory subarray = new bytes[](1);
                subarray[0] = priceUpdateData[i];
                _resolveMarket(market, subarray);
            }
        }
    }

    //////////// getters for active and matured markets/////////////////

    /// @notice isKnownMarket checks if market is among matured or active markets
    /// @param candidate Address of the market.
    /// @return bool
    function isKnownMarket(address candidate) public view returns (bool) {
        return _activeMarkets.contains(candidate) || _maturedMarkets.contains(candidate);
    }

    /// @notice isActiveMarket checks if market is active market
    /// @param candidate Address of the market.
    /// @return bool
    function isActiveMarket(address candidate) public view returns (bool) {
        return _activeMarkets.contains(candidate);
    }

    /// @notice numActiveMarkets returns number of active markets
    /// @return uint
    function numActiveMarkets() external view returns (uint) {
        return _activeMarkets.elements.length;
    }

    /// @notice activeMarkets returns list of active markets
    /// @param index index of the page
    /// @param pageSize number of addresses per page
    /// @return address[] active market list
    function activeMarkets(uint index, uint pageSize) external view returns (address[] memory) {
        return _activeMarkets.getPage(index, pageSize);
    }

    /// @notice numMaturedMarkets returns number of mature markets
    /// @return uint
    function numMaturedMarkets() external view returns (uint) {
        return _maturedMarkets.elements.length;
    }

    /// @notice maturedMarkets returns list of matured markets
    /// @param index index of the page
    /// @param pageSize number of addresses per page
    /// @return address[] matured market list
    function maturedMarkets(uint index, uint pageSize) external view returns (address[] memory) {
        return _maturedMarkets.getPage(index, pageSize);
    }

    function canResolveMarket(address market) public view returns (bool) {
        return
            _activeMarkets.contains(market) &&
            (SpeedMarket(market).strikeTime() < block.timestamp) &&
            !SpeedMarket(market).resolved();
    }

    //////////////////setters/////////////////

    /// @notice Set mastercopy to use to create markets
    /// @param _mastercopy to use to create markets
    function setMastercopy(address _mastercopy) external onlyOwner {
        speedMarketMastercopy = _mastercopy;
        emit MastercopyChanged(_mastercopy);
    }

    /// @notice Set minimum and maximum buyin amounts
    function setAmounts(uint _minBuyinAmount, uint _maxBuyinAmount) external onlyOwner {
        minBuyinAmount = _minBuyinAmount;
        maxBuyinAmount = _maxBuyinAmount;
        emit AmountsChanged(_minBuyinAmount, _maxBuyinAmount);
    }

    /// @notice Set minimum and maximum time to maturity
    function setTimes(uint _minimalTimeToMaturity, uint _maximalTimeToMaturity) external onlyOwner {
        minimalTimeToMaturity = _minimalTimeToMaturity;
        maximalTimeToMaturity = _maximalTimeToMaturity;
        emit TimesChanged(_minimalTimeToMaturity, _maximalTimeToMaturity);
    }

    function setAssetToPythID(bytes32 asset, bytes32 pythId) external onlyOwner {
        assetToPythId[asset] = pythId;
        emit SetAssetToPythID(asset, pythId);
    }

    function setMaximumPriceDelay(uint64 _maximumPriceDelay) external onlyOwner {
        maximumPriceDelay = _maximumPriceDelay;
        emit SetMaximumPriceDelay(maximumPriceDelay);
    }

    function setMaxRiskPerAsset(bytes32 asset, uint _maxRiskPerAsset) external onlyOwner {
        maxRiskPerAsset[asset] = _maxRiskPerAsset;
        emit SetMaxRiskPerAsset(asset, _maxRiskPerAsset);
    }

    //////////////////events/////////////////

    event MarketCreated(
        address market,
        address user,
        bytes32 asset,
        uint strikeTime,
        int64 strikePrice,
        SpeedMarket.Direction direction,
        uint buyinAmount
    );

    event MastercopyChanged(address mastercopy);
    event AmountsChanged(uint _minBuyinAmount, uint _maxBuyinAmount);
    event TimesChanged(uint _minimalTimeToMaturity, uint _maximalTimeToMaturity);
    event SetAssetToPythID(bytes32 asset, bytes32 pythId);
    event SetMaximumPriceDelay(uint _maximumPriceDelay);
    event SetMaxRiskPerAsset(bytes32 asset, uint _maxRiskPerAsset);
}

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

import "../interfaces/IStakingThales.sol";
import "../interfaces/IMultiCollateralOnOffRamp.sol";

import "./SpeedMarket.sol";

/// @title An AMM for Thales speed markets
contract SpeedMarketsAMM is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressSetLib for AddressSetLib.AddressSet;

    AddressSetLib.AddressSet internal _activeMarkets;
    AddressSetLib.AddressSet internal _maturedMarkets;

    uint private constant ONE = 1e18;

    IERC20Upgradeable public sUSD;

    address public speedMarketMastercopy;

    uint public safeBoxImpact;
    uint public lpFee;

    address public safeBox;

    mapping(bytes32 => bool) public supportedAsset;

    uint public minimalTimeToMaturity;
    uint public maximalTimeToMaturity;

    uint public minBuyinAmount;
    uint public maxBuyinAmount;

    mapping(bytes32 => uint) public maxRiskPerAsset;
    mapping(bytes32 => uint) public currentRiskPerAsset;

    mapping(bytes32 => bytes32) public assetToPythId;

    //eth 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
    IPyth public pyth;

    uint64 public maximumPriceDelay;

    /// @return The address of the Staking contract
    IStakingThales public stakingThales;

    mapping(address => AddressSetLib.AddressSet) internal _activeMarketsPerUser;
    mapping(address => AddressSetLib.AddressSet) internal _maturedMarketsPerUser;

    struct MarketData {
        address user;
        bytes32 asset;
        uint64 strikeTime;
        int64 strikePrice;
        SpeedMarket.Direction direction;
        uint buyinAmount;
        bool resolved;
        int64 finalPrice;
        SpeedMarket.Direction result;
        bool isUserWinner;
        uint256 createdAt;
    }

    mapping(address => bool) public whitelistedAddresses;
    IMultiCollateralOnOffRamp public multiCollateralOnOffRamp;
    bool public multicollateralEnabled;

    mapping(bytes32 => mapping(SpeedMarket.Direction => uint)) public maxRiskPerAssetAndDirection;
    mapping(bytes32 => mapping(SpeedMarket.Direction => uint)) public currentRiskPerAssetAndDirection;

    struct Risk {
        SpeedMarket.Direction direction;
        uint current;
        uint max;
    }

    uint64 public maximumPriceDelayForResolving;

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
    ) external payable nonReentrant notPaused {
        _createNewMarket(asset, strikeTime, direction, buyinAmount, priceUpdateData, true);
    }

    function createNewMarketWithDelta(
        bytes32 asset,
        uint64 delta,
        SpeedMarket.Direction direction,
        uint buyinAmount,
        bytes[] calldata priceUpdateData
    ) external payable nonReentrant notPaused {
        _createNewMarket(asset, uint64(block.timestamp + delta), direction, buyinAmount, priceUpdateData, true);
    }

    function createNewMarketWithDifferentCollateral(
        bytes32 asset,
        uint64 strikeTime,
        SpeedMarket.Direction direction,
        bytes[] calldata priceUpdateData,
        address collateral,
        uint collateralAmount,
        bool isEth
    ) external payable nonReentrant notPaused {
        require(multicollateralEnabled, "Multicollateral onramp not enabled");
        uint buyinAmount = _convertCollateral(collateral, collateralAmount, isEth);
        _createNewMarket(asset, strikeTime, direction, buyinAmount, priceUpdateData, false);
    }

    function createNewMarketWithDifferentCollateralAndDelta(
        bytes32 asset,
        uint64 delta,
        SpeedMarket.Direction direction,
        bytes[] calldata priceUpdateData,
        address collateral,
        uint collateralAmount,
        bool isEth
    ) external payable nonReentrant notPaused {
        require(multicollateralEnabled, "Multicollateral onramp not enabled");
        uint buyinAmount = _convertCollateral(collateral, collateralAmount, isEth);
        _createNewMarket(asset, uint64(block.timestamp + delta), direction, buyinAmount, priceUpdateData, false);
    }

    function _convertCollateral(
        address collateral,
        uint collateralAmount,
        bool isEth
    ) internal returns (uint buyinAmount) {
        uint convertedAmount;
        if (isEth) {
            convertedAmount = multiCollateralOnOffRamp.onrampWithEth{value: collateralAmount}(collateralAmount);
        } else {
            IERC20Upgradeable(collateral).safeTransferFrom(msg.sender, address(this), collateralAmount);
            IERC20Upgradeable(collateral).approve(address(multiCollateralOnOffRamp), collateralAmount);
            convertedAmount = multiCollateralOnOffRamp.onramp(collateral, collateralAmount);
        }
        buyinAmount = (convertedAmount * (ONE - safeBoxImpact - lpFee)) / ONE;
    }

    function _createNewMarket(
        bytes32 asset,
        uint64 strikeTime,
        SpeedMarket.Direction direction,
        uint buyinAmount,
        bytes[] memory priceUpdateData,
        bool transferSusd
    ) internal {
        require(supportedAsset[asset], "Asset is not supported");
        require(buyinAmount >= minBuyinAmount && buyinAmount <= maxBuyinAmount, "wrong buy in amount");
        require(
            strikeTime >= (block.timestamp + minimalTimeToMaturity),
            "time has to be in the future + minimalTimeToMaturity"
        );
        require(strikeTime <= block.timestamp + maximalTimeToMaturity, "time too far into the future");

        currentRiskPerAsset[asset] += buyinAmount;
        require(currentRiskPerAsset[asset] <= maxRiskPerAsset[asset], "OI cap breached");

        SpeedMarket.Direction oppositeDirection = direction == SpeedMarket.Direction.Up
            ? SpeedMarket.Direction.Down
            : SpeedMarket.Direction.Up;
        // until there is risk for opposite direction, don't modify/check risk for current direction
        if (currentRiskPerAssetAndDirection[asset][oppositeDirection] == 0) {
            currentRiskPerAssetAndDirection[asset][direction] += buyinAmount;
            require(
                currentRiskPerAssetAndDirection[asset][direction] <= maxRiskPerAssetAndDirection[asset][direction],
                "Risk per direction exceeded"
            );
        }
        // decrease risk for opposite direction
        if (currentRiskPerAssetAndDirection[asset][oppositeDirection] > buyinAmount) {
            currentRiskPerAssetAndDirection[asset][oppositeDirection] -= buyinAmount;
        } else {
            currentRiskPerAssetAndDirection[asset][oppositeDirection] = 0;
        }

        uint fee = pyth.getUpdateFee(priceUpdateData);
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);

        PythStructs.Price memory price = pyth.getPrice(assetToPythId[asset]);

        require((price.publishTime + maximumPriceDelay) > block.timestamp && price.price > 0, "Stale price");

        if (transferSusd) {
            uint totalAmountToTransfer = (buyinAmount * (ONE + safeBoxImpact + lpFee)) / ONE;
            sUSD.safeTransferFrom(msg.sender, address(this), totalAmountToTransfer);
        }
        SpeedMarket srm = SpeedMarket(Clones.clone(speedMarketMastercopy));
        srm.initialize(
            SpeedMarket.InitParams(address(this), msg.sender, asset, strikeTime, price.price, direction, buyinAmount)
        );

        sUSD.safeTransfer(address(srm), buyinAmount * 2);

        sUSD.safeTransfer(safeBox, (buyinAmount * safeBoxImpact) / ONE);

        _activeMarkets.add(address(srm));
        _activeMarketsPerUser[msg.sender].add(address(srm));

        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(msg.sender, buyinAmount);
        }

        emit MarketCreated(address(srm), msg.sender, asset, strikeTime, price.price, direction, buyinAmount);
    }

    /// @notice resolveMarket resolves an active market
    /// @param market address of the market
    function resolveMarket(address market, bytes[] calldata priceUpdateData) external payable nonReentrant notPaused {
        _resolveMarket(market, priceUpdateData);
    }

    /// @notice resolveMarkets in a batch
    function resolveMarketsBatch(address[] calldata markets, bytes[] calldata priceUpdateData)
        external
        payable
        nonReentrant
        notPaused
    {
        for (uint i = 0; i < markets.length; i++) {
            address market = markets[i];
            if (canResolveMarket(market)) {
                bytes[] memory subarray = new bytes[](1);
                subarray[0] = priceUpdateData[i];
                _resolveMarket(market, subarray);
            }
        }
    }

    function _resolveMarket(address market, bytes[] memory priceUpdateData) internal {
        require(canResolveMarket(market), "Can not resolve");

        uint fee = pyth.getUpdateFee(priceUpdateData);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = assetToPythId[SpeedMarket(market).asset()];
        PythStructs.PriceFeed[] memory prices = pyth.parsePriceFeedUpdates{value: fee}(
            priceUpdateData,
            priceIds,
            SpeedMarket(market).strikeTime(),
            SpeedMarket(market).strikeTime() + maximumPriceDelayForResolving
        );

        PythStructs.Price memory price = prices[0].price;

        require(price.price > 0, "invalid price");

        _resolveMarketWithPrice(market, price.price);
    }

    /// @notice admin resolve market for a given market address with finalPrice
    function resolveMarketManually(address _market, int64 _finalPrice) external isAddressWhitelisted {
        _resolveMarketManually(_market, _finalPrice);
    }

    /// @notice admin resolve for a given markets with finalPrices
    function resolveMarketManuallyBatch(address[] calldata markets, int64[] calldata finalPrices)
        external
        isAddressWhitelisted
    {
        for (uint i = 0; i < markets.length; i++) {
            if (canResolveMarket(markets[i])) {
                _resolveMarketManually(markets[i], finalPrices[i]);
            }
        }
    }

    function _resolveMarketManually(address _market, int64 _finalPrice) internal {
        require(canResolveMarket(_market), "Can not resolve");
        _resolveMarketWithPrice(_market, _finalPrice);
    }

    function _resolveMarketWithPrice(address market, int64 _finalPrice) internal {
        SpeedMarket(market).resolve(_finalPrice);
        _activeMarkets.remove(market);
        _maturedMarkets.add(market);
        address user = SpeedMarket(market).user();

        if (_activeMarketsPerUser[user].contains(market)) {
            _activeMarketsPerUser[user].remove(market);
        }
        _maturedMarketsPerUser[user].add(market);

        bytes32 asset = SpeedMarket(market).asset();
        uint buyinAmount = SpeedMarket(market).buyinAmount();
        SpeedMarket.Direction direction = SpeedMarket(market).direction();

        if (currentRiskPerAssetAndDirection[asset][direction] > buyinAmount) {
            currentRiskPerAssetAndDirection[asset][direction] -= buyinAmount;
        } else {
            currentRiskPerAssetAndDirection[asset][direction] = 0;
        }

        if (!SpeedMarket(market).isUserWinner()) {
            if (currentRiskPerAsset[asset] > 2 * buyinAmount) {
                currentRiskPerAsset[asset] -= (2 * buyinAmount);
            } else {
                currentRiskPerAsset[asset] = 0;
            }
        }

        emit MarketResolved(market, SpeedMarket(market).result(), SpeedMarket(market).isUserWinner());
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

    /// @notice numActiveMarkets returns number of active markets per use
    function numActiveMarketsPerUser(address user) external view returns (uint) {
        return _activeMarketsPerUser[user].elements.length;
    }

    /// @notice activeMarkets returns list of active markets per user
    function activeMarketsPerUser(
        uint index,
        uint pageSize,
        address user
    ) external view returns (address[] memory) {
        return _activeMarketsPerUser[user].getPage(index, pageSize);
    }

    /// @notice numMaturedMarkets returns number of matured markets per use
    function numMaturedMarketsPerUser(address user) external view returns (uint) {
        return _maturedMarketsPerUser[user].elements.length;
    }

    /// @notice maturedMarkets returns list of matured markets per user
    function maturedMarketsPerUser(
        uint index,
        uint pageSize,
        address user
    ) external view returns (address[] memory) {
        return _maturedMarketsPerUser[user].getPage(index, pageSize);
    }

    /// @notice whether a market can be resolved
    function canResolveMarket(address market) public view returns (bool) {
        return
            _activeMarkets.contains(market) &&
            (SpeedMarket(market).strikeTime() < block.timestamp) &&
            !SpeedMarket(market).resolved();
    }

    /// @notice return all market data for an array of markets
    function getMarketsData(address[] calldata marketsArray) external view returns (MarketData[] memory) {
        MarketData[] memory markets = new MarketData[](marketsArray.length);
        for (uint i = 0; i < marketsArray.length; i++) {
            SpeedMarket market = SpeedMarket(marketsArray[i]);
            markets[i].user = market.user();
            markets[i].asset = market.asset();
            markets[i].strikeTime = market.strikeTime();
            markets[i].strikePrice = market.strikePrice();
            markets[i].direction = market.direction();
            markets[i].buyinAmount = market.buyinAmount();
            markets[i].resolved = market.resolved();
            markets[i].finalPrice = market.finalPrice();
            markets[i].result = market.result();
            markets[i].isUserWinner = market.isUserWinner();
        }
        return markets;
    }

    /// @notice return all risk data (direction, current and max) for both directions (Up and Down) by specified asset
    function getRiskPerAssetAndDirection(bytes32 asset) external view returns (Risk[] memory) {
        Risk[] memory risks = new Risk[](2); // two directions: Up and Down
        // Up
        SpeedMarket.Direction currentDirection = SpeedMarket.Direction.Up;
        risks[0].direction = currentDirection;
        risks[0].current = currentRiskPerAssetAndDirection[asset][currentDirection];
        risks[0].max = maxRiskPerAssetAndDirection[asset][currentDirection];
        // Down
        currentDirection = SpeedMarket.Direction.Down;
        risks[1].direction = currentDirection;
        risks[1].current = currentRiskPerAssetAndDirection[asset][currentDirection];
        risks[1].max = maxRiskPerAssetAndDirection[asset][currentDirection];

        return risks;
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

    /// @notice map asset to PythID, e.g. "ETH" as bytes 32 to an equivalent ID from pyth docs
    function setAssetToPythID(bytes32 asset, bytes32 pythId) external onlyOwner {
        assetToPythId[asset] = pythId;
        emit SetAssetToPythID(asset, pythId);
    }

    /// @notice whats the longest a price can be delayed
    function setMaximumPriceDelay(uint64 _maximumPriceDelay) external onlyOwner {
        maximumPriceDelay = _maximumPriceDelay;
        emit SetMaximumPriceDelay(maximumPriceDelay);
    }

    /// @notice whats the longest a price can be delayed when resolving
    function setMaximumPriceDelayForResolving(uint64 _maximumPriceDelayForResolving) external onlyOwner {
        maximumPriceDelayForResolving = _maximumPriceDelayForResolving;
        emit SetMaximumPriceDelayForResolving(maximumPriceDelayForResolving);
    }

    /// @notice maximum open interest per asset
    function setMaxRiskPerAsset(bytes32 asset, uint _maxRiskPerAsset) external onlyOwner {
        maxRiskPerAsset[asset] = _maxRiskPerAsset;
        emit SetMaxRiskPerAsset(asset, _maxRiskPerAsset);
    }

    /// @notice maximum risk per asset and direction
    function setMaxRiskPerAssetAndDirection(bytes32 asset, uint _maxRiskPerAssetAndDirection) external onlyOwner {
        maxRiskPerAssetAndDirection[asset][SpeedMarket.Direction.Up] = _maxRiskPerAssetAndDirection;
        maxRiskPerAssetAndDirection[asset][SpeedMarket.Direction.Down] = _maxRiskPerAssetAndDirection;
        emit SetMaxRiskPerAssetAndDirection(asset, _maxRiskPerAssetAndDirection);
    }

    /// @notice set SafeBox params
    function setSafeBoxParams(address _safeBox, uint _safeBoxImpact) external onlyOwner {
        safeBox = _safeBox;
        safeBoxImpact = _safeBoxImpact;
        emit SetSafeBoxParams(_safeBox, _safeBoxImpact);
    }

    /// @notice set LP fee
    function setLPFee(uint _lpFee) external onlyOwner {
        lpFee = _lpFee;
        emit SetLPFee(_lpFee);
    }

    /// @notice Set staking thales
    function setStakingThales(address _stakingThales) external onlyOwner {
        //TODO: dont set till StakingThalesBonusRewardsManager is ready for it
        stakingThales = IStakingThales(_stakingThales);
        emit SetStakingThales(_stakingThales);
    }

    /// @notice Set pyth
    function setPyth(address _pyth) external onlyOwner {
        pyth = IPyth(_pyth);
        emit SetPyth(_pyth);
    }

    /// @notice set whether an asset is supported
    function setSupportedAsset(bytes32 asset, bool _supported) external onlyOwner {
        supportedAsset[asset] = _supported;
        emit SetSupportedAsset(asset, _supported);
    }

    /// @notice set multicollateral onramp contract
    function setMultiCollateralOnOffRamp(address _onramper, bool enabled) external onlyOwner {
        multiCollateralOnOffRamp = IMultiCollateralOnOffRamp(_onramper);
        multicollateralEnabled = enabled;
        emit SetMultiCollateralOnOffRamp(_onramper, enabled);
    }

    /// @notice adding/removing whitelist address depending on a flag
    /// @param _whitelistAddress address that needed to be whitelisted/ ore removed from WL
    /// @param _flag adding or removing from whitelist (true: add, false: remove)
    function addToWhitelist(address _whitelistAddress, bool _flag) external onlyOwner {
        require(_whitelistAddress != address(0) && whitelistedAddresses[_whitelistAddress] != _flag);
        whitelistedAddresses[_whitelistAddress] = _flag;
        emit AddedIntoWhitelist(_whitelistAddress, _flag);
    }

    //////////////////modifiers/////////////////

    modifier isAddressWhitelisted() {
        require(whitelistedAddresses[msg.sender], "Resolver not whitelisted");
        _;
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

    event MarketResolved(address market, SpeedMarket.Direction result, bool userIsWinner);

    event MastercopyChanged(address mastercopy);
    event AmountsChanged(uint _minBuyinAmount, uint _maxBuyinAmount);
    event TimesChanged(uint _minimalTimeToMaturity, uint _maximalTimeToMaturity);
    event SetAssetToPythID(bytes32 asset, bytes32 pythId);
    event SetMaximumPriceDelay(uint _maximumPriceDelay);
    event SetMaximumPriceDelayForResolving(uint _maximumPriceDelayForResolving);
    event SetMaxRiskPerAsset(bytes32 asset, uint _maxRiskPerAsset);
    event SetMaxRiskPerAssetAndDirection(bytes32 asset, uint _maxRiskPerAssetAndDirection);
    event SetSafeBoxParams(address _safeBox, uint _safeBoxImpact);
    event SetLPFee(uint _lpFee);
    event SetStakingThales(address _stakingThales);
    event SetPyth(address _pyth);
    event SetSupportedAsset(bytes32 asset, bool _supported);
    event AddedIntoWhitelist(address _whitelistAddress, bool _flag);
    event SetMultiCollateralOnOffRamp(address _onramper, bool enabled);
}

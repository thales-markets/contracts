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
import "../interfaces/IReferrals.sol";
import "../interfaces/IAddressManager.sol";
import "../interfaces/ISpeedMarketsAMM.sol";

import "./SpeedMarket.sol";
import "./SpeedMarketsAMMUtils.sol";

/// @title An AMM for Thales speed markets
contract SpeedMarketsAMM is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressSetLib for AddressSetLib.AddressSet;

    AddressSetLib.AddressSet internal _activeMarkets;
    AddressSetLib.AddressSet internal _maturedMarkets;

    uint private constant ONE = 1e18;
    uint private constant MAX_APPROVAL = type(uint256).max;

    IERC20Upgradeable public sUSD;

    address public speedMarketMastercopy;

    uint public safeBoxImpact;
    uint public lpFee;

    address private safeBox; // unused, moved to AddressManager

    mapping(bytes32 => bool) public supportedAsset;

    uint public minimalTimeToMaturity;
    uint public maximalTimeToMaturity;

    uint public minBuyinAmount;
    uint public maxBuyinAmount;

    mapping(bytes32 => uint) public maxRiskPerAsset;
    mapping(bytes32 => uint) public currentRiskPerAsset;

    mapping(bytes32 => bytes32) public assetToPythId;

    IPyth private pyth; // unused, moved to AddressManager

    uint64 public maximumPriceDelay;

    IStakingThales private stakingThales; // unused, moved to AddressManager

    mapping(address => AddressSetLib.AddressSet) internal _activeMarketsPerUser;
    mapping(address => AddressSetLib.AddressSet) internal _maturedMarketsPerUser;

    mapping(address => bool) public whitelistedAddresses;
    IMultiCollateralOnOffRamp private multiCollateralOnOffRamp; // unused, moved to AddressManager
    bool public multicollateralEnabled;

    mapping(bytes32 => mapping(SpeedMarket.Direction => uint)) public maxRiskPerAssetAndDirection;
    mapping(bytes32 => mapping(SpeedMarket.Direction => uint)) public currentRiskPerAssetAndDirection;

    uint64 public maximumPriceDelayForResolving;

    mapping(address => bool) public marketHasCreatedAtAttribute;

    address private referrals; // unused, moved to AddressManager

    uint[] public timeThresholdsForFees;
    uint[] public lpFees;

    SpeedMarketsAMMUtils private speedMarketsAMMUtils;

    mapping(address => bool) public marketHasFeeAttribute;

    /// @return The address of the address manager contract
    IAddressManager public addressManager;

    uint public maxSkewImpact;
    uint public skewSlippage;

    /// @param user user wallet address
    /// @param asset market asset
    /// @param strikeTime strike time, if zero delta time is used
    /// @param delta delta time, used if strike time is zero
    /// @param pythPrice structure with pyth price and publish time
    /// @param direction direction (UP/DOWN)
    /// @param collateral collateral address, for default collateral use zero address
    /// @param collateralAmount collateral amount, for non default includes fees
    /// @param referrer referrer address
    /// @param skewImpact skew impact, used to check skew slippage
    struct CreateMarketParams {
        address user;
        bytes32 asset;
        uint64 strikeTime;
        uint64 delta;
        PythStructs.Price pythPrice;
        SpeedMarket.Direction direction;
        address collateral;
        uint collateralAmount;
        address referrer;
        uint skewImpact;
    }

    receive() external payable {}

    function initialize(address _owner, IERC20Upgradeable _sUSD) external initializer {
        setOwner(_owner);
        initNonReentrant();
        sUSD = _sUSD;
    }

    /// @notice create new market for a given delta/strike time
    /// @param _params parameters for creating market
    function createNewMarket(CreateMarketParams calldata _params) external nonReentrant notPaused onlyCreator {
        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();

        bool isDefaultCollateral = _params.collateral == address(0);
        uint64 strikeTime = _params.strikeTime == 0 ? uint64(block.timestamp + _params.delta) : _params.strikeTime;
        uint buyinAmount = isDefaultCollateral
            ? _params.collateralAmount
            : _getBuyinWithConversion(
                _params.user,
                _params.collateral,
                _params.collateralAmount,
                strikeTime,
                contractsAddresses
            );

        _createNewMarket(
            _params.user,
            _params.asset,
            strikeTime,
            _params.pythPrice,
            _params.direction,
            buyinAmount,
            isDefaultCollateral,
            _params.referrer,
            _params.skewImpact,
            contractsAddresses
        );
    }

    function _getBuyinWithConversion(
        address user,
        address collateral,
        uint collateralAmount,
        uint64 strikeTime,
        IAddressManager.Addresses memory contractsAddresses
    ) internal returns (uint buyinAmount) {
        require(multicollateralEnabled, "Multicollateral onramp not enabled");
        uint amountBefore = sUSD.balanceOf(address(this));

        IMultiCollateralOnOffRamp iMultiCollateralOnOffRamp = IMultiCollateralOnOffRamp(
            contractsAddresses.multiCollateralOnOffRamp
        );

        IERC20Upgradeable(collateral).safeTransferFrom(user, address(this), collateralAmount);
        IERC20Upgradeable(collateral).approve(address(iMultiCollateralOnOffRamp), collateralAmount);
        uint convertedAmount = iMultiCollateralOnOffRamp.onramp(collateral, collateralAmount);

        uint lpFeeForDeltaTime = speedMarketsAMMUtils.getFeeByTimeThreshold(
            uint64(strikeTime - block.timestamp),
            timeThresholdsForFees,
            lpFees,
            lpFee
        );

        buyinAmount = (convertedAmount * ONE) / (ONE + safeBoxImpact + lpFeeForDeltaTime);

        uint amountDiff = sUSD.balanceOf(address(this)) - amountBefore;
        require(amountDiff >= buyinAmount, "not enough received via onramp");
    }

    function _getSkewByAssetAndDirection(bytes32 _asset, SpeedMarket.Direction _direction) internal view returns (uint) {
        return
            (((currentRiskPerAssetAndDirection[_asset][_direction] * ONE) /
                maxRiskPerAssetAndDirection[_asset][_direction]) * maxSkewImpact) / ONE;
    }

    function _handleRiskAndGetFee(
        bytes32 asset,
        SpeedMarket.Direction direction,
        uint buyinAmount,
        uint64 strikeTime,
        uint skewImpact
    ) internal returns (uint lpFeeWithSkew) {
        uint skew = _getSkewByAssetAndDirection(asset, direction);
        require(skew <= skewImpact + skewSlippage, "Skew slippage exceeded");

        SpeedMarket.Direction oppositeDirection = direction == SpeedMarket.Direction.Up
            ? SpeedMarket.Direction.Down
            : SpeedMarket.Direction.Up;

        // calculate discount as half of skew for opposite direction
        uint discount = skew == 0 ? _getSkewByAssetAndDirection(asset, oppositeDirection) / 2 : 0;

        // decrease risk for opposite direction if there is, otherwise increase risk for current direction
        if (currentRiskPerAssetAndDirection[asset][oppositeDirection] > buyinAmount) {
            currentRiskPerAssetAndDirection[asset][oppositeDirection] -= buyinAmount;
        } else {
            currentRiskPerAssetAndDirection[asset][direction] +=
                buyinAmount -
                currentRiskPerAssetAndDirection[asset][oppositeDirection];
            currentRiskPerAssetAndDirection[asset][oppositeDirection] = 0;
            require(
                currentRiskPerAssetAndDirection[asset][direction] <= maxRiskPerAssetAndDirection[asset][direction],
                "Risk per direction exceeded"
            );
        }

        // (LP fee by delta time) + (skew impact based on risk per direction and asset) - (discount as half of opposite skew)
        lpFeeWithSkew =
            speedMarketsAMMUtils.getFeeByTimeThreshold(
                uint64(strikeTime - block.timestamp),
                timeThresholdsForFees,
                lpFees,
                lpFee
            ) +
            skew -
            discount;

        currentRiskPerAsset[asset] += (buyinAmount * 2 - (buyinAmount * (ONE + lpFeeWithSkew)) / ONE);
        require(currentRiskPerAsset[asset] <= maxRiskPerAsset[asset], "Risk per asset exceeded");
    }

    function _handleReferrerAndSafeBox(
        address user,
        address referrer,
        uint buyinAmount,
        IAddressManager.Addresses memory contractsAddresses
    ) internal returns (uint referrerShare) {
        IReferrals iReferrals = IReferrals(contractsAddresses.referrals);
        if (address(iReferrals) != address(0)) {
            address newOrExistingReferrer;
            if (referrer != address(0)) {
                iReferrals.setReferrer(referrer, user);
                newOrExistingReferrer = referrer;
            } else {
                newOrExistingReferrer = iReferrals.referrals(user);
            }

            if (newOrExistingReferrer != address(0)) {
                uint referrerFeeByTier = iReferrals.getReferrerFee(newOrExistingReferrer);
                if (referrerFeeByTier > 0) {
                    referrerShare = (buyinAmount * referrerFeeByTier) / ONE;
                    sUSD.safeTransfer(newOrExistingReferrer, referrerShare);
                    emit ReferrerPaid(newOrExistingReferrer, user, referrerShare, buyinAmount);
                }
            }
        }

        sUSD.safeTransfer(contractsAddresses.safeBox, (buyinAmount * safeBoxImpact) / ONE - referrerShare);
    }

    function _createNewMarket(
        address user,
        bytes32 asset,
        uint64 strikeTime,
        PythStructs.Price calldata pythPrice,
        SpeedMarket.Direction direction,
        uint buyinAmount,
        bool transferSusd,
        address referrer,
        uint skewImpact,
        IAddressManager.Addresses memory contractsAddresses
    ) internal {
        require(supportedAsset[asset], "Asset is not supported");
        require(buyinAmount >= minBuyinAmount && buyinAmount <= maxBuyinAmount, "Wrong buy in amount");
        require(strikeTime >= (block.timestamp + minimalTimeToMaturity), "Strike time not allowed");
        require(strikeTime <= block.timestamp + maximalTimeToMaturity, "Time too far into the future");

        uint lpFeeWithSkew = _handleRiskAndGetFee(asset, direction, buyinAmount, strikeTime, skewImpact);

        if (transferSusd) {
            uint totalAmountToTransfer = (buyinAmount * (ONE + safeBoxImpact + lpFeeWithSkew)) / ONE;
            sUSD.safeTransferFrom(user, address(this), totalAmountToTransfer);
        }
        SpeedMarket srm = SpeedMarket(Clones.clone(speedMarketMastercopy));
        srm.initialize(
            SpeedMarket.InitParams(
                address(this),
                user,
                asset,
                strikeTime,
                pythPrice.price,
                uint64(pythPrice.publishTime),
                direction,
                buyinAmount,
                safeBoxImpact,
                lpFeeWithSkew
            )
        );

        sUSD.safeTransfer(address(srm), buyinAmount * 2);

        _handleReferrerAndSafeBox(user, referrer, buyinAmount, contractsAddresses);

        _activeMarkets.add(address(srm));
        _activeMarketsPerUser[user].add(address(srm));

        if (contractsAddresses.stakingThales != address(0)) {
            IStakingThales(contractsAddresses.stakingThales).updateVolume(user, buyinAmount);
        }

        marketHasCreatedAtAttribute[address(srm)] = true;
        marketHasFeeAttribute[address(srm)] = true;
        emit MarketCreated(address(srm), user, asset, strikeTime, pythPrice.price, direction, buyinAmount);
        emit MarketCreatedWithFees(
            address(srm),
            user,
            asset,
            strikeTime,
            pythPrice.price,
            direction,
            buyinAmount,
            safeBoxImpact,
            lpFeeWithSkew
        );
    }

    /// @notice resolveMarket resolves an active market
    /// @param market address of the market
    function resolveMarket(address market, bytes[] calldata priceUpdateData) external payable nonReentrant notPaused {
        _resolveMarket(market, priceUpdateData);
    }

    /// @notice resolveMarket resolves an active market with offramp
    /// @param market address of the market
    function resolveMarketWithOfframp(
        address market,
        bytes[] calldata priceUpdateData,
        address collateral,
        bool toEth
    ) external payable nonReentrant notPaused {
        require(multicollateralEnabled, "Multicollateral offramp not enabled");
        address user = SpeedMarket(market).user();
        require(msg.sender == user, "Only allowed from market owner");
        uint amountBefore = sUSD.balanceOf(user);
        _resolveMarket(market, priceUpdateData);
        uint amountDiff = sUSD.balanceOf(user) - amountBefore;
        sUSD.safeTransferFrom(user, address(this), amountDiff);
        if (amountDiff > 0) {
            IMultiCollateralOnOffRamp iMultiCollateralOnOffRamp = IMultiCollateralOnOffRamp(
                addressManager.multiCollateralOnOffRamp()
            );
            if (toEth) {
                uint offramped = iMultiCollateralOnOffRamp.offrampIntoEth(amountDiff);
                address payable _to = payable(user);
                bool sent = _to.send(offramped);
                require(sent, "Failed to send Ether");
            } else {
                uint offramped = iMultiCollateralOnOffRamp.offramp(collateral, amountDiff);
                IERC20Upgradeable(collateral).safeTransfer(user, offramped);
            }
        }
    }

    /// @notice resolveMarkets in a batch
    function resolveMarketsBatch(address[] calldata markets, bytes[] calldata priceUpdateData)
        external
        payable
        nonReentrant
        notPaused
    {
        for (uint i = 0; i < markets.length; i++) {
            if (canResolveMarket(markets[i])) {
                bytes[] memory subarray = new bytes[](1);
                subarray[0] = priceUpdateData[i];
                _resolveMarket(markets[i], subarray);
            }
        }
    }

    function _resolveMarket(address market, bytes[] memory priceUpdateData) internal {
        require(canResolveMarket(market), "Can not resolve");

        IPyth iPyth = IPyth(addressManager.pyth());
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = assetToPythId[SpeedMarket(market).asset()];
        PythStructs.PriceFeed[] memory prices = iPyth.parsePriceFeedUpdates{value: iPyth.getUpdateFee(priceUpdateData)}(
            priceUpdateData,
            priceIds,
            SpeedMarket(market).strikeTime(),
            SpeedMarket(market).strikeTime() + maximumPriceDelayForResolving
        );

        PythStructs.Price memory price = prices[0].price;

        require(price.price > 0, "Invalid price");

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

    /// @notice owner can resolve market for a given market address with finalPrice
    function resolveMarketAsOwner(address _market, int64 _finalPrice) external onlyOwner {
        require(canResolveMarket(_market), "Can not resolve");
        _resolveMarketWithPrice(_market, _finalPrice);
    }

    function _resolveMarketManually(address _market, int64 _finalPrice) internal {
        SpeedMarket.Direction direction = SpeedMarket(_market).direction();
        int64 strikePrice = SpeedMarket(_market).strikePrice();
        bool isUserWinner = (_finalPrice < strikePrice && direction == SpeedMarket.Direction.Down) ||
            (_finalPrice > strikePrice && direction == SpeedMarket.Direction.Up);
        require(canResolveMarket(_market) && !isUserWinner, "Can not resolve manually");
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

    /// @notice Transfer amount to destination address
    function transferAmount(address _destination, uint _amount) external onlyOwner {
        sUSD.safeTransfer(_destination, _amount);
        emit AmountTransfered(_destination, _amount);
    }

    //////////// getters /////////////////

    /// @notice activeMarkets returns list of active markets
    /// @param index index of the page
    /// @param pageSize number of addresses per page
    /// @return address[] active market list
    function activeMarkets(uint index, uint pageSize) external view returns (address[] memory) {
        return _activeMarkets.getPage(index, pageSize);
    }

    /// @notice maturedMarkets returns list of matured markets
    /// @param index index of the page
    /// @param pageSize number of addresses per page
    /// @return address[] matured market list
    function maturedMarkets(uint index, uint pageSize) external view returns (address[] memory) {
        return _maturedMarkets.getPage(index, pageSize);
    }

    /// @notice activeMarkets returns list of active markets per user
    function activeMarketsPerUser(
        uint index,
        uint pageSize,
        address user
    ) external view returns (address[] memory) {
        return _activeMarketsPerUser[user].getPage(index, pageSize);
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

    /// @notice get lengths of all arrays
    function getLengths(address user) external view returns (uint[5] memory) {
        return [
            _activeMarkets.elements.length,
            _maturedMarkets.elements.length,
            _activeMarketsPerUser[user].elements.length,
            _maturedMarketsPerUser[user].elements.length,
            lpFees.length
        ];
    }

    /// @notice get params for chained market
    function getParams(bytes32 asset) external view returns (ISpeedMarketsAMM.Params memory) {
        ISpeedMarketsAMM.Params memory params;
        params.supportedAsset = supportedAsset[asset];
        params.safeBoxImpact = safeBoxImpact;
        params.maximumPriceDelay = maximumPriceDelay;
        return params;
    }

    //////////////////setters/////////////////

    /// @notice Set addresses used in AMM
    /// @param _mastercopy to use to create markets
    /// @param _speedMarketsAMMUtils address of speed markets AMM utils
    /// @param _addressManager address manager contract
    function setAMMAddresses(
        address _mastercopy,
        SpeedMarketsAMMUtils _speedMarketsAMMUtils,
        address _addressManager
    ) external onlyOwner {
        speedMarketMastercopy = _mastercopy;
        speedMarketsAMMUtils = _speedMarketsAMMUtils;
        addressManager = IAddressManager(_addressManager);
        emit AMMAddressesChanged(_mastercopy, _speedMarketsAMMUtils, _addressManager);
    }

    /// @notice Set parameters for limits
    function setLimitParams(
        uint _minBuyinAmount,
        uint _maxBuyinAmount,
        uint _minimalTimeToMaturity,
        uint _maximalTimeToMaturity,
        uint64 _maximumPriceDelay,
        uint64 _maximumPriceDelayForResolving
    ) external onlyOwner {
        minBuyinAmount = _minBuyinAmount;
        maxBuyinAmount = _maxBuyinAmount;
        minimalTimeToMaturity = _minimalTimeToMaturity;
        maximalTimeToMaturity = _maximalTimeToMaturity;
        maximumPriceDelay = _maximumPriceDelay;
        maximumPriceDelayForResolving = _maximumPriceDelayForResolving;
        emit LimitParamsChanged(
            _minBuyinAmount,
            _maxBuyinAmount,
            _minimalTimeToMaturity,
            _maximalTimeToMaturity,
            _maximumPriceDelay,
            _maximumPriceDelayForResolving
        );
    }

    /// @notice maximum risk per asset and per asset and direction
    function setMaxRisks(
        bytes32 asset,
        uint _maxRiskPerAsset,
        uint _maxRiskPerAssetAndDirection
    ) external onlyOwner {
        maxRiskPerAsset[asset] = _maxRiskPerAsset;
        currentRiskPerAsset[asset] = 0;
        maxRiskPerAssetAndDirection[asset][SpeedMarket.Direction.Up] = _maxRiskPerAssetAndDirection;
        maxRiskPerAssetAndDirection[asset][SpeedMarket.Direction.Down] = _maxRiskPerAssetAndDirection;
        emit SetMaxRisks(asset, _maxRiskPerAsset, _maxRiskPerAssetAndDirection);
    }

    /// @notice set SafeBox, max skew impact and skew slippage
    /// @param _safeBoxImpact safebox impact
    /// @param _maxSkewImpact skew impact
    /// @param _skewSlippage skew slippage
    function setSafeBoxAndMaxSkewImpact(
        uint _safeBoxImpact,
        uint _maxSkewImpact,
        uint _skewSlippage
    ) external onlyOwner {
        safeBoxImpact = _safeBoxImpact;
        maxSkewImpact = _maxSkewImpact;
        skewSlippage = _skewSlippage;
        emit SafeBoxAndMaxSkewImpactChanged(_safeBoxImpact, _maxSkewImpact, _skewSlippage);
    }

    /// @notice set LP fee params
    /// @param _timeThresholds array of time thresholds (minutes) for different fees in ascending order
    /// @param _lpFees array of fees applied to each time frame defined in _timeThresholds
    /// @param _lpFee default LP fee when there are no dynamic fees
    function setLPFeeParams(
        uint[] calldata _timeThresholds,
        uint[] calldata _lpFees,
        uint _lpFee
    ) external onlyOwner {
        require(_timeThresholds.length == _lpFees.length, "Times and fees must have the same length");
        delete timeThresholdsForFees;
        delete lpFees;
        for (uint i = 0; i < _timeThresholds.length; i++) {
            timeThresholdsForFees.push(_timeThresholds[i]);
            lpFees.push(_lpFees[i]);
        }
        lpFee = _lpFee;
        emit SetLPFeeParams(_timeThresholds, _lpFees, _lpFee);
    }

    /// @notice set whether an asset is supported
    function setSupportedAsset(bytes32 asset, bool _supported) external onlyOwner {
        supportedAsset[asset] = _supported;
        emit SetSupportedAsset(asset, _supported);
    }

    /// @notice map asset to PythID, e.g. "ETH" as bytes 32 to an equivalent ID from pyth docs
    function setAssetToPythID(bytes32 asset, bytes32 pythId) external onlyOwner {
        assetToPythId[asset] = pythId;
        emit SetAssetToPythID(asset, pythId);
    }

    /// @notice set sUSD address (default collateral)
    function setSusdAddress(address _sUSD) external onlyOwner {
        sUSD = IERC20Upgradeable(_sUSD);
        emit SusdAddressChanged(_sUSD);
    }

    /// @notice set multi-collateral enabled
    function setMultiCollateralOnOffRampEnabled(bool _enabled) external onlyOwner {
        address multiCollateralAddress = addressManager.multiCollateralOnOffRamp();
        if (multiCollateralAddress != address(0)) {
            sUSD.approve(multiCollateralAddress, _enabled ? MAX_APPROVAL : 0);
        }
        multicollateralEnabled = _enabled;
        emit MultiCollateralOnOffRampEnabled(_enabled);
    }

    /// @notice adding/removing whitelist address depending on a flag
    /// @param _whitelistAddress address that needed to be whitelisted or removed from WL
    /// @param _flag adding or removing from whitelist (true: add, false: remove)
    function addToWhitelist(address _whitelistAddress, bool _flag) external onlyOwner {
        require(_whitelistAddress != address(0));
        whitelistedAddresses[_whitelistAddress] = _flag;
        emit AddedIntoWhitelist(_whitelistAddress, _flag);
    }

    //////////////////modifiers/////////////////

    modifier isAddressWhitelisted() {
        require(whitelistedAddresses[msg.sender], "Resolver not whitelisted");
        _;
    }

    modifier onlyCreator() {
        address speedMarketsCreator = addressManager.getAddress("SpeedMarketsAMMCreator");
        require(msg.sender == speedMarketsCreator, "only from Creator");
        _;
    }

    //////////////////events/////////////////

    event MarketCreated(
        address _market,
        address _user,
        bytes32 _asset,
        uint _strikeTime,
        int64 _strikePrice,
        SpeedMarket.Direction _direction,
        uint _buyinAmount
    );
    event MarketCreatedWithFees(
        address _market,
        address _user,
        bytes32 _asset,
        uint _strikeTime,
        int64 _strikePrice,
        SpeedMarket.Direction _direction,
        uint _buyinAmount,
        uint _safeBoxImpact,
        uint _lpFee
    );

    event MarketResolved(address _market, SpeedMarket.Direction _result, bool _userIsWinner);

    event AMMAddressesChanged(address _mastercopy, SpeedMarketsAMMUtils _speedMarketsAMMUtils, address _addressManager);
    event LimitParamsChanged(
        uint _minBuyinAmount,
        uint _maxBuyinAmount,
        uint _minimalTimeToMaturity,
        uint _maximalTimeToMaturity,
        uint _maximumPriceDelay,
        uint _maximumPriceDelayForResolving
    );
    event SetMaxRisks(bytes32 asset, uint _maxRiskPerAsset, uint _maxRiskPerAssetAndDirection);
    event SafeBoxAndMaxSkewImpactChanged(uint _safeBoxImpact, uint _maxSkewImpact, uint _skewSlippage);
    event SetLPFeeParams(uint[] _timeThresholds, uint[] _lpFees, uint _lpFee);
    event SetSupportedAsset(bytes32 asset, bool _supported);
    event SetAssetToPythID(bytes32 asset, bytes32 pythId);
    event AddedIntoWhitelist(address _whitelistAddress, bool _flag);
    event SusdAddressChanged(address _sUSD);
    event MultiCollateralOnOffRampEnabled(bool _enabled);
    event ReferrerPaid(address refferer, address trader, uint amount, uint volume);
    event AmountTransfered(address _destination, uint _amount);
}

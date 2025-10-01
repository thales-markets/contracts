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
import "../interfaces/ISpeedMarketsAMMUtils.sol";

/// @title An AMM for Overtime Speed Markets
contract SpeedMarketsAMM is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressSetLib for AddressSetLib.AddressSet;

    AddressSetLib.AddressSet internal _activeMarkets;
    AddressSetLib.AddressSet internal _maturedMarkets;

    uint private constant ONE = 1e18;
    uint private constant MAX_APPROVAL = type(uint256).max;

    /// ========== Custom Errors ==========
    error MulticollateralOnrampDisabled();
    error NotEnoughReceivedViaOnramp();
    error SkewSlippageExceeded();
    error RiskPerDirectionExceeded();
    error RiskPerAssetExceeded();
    error AssetNotSupported();
    error InvalidBuyinAmount();
    error InvalidStrikeTime();
    error TimeTooFarIntoFuture();
    error CanNotResolve();
    error InvalidPrice();
    error CanOnlyBeCalledFromResolverOrOwner();
    error OnlyCreatorAllowed();
    error BonusTooHigh();
    error OnlyMarketOwner();
    error EtherTransferFailed();
    error MismatchedLengths();
    error CollateralNotSupported();
    error InvalidOffRampCollateral();
    error InvalidWhitelistAddress();

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

    ISpeedMarketsAMMUtils public speedMarketsAMMUtils;

    mapping(address => bool) public marketHasFeeAttribute;

    /// @return The address of the address manager contract
    IAddressManager public addressManager;

    uint public maxSkewImpact;
    uint public skewSlippage;

    mapping(address => bool) public supportedNativeCollateral;

    /// @notice Bonus percentage per collateral token (e.g., 0.02e18 for 2%)
    mapping(address => uint) public bonusPerCollateral;

    /// @param user user wallet address
    /// @param asset market asset
    /// @param strikeTime strike time, if zero delta time is used
    /// @param delta delta time, used if strike time is zero
    /// @param strikePrice oracle price
    /// @param strikePricePublishTime oracle publish time for strike price
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
        int64 strikePrice;
        uint64 strikePricePublishTime;
        SpeedMarket.Direction direction;
        address collateral;
        uint collateralAmount;
        address referrer;
        uint skewImpact;
    }

    struct InternalCreateParams {
        CreateMarketParams createMarketParams;
        bool transferCollateral;
        uint64 strikeTime;
        uint buyinAmount;
        uint buyinAmountInUSD;
        address defaultCollateral;
    }

    receive() external payable {}

    function initialize(address _owner, IERC20Upgradeable _sUSD) external initializer {
        setOwner(_owner);
        initNonReentrant();
        sUSD = _sUSD;
        supportedNativeCollateral[address(_sUSD)] = true;
    }

    /// @notice create new market for a given delta/strike time
    /// @param _params parameters for creating market
    function createNewMarket(CreateMarketParams calldata _params)
        external
        nonReentrant
        notPaused
        onlyCreator
        returns (address marketAddress)
    {
        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();

        // Calculate strike time: use provided strikeTime or current timestamp + delta
        uint64 strikeTime = _params.strikeTime == 0 ? uint64(block.timestamp + _params.delta) : _params.strikeTime;
        // Determine collateral configuration
        (
            bool isNativeCollateral,
            address defaultCollateral,
            uint buyinAmount,
            uint buyinAmountInUSD
        ) = _determineCollateralConfig(_params, strikeTime, contractsAddresses);
        // Create internal parameters struct
        InternalCreateParams memory internalParams = InternalCreateParams({
            createMarketParams: _params,
            strikeTime: strikeTime,
            buyinAmount: buyinAmount,
            transferCollateral: isNativeCollateral,
            defaultCollateral: defaultCollateral,
            buyinAmountInUSD: buyinAmountInUSD
        });

        marketAddress = _createNewMarket(internalParams, contractsAddresses);
    }

    /// @notice Determines collateral configuration and calculates buyin amount
    /// @param _params Market creation parameters
    /// @param strikeTime Calculated strike time
    /// @param contractsAddresses Contract addresses from address manager
    /// @return isNativeCollateral Whether the collateral is natively supported
    /// @return defaultCollateral The default collateral address to use
    /// @return buyinAmount The calculated buyin amount
    function _determineCollateralConfig(
        CreateMarketParams calldata _params,
        uint64 strikeTime,
        IAddressManager.Addresses memory contractsAddresses
    )
        internal
        returns (
            bool isNativeCollateral,
            address defaultCollateral,
            uint buyinAmount,
            uint buyinAmountInUSD
        )
    {
        isNativeCollateral = supportedNativeCollateral[_params.collateral] || _params.collateral == address(0);
        if (supportedNativeCollateral[_params.collateral] && _params.collateral != address(0)) {
            defaultCollateral = _params.collateral;
        } else {
            defaultCollateral = address(sUSD);
        }

        // Calculate buyin amount based on collateral type
        if (isNativeCollateral) {
            buyinAmount = buyinAmountInUSD = _params.collateralAmount;
            if (defaultCollateral != address(sUSD)) {
                buyinAmountInUSD = speedMarketsAMMUtils.transformCollateralToUSD(
                    defaultCollateral,
                    address(sUSD),
                    _params.collateralAmount
                );
            }
        } else {
            // For external collaterals, convert through onramp
            buyinAmount = buyinAmountInUSD = _getBuyinWithConversion(
                _params.user,
                _params.collateral,
                _params.collateralAmount,
                strikeTime,
                contractsAddresses
            );
        }
    }

    /// @notice Gets the buyin amount with conversion
    /// @param user The user address
    /// @param collateral The collateral address
    /// @param collateralAmount The collateral amount
    /// @param strikeTime The strike time
    /// @param contractsAddresses Contract addresses from address manager
    /// @return buyinAmount The calculated buyin amount
    function _getBuyinWithConversion(
        address user,
        address collateral,
        uint collateralAmount,
        uint64 strikeTime,
        IAddressManager.Addresses memory contractsAddresses
    ) internal returns (uint buyinAmount) {
        if (!multicollateralEnabled) revert MulticollateralOnrampDisabled();

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
        if (amountDiff < buyinAmount) revert NotEnoughReceivedViaOnramp();
    }

    /// @notice Gets the skew by asset and direction
    /// @param _asset The asset
    /// @param _direction The direction
    /// @return skew The skew
    function _getSkewByAssetAndDirection(bytes32 _asset, SpeedMarket.Direction _direction) internal view returns (uint) {
        return
            (((currentRiskPerAssetAndDirection[_asset][_direction] * ONE) /
                maxRiskPerAssetAndDirection[_asset][_direction]) * maxSkewImpact) / ONE;
    }

    /// @notice Handles the risk and gets the fee
    /// @param asset The asset
    /// @param direction The direction
    /// @param buyinAmountInUSD The buyin amount in USD
    /// @param strikeTime The strike time
    /// @param skewImpact The skew impact
    function _handleRiskAndGetFee(
        bytes32 asset,
        SpeedMarket.Direction direction,
        uint buyinAmountInUSD,
        uint64 strikeTime,
        uint skewImpact,
        uint payoutBonus
    ) internal returns (uint lpFeeWithSkew, uint payoutInUSD) {
        uint skew = _getSkewByAssetAndDirection(asset, direction);
        if (skew > skewImpact + skewSlippage) revert SkewSlippageExceeded();

        SpeedMarket.Direction oppositeDirection = direction == SpeedMarket.Direction.Up
            ? SpeedMarket.Direction.Down
            : SpeedMarket.Direction.Up;

        // calculate discount as half of skew for opposite direction
        uint discount = skew == 0 ? _getSkewByAssetAndDirection(asset, oppositeDirection) / 2 : 0;
        // decrease risk for opposite direction if there is, otherwise increase risk for current direction
        if (currentRiskPerAssetAndDirection[asset][oppositeDirection] > buyinAmountInUSD) {
            currentRiskPerAssetAndDirection[asset][oppositeDirection] -= buyinAmountInUSD;
        } else {
            currentRiskPerAssetAndDirection[asset][direction] +=
                buyinAmountInUSD -
                currentRiskPerAssetAndDirection[asset][oppositeDirection];
            currentRiskPerAssetAndDirection[asset][oppositeDirection] = 0;
            if (currentRiskPerAssetAndDirection[asset][direction] > maxRiskPerAssetAndDirection[asset][direction]) {
                revert RiskPerDirectionExceeded();
            }
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
        // payout with bonus
        payoutInUSD = buyinAmountInUSD * 2 + (buyinAmountInUSD * 2 * payoutBonus) / ONE;
        // update risk per asset with the bonus applied
        currentRiskPerAsset[asset] += (payoutInUSD - (buyinAmountInUSD * (ONE + lpFeeWithSkew)) / ONE);
        if (currentRiskPerAsset[asset] > maxRiskPerAsset[asset]) {
            revert RiskPerAssetExceeded();
        }
    }

    /// @notice Handles the referrer and safe box
    /// @param user The user address
    /// @param referrer The referrer address
    /// @param buyinAmount The buyin amount
    /// @param collateral The collateral address
    /// @param contractsAddresses Contract addresses from address manager
    function _handleReferrerAndSafeBox(
        address user,
        address referrer,
        uint buyinAmount,
        IERC20Upgradeable collateral,
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
                    collateral.safeTransfer(newOrExistingReferrer, referrerShare);
                    emit ReferrerPaid(newOrExistingReferrer, user, referrerShare, buyinAmount);
                }
            }
        }
        collateral.safeTransfer(contractsAddresses.safeBox, (buyinAmount * safeBoxImpact) / ONE - referrerShare);
    }

    /// @notice Creates a new market
    /// @param params Internal market creation parameters
    /// @param contractsAddresses Contract addresses from address manager
    function _createNewMarket(InternalCreateParams memory params, IAddressManager.Addresses memory contractsAddresses)
        internal
        returns (address)
    {
        if (!supportedAsset[params.createMarketParams.asset]) revert AssetNotSupported();
        if (params.buyinAmountInUSD < minBuyinAmount || params.buyinAmountInUSD > maxBuyinAmount) {
            revert InvalidBuyinAmount();
        }

        if (params.strikeTime < block.timestamp + minimalTimeToMaturity) {
            revert InvalidStrikeTime();
        }

        if (params.strikeTime > block.timestamp + maximalTimeToMaturity) {
            revert TimeTooFarIntoFuture();
        }
        (uint lpFeeWithSkew, uint payoutInUSD) = _handleRiskAndGetFee(
            params.createMarketParams.asset,
            params.createMarketParams.direction,
            params.buyinAmountInUSD,
            params.strikeTime,
            params.createMarketParams.skewImpact,
            params.transferCollateral ? bonusPerCollateral[params.defaultCollateral] : 0
        );
        if (params.transferCollateral) {
            uint totalAmountToTransfer = (params.buyinAmount * (ONE + safeBoxImpact + lpFeeWithSkew)) / ONE;
            IERC20Upgradeable(params.defaultCollateral).safeTransferFrom(
                params.createMarketParams.user,
                address(this),
                totalAmountToTransfer
            );
        }
        SpeedMarket srm = SpeedMarket(Clones.clone(speedMarketMastercopy));
        uint payout = payoutInUSD;
        bool defaultCollateralIsNotUSD = params.transferCollateral && params.defaultCollateral != address(sUSD);
        if (defaultCollateralIsNotUSD) {
            payout = params.buyinAmount * 2 + (params.buyinAmount * 2 * bonusPerCollateral[params.defaultCollateral]) / ONE;
        }
        srm.initialize(
            SpeedMarket.InitParams(
                address(this),
                params.createMarketParams.user,
                params.createMarketParams.asset,
                params.strikeTime,
                params.createMarketParams.strikePrice,
                params.createMarketParams.strikePricePublishTime,
                params.createMarketParams.direction,
                params.defaultCollateral,
                params.buyinAmount,
                safeBoxImpact,
                lpFeeWithSkew,
                payout
            )
        );
        if (defaultCollateralIsNotUSD) {
            IERC20Upgradeable(params.defaultCollateral).safeTransfer(address(srm), payout);
        } else {
            sUSD.safeTransfer(address(srm), payout);
        }
        _handleReferrerAndSafeBox(
            params.createMarketParams.user,
            params.createMarketParams.referrer,
            params.buyinAmount,
            IERC20Upgradeable(params.defaultCollateral),
            contractsAddresses
        );
        _activeMarkets.add(address(srm));
        _activeMarketsPerUser[params.createMarketParams.user].add(address(srm));
        marketHasCreatedAtAttribute[address(srm)] = true;
        marketHasFeeAttribute[address(srm)] = true;
        emit MarketCreated(
            address(srm),
            params.createMarketParams.user,
            params.createMarketParams.asset,
            params.strikeTime,
            params.createMarketParams.strikePrice,
            params.createMarketParams.direction,
            params.buyinAmount
        );
        emit MarketCreatedWithFees(
            address(srm),
            params.createMarketParams.user,
            params.createMarketParams.asset,
            params.strikeTime,
            params.createMarketParams.strikePrice,
            params.createMarketParams.direction,
            params.buyinAmountInUSD,
            safeBoxImpact,
            lpFeeWithSkew
        );
        return address(srm);
    }

    /// @notice owner can resolve market for a given market address with finalPrice
    function resolveMarketWithPrice(address _market, int64 _finalPrice) external {
        if (msg.sender != addressManager.getAddress("SpeedMarketsAMMResolver") && msg.sender != owner)
            revert CanOnlyBeCalledFromResolverOrOwner();
        if (!canResolveMarket(_market)) revert CanNotResolve();

        _resolveMarketWithPrice(_market, _finalPrice);
    }

    function _resolveMarketWithPrice(address market, int64 _finalPrice) internal {
        SpeedMarket sm = SpeedMarket(market);
        sm.resolve(_finalPrice);
        _activeMarkets.remove(market);
        _maturedMarkets.add(market);
        address user = sm.user();
        if (_activeMarketsPerUser[user].contains(market)) {
            _activeMarketsPerUser[user].remove(market);
        }
        _maturedMarketsPerUser[user].add(market);

        bytes32 asset = SpeedMarket(market).asset();
        address collateral = SpeedMarket(market).collateral();
        uint buyinAmountInUSD = collateral == address(sUSD) || collateral == address(0)
            ? SpeedMarket(market).buyinAmount()
            : speedMarketsAMMUtils.transformCollateralToUSD(collateral, address(sUSD), SpeedMarket(market).buyinAmount());
        SpeedMarket.Direction direction = SpeedMarket(market).direction();
        if (currentRiskPerAssetAndDirection[asset][direction] > buyinAmountInUSD) {
            currentRiskPerAssetAndDirection[asset][direction] -= buyinAmountInUSD;
        } else {
            currentRiskPerAssetAndDirection[asset][direction] = 0;
        }

        if (!sm.isUserWinner()) {
            if (currentRiskPerAsset[asset] > 2 * buyinAmountInUSD) {
                currentRiskPerAsset[asset] -= (2 * buyinAmountInUSD);
            } else {
                currentRiskPerAsset[asset] = 0;
            }
        }

        emit MarketResolved(market, sm.result(), sm.isUserWinner());
    }

    function offrampHelper(address user, uint amount) external {
        if (msg.sender != addressManager.getAddress("SpeedMarketsAMMResolver")) revert CanOnlyBeCalledFromResolverOrOwner();
        sUSD.safeTransferFrom(user, msg.sender, amount);
    }

    /// @notice Transfer amount to destination address
    function transferAmount(
        address _collateral,
        address _destination,
        uint _amount
    ) external onlyOwner {
        IERC20Upgradeable(_collateral).safeTransfer(_destination, _amount);
        emit AmountTransfered(_collateral, _destination, _amount);
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
        ISpeedMarketsAMMUtils _speedMarketsAMMUtils,
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
        if (_timeThresholds.length != _lpFees.length) revert MismatchedLengths();

        delete timeThresholdsForFees;
        delete lpFees;
        for (uint i; i < _timeThresholds.length; ++i) {
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

    /// @notice Set bonus percentage for a collateral
    /// @param _collateral collateral address
    /// @param _bonus bonus percentage (e.g., 0.02e18 for 2%)
    function setSupportedNativeCollateralAndBonus(
        address _collateral,
        bool _supported,
        uint _bonus,
        bytes32 _collateralKey
    ) external onlyOwner {
        // 10% bonus as max
        if (_bonus > 1e17) revert BonusTooHigh();

        bonusPerCollateral[_collateral] = _bonus;
        supportedNativeCollateral[_collateral] = _supported;
        speedMarketsAMMUtils.setCollateralKey(_collateral, _collateralKey);
        emit CollateralBonusSet(_collateral, _bonus);
    }

    /// @notice adding/removing whitelist address depending on a flag
    /// @param _whitelistAddress address that needed to be whitelisted or removed from WL
    /// @param _flag adding or removing from whitelist (true: add, false: remove)
    function addToWhitelist(address _whitelistAddress, bool _flag) external onlyOwner {
        if (_whitelistAddress == address(0)) revert InvalidWhitelistAddress();

        whitelistedAddresses[_whitelistAddress] = _flag;
        emit AddedIntoWhitelist(_whitelistAddress, _flag);
    }

    //////////////////modifiers/////////////////

    modifier onlyCreator() {
        address speedMarketsCreator = addressManager.getAddress("SpeedMarketsAMMCreator");
        if (msg.sender != speedMarketsCreator) revert OnlyCreatorAllowed();

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

    event AMMAddressesChanged(address _mastercopy, ISpeedMarketsAMMUtils _speedMarketsAMMUtils, address _addressManager);
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
    event SusdAddressChanged(address _sUSD);
    event MultiCollateralOnOffRampEnabled(bool _enabled);
    event ReferrerPaid(address refferer, address trader, uint amount, uint volume);
    event AmountTransfered(address _collateral, address _destination, uint _amount);
    event CollateralBonusSet(address indexed collateral, uint bonus);
    event AddedIntoWhitelist(address _whitelistAddress, bool _flag);
}

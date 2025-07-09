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
import "../interfaces/ISpeedMarketsAMM.sol";
import "../interfaces/IAddressManager.sol";

import "./SpeedMarket.sol";
import "./ChainedSpeedMarket.sol";

/// @title An AMM for Thales chained speed markets
contract ChainedSpeedMarketsAMM is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressSetLib for AddressSetLib.AddressSet;

    uint private constant ONE = 1e18;
    uint private constant MAX_APPROVAL = type(uint256).max;

    error MulticollateralOnrampDisabled();
    error NotEnoughReceivedViaOnramp();
    error AssetNotSupported();
    error InvalidBuyinAmount();
    error InvalidTimeFrame();
    error InvalidNumberOfDirections();
    error ProfitTooHigh();
    error OutOfLiquidity();
    error CanNotResolve();
    error InvalidPrice();
    error ResolverNotWhitelisted();
    error OnlyCreatorAllowed();
    error OnlyMarketOwner();
    error EtherTransferFailed();
    error InvalidOffRampCollateral();
    error MinChainedMarketsError();

    IERC20Upgradeable public sUSD;

    AddressSetLib.AddressSet internal _activeMarkets;
    AddressSetLib.AddressSet internal _maturedMarkets;

    mapping(address => AddressSetLib.AddressSet) internal _activeMarketsPerUser;
    mapping(address => AddressSetLib.AddressSet) internal _maturedMarketsPerUser;

    uint public minChainedMarkets;
    uint public maxChainedMarkets;

    uint64 public minTimeFrame;
    uint64 public maxTimeFrame;

    uint public minBuyinAmount;
    uint public maxBuyinAmount;

    uint public maxProfitPerIndividualMarket;

    uint private payoutMultiplier; // unused, part of payoutMultipliers

    uint public maxRisk;
    uint public currentRisk;

    address public chainedSpeedMarketMastercopy;

    bool public multicollateralEnabled;

    /// @notice The address of the address manager contract
    IAddressManager public addressManager;

    /// @notice payout multipliers for each number of chained markets, starting from minChainedMarkets up to maxChainedMarkets
    /// e.g. for 2-6 chained markets [1.7, 1.8, 1.9, 1.95, 2] - for 2 chained markets multiplier is 1.7, for 3 it is 1.8, ...
    uint[] public payoutMultipliers;

    // using this to solve stack too deep
    struct TempData {
        uint payout;
        uint payoutMultiplier;
        ISpeedMarketsAMM.Params speedAMMParams;
    }

    struct CreateMarketParams {
        address user;
        bytes32 asset;
        uint64 timeFrame;
        PythStructs.Price pythPrice;
        SpeedMarket.Direction[] directions;
        address collateral;
        uint collateralAmount;
        address referrer;
    }

    struct InternalCreateMarketParams {
        CreateMarketParams createMarketParams;
        uint buyinAmount;
        uint bonus;
        bool transferCollateral;
        address defaultCollateral;
    }

    receive() external payable {}

    function initialize(address _owner, IERC20Upgradeable _sUSD) external initializer {
        setOwner(_owner);
        initNonReentrant();
        sUSD = _sUSD;
    }

    /// @notice Creates a new market
    /// @param _params Market creation parameters
    /// @dev This function is used to create a new market
    function createNewMarket(CreateMarketParams calldata _params) external nonReentrant notPaused onlyPending {
        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();
        // Determine collateral configuration
        (bool isNativeCollateral, address defaultCollateral, uint buyinAmount, uint bonus) = _determineCollateralConfig(
            _params,
            contractsAddresses
        );
        InternalCreateMarketParams memory internalParams = InternalCreateMarketParams({
            createMarketParams: _params,
            buyinAmount: buyinAmount,
            bonus: bonus,
            transferCollateral: isNativeCollateral,
            defaultCollateral: defaultCollateral
        });

        _createNewMarket(internalParams, contractsAddresses);
    }

    /// @notice Determines collateral configuration and calculates buyin amount
    /// @param _params Market creation parameters
    /// @param contractsAddresses Contract addresses from address manager
    /// @return isNativeCollateral Whether the collateral is natively supported
    /// @return defaultCollateral The default collateral address to use
    /// @return buyinAmount The calculated buyin amount
    function _determineCollateralConfig(
        CreateMarketParams calldata _params,
        IAddressManager.Addresses memory contractsAddresses
    )
        internal
        returns (
            bool isNativeCollateral,
            address defaultCollateral,
            uint buyinAmount,
            uint bonus
        )
    {
        bool isSupportedNativeCollateral = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM).supportedNativeCollateral(
            _params.collateral
        );
        isNativeCollateral = isSupportedNativeCollateral || _params.collateral == address(0);
        if (isSupportedNativeCollateral && _params.collateral != address(0)) {
            defaultCollateral = _params.collateral;
        } else {
            defaultCollateral = address(sUSD);
        }
        bonus = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM).bonusPerCollateral(defaultCollateral);

        // Calculate buyin amount based on collateral type
        if (isNativeCollateral) {
            buyinAmount = _params.collateralAmount;
        } else {
            // For external collaterals, convert through onramp
            buyinAmount = _getBuyinWithConversion(
                _params.user,
                _params.collateral,
                _params.collateralAmount,
                contractsAddresses
            );
        }
    }

    /// @notice Gets the buyin amount with conversion
    /// @param user The user address
    /// @param collateral The collateral address
    /// @param collateralAmount The collateral amount
    /// @param contractsAddresses Contract addresses from address manager
    /// @return buyinAmount The calculated buyin amount
    function _getBuyinWithConversion(
        address user,
        address collateral,
        uint collateralAmount,
        IAddressManager.Addresses memory contractsAddresses
    ) internal returns (uint buyinAmount) {
        if (!multicollateralEnabled) revert MulticollateralOnrampDisabled();
        uint amountBefore = sUSD.balanceOf(address(this));
        IMultiCollateralOnOffRamp multiCollateralOnOffRamp = IMultiCollateralOnOffRamp(
            contractsAddresses.multiCollateralOnOffRamp
        );

        IERC20Upgradeable(collateral).safeTransferFrom(user, address(this), collateralAmount);
        IERC20Upgradeable(collateral).approve(address(multiCollateralOnOffRamp), collateralAmount);
        uint convertedAmount = multiCollateralOnOffRamp.onramp(collateral, collateralAmount);

        ISpeedMarketsAMM speedMarketsAMM = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM);
        buyinAmount = (convertedAmount * (ONE - speedMarketsAMM.safeBoxImpact())) / ONE;
        uint amountDiff = sUSD.balanceOf(address(this)) - amountBefore;
        if (amountDiff < buyinAmount) revert NotEnoughReceivedViaOnramp();
    }

    /// @notice Gets the payout amount
    /// @param _buyinAmount The buyin amount
    /// @param _numOfDirections The number of directions
    /// @param _payoutMultiplier The payout multiplier
    /// @return _payout The calculated payout amount
    function _getPayout(
        uint _buyinAmount,
        uint8 _numOfDirections,
        uint _payoutMultiplier
    ) internal pure returns (uint _payout) {
        _payout = _buyinAmount;
        for (uint8 i; i < _numOfDirections; ++i) {
            _payout = (_payout * _payoutMultiplier) / ONE;
        }
    }

    /// @notice Handles the referrer and safe box
    /// @param user The user address
    /// @param referrer The referrer address
    /// @param buyinAmount The buyin amount
    /// @param safeBoxImpact The safe box impact
    /// @param collateral The collateral address
    function _handleReferrerAndSafeBox(
        address user,
        address referrer,
        uint buyinAmount,
        uint safeBoxImpact,
        address collateral,
        IAddressManager.Addresses memory contractsAddresses
    ) internal returns (uint referrerShare) {
        IReferrals referrals = IReferrals(contractsAddresses.referrals);
        if (address(referrals) != address(0)) {
            address newOrExistingReferrer;
            if (referrer != address(0)) {
                referrals.setReferrer(referrer, user);
                newOrExistingReferrer = referrer;
            } else {
                newOrExistingReferrer = referrals.referrals(user);
            }

            if (newOrExistingReferrer != address(0)) {
                uint referrerFeeByTier = referrals.getReferrerFee(newOrExistingReferrer);
                if (referrerFeeByTier > 0) {
                    referrerShare = (buyinAmount * referrerFeeByTier) / ONE;
                    IERC20Upgradeable(collateral).safeTransfer(newOrExistingReferrer, referrerShare);
                    emit ReferrerPaid(newOrExistingReferrer, user, referrerShare, buyinAmount);
                }
            }
        }

        IERC20Upgradeable(collateral).safeTransfer(
            contractsAddresses.safeBox,
            (buyinAmount * safeBoxImpact) / ONE - referrerShare
        );
    }

    /// @notice Creates a new market
    /// @param internalParams Internal market creation parameters
    /// @param contractsAddresses Contract addresses from address manager
    function _createNewMarket(
        InternalCreateMarketParams memory internalParams,
        IAddressManager.Addresses memory contractsAddresses
    ) internal {
        TempData memory tempData;
        tempData.speedAMMParams = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM).getParams(
            internalParams.createMarketParams.asset
        );
        if (!tempData.speedAMMParams.supportedAsset) revert AssetNotSupported();
        if (internalParams.buyinAmount < minBuyinAmount || internalParams.buyinAmount > maxBuyinAmount) {
            revert InvalidBuyinAmount();
        }
        if (
            internalParams.createMarketParams.timeFrame < minTimeFrame ||
            internalParams.createMarketParams.timeFrame > maxTimeFrame
        ) {
            revert InvalidTimeFrame();
        }
        if (
            internalParams.createMarketParams.directions.length < minChainedMarkets ||
            internalParams.createMarketParams.directions.length > maxChainedMarkets
        ) {
            revert InvalidNumberOfDirections();
        }

        tempData.payoutMultiplier = payoutMultipliers[
            uint8(internalParams.createMarketParams.directions.length) - minChainedMarkets
        ];
        tempData.payout = _getPayout(
            internalParams.buyinAmount,
            uint8(internalParams.createMarketParams.directions.length),
            tempData.payoutMultiplier
        );
        tempData.payout = (tempData.payout * (ONE + internalParams.bonus)) / ONE;
        if (tempData.payout > maxProfitPerIndividualMarket) revert ProfitTooHigh();

        currentRisk += (tempData.payout - internalParams.buyinAmount);
        if (currentRisk > maxRisk) revert OutOfLiquidity();
        if (internalParams.transferCollateral) {
            uint totalAmountToTransfer = (internalParams.buyinAmount * (ONE + tempData.speedAMMParams.safeBoxImpact)) / ONE;
            IERC20Upgradeable(internalParams.defaultCollateral).safeTransferFrom(
                internalParams.createMarketParams.user,
                address(this),
                totalAmountToTransfer
            );
        }

        ChainedSpeedMarket csm = ChainedSpeedMarket(Clones.clone(chainedSpeedMarketMastercopy));
        csm.initialize(
            ChainedSpeedMarket.InitParams(
                address(this),
                internalParams.createMarketParams.user,
                internalParams.createMarketParams.asset,
                internalParams.createMarketParams.timeFrame,
                uint64(block.timestamp + internalParams.createMarketParams.timeFrame),
                uint64(
                    block.timestamp +
                        internalParams.createMarketParams.timeFrame *
                        internalParams.createMarketParams.directions.length
                ), // strike time
                internalParams.createMarketParams.pythPrice.price,
                internalParams.createMarketParams.directions,
                internalParams.buyinAmount,
                tempData.speedAMMParams.safeBoxImpact,
                tempData.payoutMultiplier,
                internalParams.defaultCollateral
            )
        );
        if (internalParams.transferCollateral) {
            IERC20Upgradeable(internalParams.defaultCollateral).safeTransfer(address(csm), tempData.payout);
        } else {
            sUSD.safeTransfer(address(csm), tempData.payout);
        }

        _handleReferrerAndSafeBox(
            internalParams.createMarketParams.user,
            internalParams.createMarketParams.referrer,
            internalParams.buyinAmount,
            tempData.speedAMMParams.safeBoxImpact,
            internalParams.defaultCollateral,
            contractsAddresses
        );

        _activeMarkets.add(address(csm));
        _activeMarketsPerUser[internalParams.createMarketParams.user].add(address(csm));

        emit MarketCreated(
            address(csm),
            internalParams.createMarketParams.user,
            internalParams.createMarketParams.asset,
            internalParams.createMarketParams.timeFrame,
            uint64(
                block.timestamp +
                    internalParams.createMarketParams.timeFrame *
                    internalParams.createMarketParams.directions.length
            ), // strike time
            internalParams.createMarketParams.pythPrice.price,
            internalParams.createMarketParams.directions,
            internalParams.buyinAmount,
            tempData.payoutMultiplier,
            tempData.speedAMMParams.safeBoxImpact
        );
    }

    /// @notice resolveMarket resolves an active market
    /// @param market address of the market
    function resolveMarket(address market, bytes[][] calldata priceUpdateData) external payable nonReentrant notPaused {
        _resolveMarket(market, priceUpdateData);
    }

    /// @notice resolveMarketWithOfframp resolves an active market with offramp
    /// @param market address of the market
    /// @param priceUpdateData price update data
    /// @param collateral collateral address
    /// @param toEth whether to offramp to ETH
    function resolveMarketWithOfframp(
        address market,
        bytes[][] calldata priceUpdateData,
        address collateral,
        bool toEth
    ) external payable nonReentrant notPaused {
        address user = ChainedSpeedMarket(market).user();
        if (msg.sender != user) revert OnlyMarketOwner();
        IERC20Upgradeable defaultCollateral = IERC20Upgradeable(ChainedSpeedMarket(market).collateral());
        if (address(defaultCollateral) != address(sUSD)) revert InvalidOffRampCollateral();
        uint amountBefore = sUSD.balanceOf(user);
        _resolveMarket(market, priceUpdateData);
        uint amountDiff = sUSD.balanceOf(user) - amountBefore;
        sUSD.safeTransferFrom(user, address(this), amountDiff);
        if (amountDiff > 0) {
            IMultiCollateralOnOffRamp multiCollateralOnOffRamp = IMultiCollateralOnOffRamp(
                addressManager.multiCollateralOnOffRamp()
            );
            if (toEth) {
                uint offramped = multiCollateralOnOffRamp.offrampIntoEth(amountDiff);
                address payable _to = payable(user);
                bool sent = _to.send(offramped);
                if (!sent) revert EtherTransferFailed();
            } else {
                uint offramped = multiCollateralOnOffRamp.offramp(collateral, amountDiff);
                IERC20Upgradeable(collateral).safeTransfer(user, offramped);
            }
        }
    }

    /// @notice resolveMarkets in a batch
    /// @param markets markets to resolve
    /// @param priceUpdateData price update data
    function resolveMarketsBatch(address[] calldata markets, bytes[][][] calldata priceUpdateData)
        external
        payable
        nonReentrant
        notPaused
    {
        for (uint i; i < markets.length; ++i) {
            if (canResolveMarket(markets[i])) {
                _resolveMarket(markets[i], priceUpdateData[i]);
            }
        }
    }

    function _resolveMarket(address market, bytes[][] memory priceUpdateData) internal {
        if (!canResolveMarket(market)) revert CanNotResolve();

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();
        ISpeedMarketsAMM speedMarketsAMM = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = speedMarketsAMM.assetToPythId(ChainedSpeedMarket(market).asset());

        int64[] memory prices = new int64[](priceUpdateData.length);
        uint64 strikeTimePerDirection;
        for (uint i; i < priceUpdateData.length; ++i) {
            strikeTimePerDirection =
                ChainedSpeedMarket(market).initialStrikeTime() +
                uint64(i * ChainedSpeedMarket(market).timeFrame());

            IPyth pyth = IPyth(contractsAddresses.pyth);
            PythStructs.PriceFeed[] memory pricesPerDirection = pyth.parsePriceFeedUpdates{
                value: pyth.getUpdateFee(priceUpdateData[i])
            }(
                priceUpdateData[i],
                priceIds,
                strikeTimePerDirection,
                strikeTimePerDirection + speedMarketsAMM.maximumPriceDelayForResolving()
            );

            PythStructs.Price memory price = pricesPerDirection[0].price;
            if (price.price <= 0) revert InvalidPrice();
            prices[i] = price.price;
        }

        _resolveMarketWithPrices(market, prices, false);
    }

    /// @notice admin resolve market for a given market address with finalPrice
    function resolveMarketManually(address _market, int64[] calldata _finalPrices) external isAddressWhitelisted {
        _resolveMarketManually(_market, _finalPrices);
    }

    /// @notice admin resolve for a given markets with finalPrices
    function resolveMarketManuallyBatch(address[] calldata markets, int64[][] calldata finalPrices)
        external
        isAddressWhitelisted
    {
        for (uint i; i < markets.length; ++i) {
            if (canResolveMarket(markets[i])) {
                _resolveMarketManually(markets[i], finalPrices[i]);
            }
        }
    }

    function _resolveMarketManually(address _market, int64[] calldata _finalPrices) internal {
        if (!canResolveMarket(_market)) revert CanNotResolve();
        _resolveMarketWithPrices(_market, _finalPrices, true);
    }

    /// @notice owner can resolve market for a given market address with finalPrices
    function resolveMarketAsOwner(address _market, int64[] calldata _finalPrices) external onlyOwner {
        if (!canResolveMarket(_market)) revert CanNotResolve();
        _resolveMarketWithPrices(_market, _finalPrices, false);
    }

    function _resolveMarketWithPrices(
        address market,
        int64[] memory _finalPrices,
        bool _isManually
    ) internal {
        ChainedSpeedMarket(market).resolve(_finalPrices, _isManually);
        if (ChainedSpeedMarket(market).resolved()) {
            _activeMarkets.remove(market);
            _maturedMarkets.add(market);
            address user = ChainedSpeedMarket(market).user();

            if (_activeMarketsPerUser[user].contains(market)) {
                _activeMarketsPerUser[user].remove(market);
            }
            _maturedMarketsPerUser[user].add(market);

            uint buyinAmount = ChainedSpeedMarket(market).buyinAmount();
            uint payout = _getPayout(
                buyinAmount,
                ChainedSpeedMarket(market).numOfDirections(),
                ChainedSpeedMarket(market).payoutMultiplier()
            );

            if (!ChainedSpeedMarket(market).isUserWinner()) {
                if (currentRisk > payout) {
                    currentRisk -= payout;
                } else {
                    currentRisk = 0;
                }
            }
        }

        emit MarketResolved(market, ChainedSpeedMarket(market).isUserWinner());
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
            (ChainedSpeedMarket(market).initialStrikeTime() < block.timestamp) &&
            !ChainedSpeedMarket(market).resolved();
    }

    /// @notice get lengths of all arrays
    function getLengths(address user) external view returns (uint[4] memory) {
        return [
            _activeMarkets.elements.length,
            _maturedMarkets.elements.length,
            _activeMarketsPerUser[user].elements.length,
            _maturedMarketsPerUser[user].elements.length
        ];
    }

    //////////////////setters/////////////////

    /// @notice Set mastercopy to use to create markets
    /// @param _mastercopy to use to create markets
    function setMastercopy(address _mastercopy) external onlyOwner {
        chainedSpeedMarketMastercopy = _mastercopy;
        emit MastercopyChanged(_mastercopy);
    }

    /// @notice Set parameters for limits and payout
    function setLimitParams(
        uint64 _minTimeFrame,
        uint64 _maxTimeFrame,
        uint _minChainedMarkets,
        uint _maxChainedMarkets,
        uint _minBuyinAmount,
        uint _maxBuyinAmount,
        uint _maxProfitPerIndividualMarket,
        uint _maxRisk,
        uint[] calldata _payoutMultipliers
    ) external onlyOwner {
        if (_minChainedMarkets <= 1) revert MinChainedMarketsError();
        minTimeFrame = _minTimeFrame;
        maxTimeFrame = _maxTimeFrame;
        minChainedMarkets = _minChainedMarkets;
        maxChainedMarkets = _maxChainedMarkets;
        minBuyinAmount = _minBuyinAmount;
        maxBuyinAmount = _maxBuyinAmount;
        maxProfitPerIndividualMarket = _maxProfitPerIndividualMarket;
        maxRisk = _maxRisk;
        currentRisk = 0;
        payoutMultipliers = _payoutMultipliers;
        emit LimitParamsChanged(
            _minTimeFrame,
            _maxTimeFrame,
            _minChainedMarkets,
            _maxChainedMarkets,
            _minBuyinAmount,
            _maxBuyinAmount,
            _maxProfitPerIndividualMarket,
            _maxRisk,
            _payoutMultipliers
        );
    }

    /// @notice set address manager contract address
    function setAddressManager(address _addressManager) external onlyOwner {
        addressManager = IAddressManager(_addressManager);
        emit AddressManagerChanged(_addressManager);
    }

    /// @notice set sUSD address (default collateral)
    function setSusdAddress(address _sUSD) external onlyOwner {
        sUSD = IERC20Upgradeable(_sUSD);
        emit SusdAddressChanged(_sUSD);
    }

    /// @notice set multicollateral enabled
    function setMultiCollateralOnOffRampEnabled(bool _enabled) external onlyOwner {
        address multiCollateralOnOffRamp = addressManager.multiCollateralOnOffRamp();
        if (multiCollateralOnOffRamp != address(0)) {
            sUSD.approve(multiCollateralOnOffRamp, _enabled ? MAX_APPROVAL : 0);
        }
        multicollateralEnabled = _enabled;
        emit MultiCollateralOnOffRampEnabled(_enabled);
    }

    //////////////////modifiers/////////////////

    modifier isAddressWhitelisted() {
        ISpeedMarketsAMM speedMarketsAMM = ISpeedMarketsAMM(addressManager.speedMarketsAMM());
        if (!speedMarketsAMM.whitelistedAddresses(msg.sender)) revert ResolverNotWhitelisted();
        _;
    }

    modifier onlyPending() {
        address speedMarketsCreator = addressManager.getAddress("SpeedMarketsAMMCreator");
        if (msg.sender != speedMarketsCreator) revert OnlyCreatorAllowed();
        _;
    }

    //////////////////events/////////////////

    event MarketCreated(
        address market,
        address user,
        bytes32 asset,
        uint64 timeFrame,
        uint64 strikeTime,
        int64 strikePrice,
        SpeedMarket.Direction[] directions,
        uint buyinAmount,
        uint payoutMultiplier,
        uint safeBoxImpact
    );

    event MarketResolved(address market, bool userIsWinner);

    event MastercopyChanged(address mastercopy);
    event LimitParamsChanged(
        uint64 _minTimeFrame,
        uint64 _maxTimeFrame,
        uint _minChainedMarkets,
        uint _maxChainedMarkets,
        uint _minBuyinAmount,
        uint _maxBuyinAmount,
        uint _maxProfitPerIndividualMarket,
        uint _maxRisk,
        uint[] _payoutMultipliers
    );
    event ReferrerPaid(address refferer, address trader, uint amount, uint volume);
    event SusdAddressChanged(address _sUSD);
    event MultiCollateralOnOffRampEnabled(bool _enabled);
    event AmountTransfered(address _destination, uint _amount);
    event AddressManagerChanged(address _addressManager);
}

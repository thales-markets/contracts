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

/// @title An AMM for Overtime Speed Markets
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
    error CanOnlyBeCalledFromResolver();
    error OnlyCreatorAllowed();
    error OnlyMarketOwner();
    error EtherTransferFailed();
    error InvalidOffRampCollateral();
    error MinChainedMarketsError();
    error OnlyWhitelistedAddresses();

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
        int64 strikePrice;
        ISpeedMarketsAMM.OracleSource oracleSource;
        SpeedMarket.Direction[] directions;
        address collateral;
        uint collateralAmount;
        address referrer;
    }

    struct InternalCreateMarketParams {
        CreateMarketParams createMarketParams;
        uint buyinAmount;
        uint buyinAmountInUSD;
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

    function createNewMarket(CreateMarketParams calldata _params)
        external
        nonReentrant
        notPaused
        onlyPending
        returns (address marketAddress)
    {
        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();
        // Determine collateral configuration
        (
            bool isNativeCollateral,
            address defaultCollateral,
            uint buyinAmount,
            uint buyinAmountInUSD,
            uint bonus
        ) = _determineCollateralConfig(_params, contractsAddresses);
        InternalCreateMarketParams memory internalParams = InternalCreateMarketParams({
            createMarketParams: _params,
            buyinAmount: buyinAmount,
            buyinAmountInUSD: buyinAmountInUSD,
            bonus: bonus,
            transferCollateral: isNativeCollateral,
            defaultCollateral: defaultCollateral
        });

        marketAddress = _createNewMarket(internalParams, contractsAddresses);
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
            uint buyinAmountInUSD,
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
            buyinAmount = buyinAmountInUSD = _params.collateralAmount;
            if (defaultCollateral != address(sUSD)) {
                buyinAmountInUSD = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM)
                    .speedMarketsAMMUtils()
                    .transformCollateralToUSD(defaultCollateral, address(sUSD), _params.collateralAmount);
            }
        } else {
            // For external collaterals, convert through onramp
            buyinAmount = buyinAmountInUSD = _getBuyinWithConversion(
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
    ) internal returns (address) {
        TempData memory tempData;
        tempData.speedAMMParams = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM).getParams(
            internalParams.createMarketParams.asset
        );
        if (!tempData.speedAMMParams.supportedAsset) revert AssetNotSupported();
        if (internalParams.buyinAmountInUSD < minBuyinAmount || internalParams.buyinAmountInUSD > maxBuyinAmount) {
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
        if (internalParams.bonus > 0) {
            tempData.payout = (tempData.payout * (ONE + internalParams.bonus)) / ONE;
        }

        {
            uint payoutInUSD = internalParams.defaultCollateral == address(sUSD)
                ? tempData.payout
                : ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM).speedMarketsAMMUtils().transformCollateralToUSD(
                    internalParams.defaultCollateral,
                    address(sUSD),
                    tempData.payout
                );
            if (payoutInUSD > maxProfitPerIndividualMarket) revert ProfitTooHigh();
            currentRisk += (payoutInUSD - internalParams.buyinAmountInUSD);
            if (currentRisk > maxRisk) revert OutOfLiquidity();
        }

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
                internalParams.createMarketParams.strikePrice,
                internalParams.createMarketParams.oracleSource,
                internalParams.createMarketParams.directions,
                internalParams.buyinAmount,
                tempData.speedAMMParams.safeBoxImpact,
                tempData.payoutMultiplier,
                internalParams.defaultCollateral,
                tempData.payout
            )
        );
        if (internalParams.transferCollateral && internalParams.defaultCollateral != address(sUSD)) {
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
            internalParams.createMarketParams.strikePrice,
            internalParams.createMarketParams.directions,
            internalParams.buyinAmount,
            tempData.payoutMultiplier,
            tempData.speedAMMParams.safeBoxImpact
        );
        return address(csm);
    }

    /// @notice resolver or owner can resolve market for a given market address with finalPrices
    function resolveMarketWithPrices(
        address _market,
        int64[] calldata _finalPrices,
        bool _isManually
    ) external {
        if (msg.sender != addressManager.getAddress("SpeedMarketsAMMResolver") && msg.sender != owner)
            revert CanOnlyBeCalledFromResolver();
        if (!canResolveMarket(_market)) revert CanNotResolve();
        _isManually = msg.sender == owner ? false : _isManually;
        _resolveMarketWithPrices(_market, _finalPrices, _isManually);
    }

    function _resolveMarketWithPrices(
        address market,
        int64[] memory _finalPrices,
        bool _isManually
    ) internal {
        ChainedSpeedMarket csm = ChainedSpeedMarket(market);
        csm.resolve(_finalPrices, _isManually);
        if (csm.resolved()) {
            _activeMarkets.remove(market);
            _maturedMarkets.add(market);
            address user = csm.user();

            if (_activeMarketsPerUser[user].contains(market)) {
                _activeMarketsPerUser[user].remove(market);
            }
            _maturedMarketsPerUser[user].add(market);

            uint buyinAmount = csm.buyinAmount();
            uint payout = _getPayout(buyinAmount, csm.numOfDirections(), csm.payoutMultiplier());
            IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();

            uint collateralBonus = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM).bonusPerCollateral(csm.collateral());
            if (collateralBonus > 0) {
                payout = (payout * (ONE + collateralBonus)) / ONE;
            }

            uint payoutInUSD = csm.collateral() == address(sUSD)
                ? payout
                : ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM).speedMarketsAMMUtils().transformCollateralToUSD(
                    csm.collateral(),
                    address(sUSD),
                    payout
                );

            if (!csm.isUserWinner()) {
                if (currentRisk > payoutInUSD) {
                    currentRisk -= payoutInUSD;
                } else {
                    currentRisk = 0;
                }
            }
        }

        emit MarketResolved(market, csm.isUserWinner());
    }

    function offrampHelper(address user, uint amount) external {
        if (msg.sender != addressManager.getAddress("SpeedMarketsAMMResolver")) revert CanOnlyBeCalledFromResolver();
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
        if (!_activeMarkets.contains(market)) return false;

        ChainedSpeedMarket chainedMarket = ChainedSpeedMarket(market);
        if (chainedMarket.resolved()) return false;

        // For chained markets, we need to wait for all strike times to pass
        // This means initialStrikeTime + (timeFrame * (numOfDirections - 1))
        uint256 finalStrikeTime = chainedMarket.initialStrikeTime() +
            (chainedMarket.timeFrame() * (chainedMarket.numOfDirections() - 1));

        return block.timestamp > finalStrikeTime;
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
    event AmountTransfered(address _collateral, address _destination, uint _amount);
    event AddressManagerChanged(address _addressManager);
}

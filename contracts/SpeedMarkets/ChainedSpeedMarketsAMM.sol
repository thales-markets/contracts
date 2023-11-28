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

    uint public payoutMultiplier;

    uint public maxRisk;
    uint public currentRisk;

    address public chainedSpeedMarketMastercopy;

    bool public multicollateralEnabled;

    /// @return The address of the address manager contract
    IAddressManager public addressManager;

    // using this to solve stack too deep
    struct TempData {
        uint payout;
        PythStructs.Price pythPrice;
        ISpeedMarketsAMM.Params speedAMMParams;
    }

    receive() external payable {}

    function initialize(address _owner, IERC20Upgradeable _sUSD) external initializer {
        setOwner(_owner);
        initNonReentrant();
        sUSD = _sUSD;
    }

    function createNewMarket(
        bytes32 asset,
        uint64 timeFrame,
        SpeedMarket.Direction[] calldata directions,
        uint buyinAmount,
        bytes[] calldata priceUpdateData,
        address referrer
    ) external payable nonReentrant notPaused {
        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();
        _createNewMarket(asset, timeFrame, directions, buyinAmount, priceUpdateData, true, referrer, contractsAddresses);
    }

    function createNewMarketWithDifferentCollateral(
        bytes32 asset,
        uint64 timeFrame,
        SpeedMarket.Direction[] calldata directions,
        bytes[] calldata priceUpdateData,
        address collateral,
        uint collateralAmount,
        bool isEth,
        address referrer
    ) external payable nonReentrant notPaused {
        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();
        uint buyinAmount = _getBuyinWithConversion(collateral, collateralAmount, isEth, contractsAddresses);
        _createNewMarket(asset, timeFrame, directions, buyinAmount, priceUpdateData, false, referrer, contractsAddresses);
    }

    function _getBuyinWithConversion(
        address collateral,
        uint collateralAmount,
        bool isEth,
        IAddressManager.Addresses memory contractsAddresses
    ) internal returns (uint buyinAmount) {
        require(multicollateralEnabled, "Multicollateral onramp not enabled");
        uint amountBefore = sUSD.balanceOf(address(this));

        IMultiCollateralOnOffRamp multiCollateralOnOffRamp = IMultiCollateralOnOffRamp(
            contractsAddresses.multiCollateralOnOffRamp
        );

        uint convertedAmount;
        if (isEth) {
            convertedAmount = multiCollateralOnOffRamp.onrampWithEth{value: collateralAmount}(collateralAmount);
        } else {
            IERC20Upgradeable(collateral).safeTransferFrom(msg.sender, address(this), collateralAmount);
            IERC20Upgradeable(collateral).approve(address(multiCollateralOnOffRamp), collateralAmount);
            convertedAmount = multiCollateralOnOffRamp.onramp(collateral, collateralAmount);
        }

        ISpeedMarketsAMM speedMarketsAMM = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM);
        buyinAmount = (convertedAmount * (ONE - speedMarketsAMM.safeBoxImpact())) / ONE;

        uint amountDiff = sUSD.balanceOf(address(this)) - amountBefore;
        require(amountDiff >= buyinAmount, "not enough received via onramp");
    }

    function _getPayout(
        uint _buyinAmount,
        uint8 _numOfDirections,
        uint _payoutMultiplier
    ) internal pure returns (uint payout) {
        payout = _buyinAmount;
        for (uint8 i = 0; i < _numOfDirections; i++) {
            payout = (payout * _payoutMultiplier) / ONE;
        }
    }

    function _handleReferrerAndSafeBox(
        address referrer,
        uint buyinAmount,
        uint safeBoxImpact,
        IAddressManager.Addresses memory contractsAddresses
    ) internal returns (uint referrerShare) {
        IReferrals referrals = IReferrals(contractsAddresses.referrals);
        if (address(referrals) != address(0)) {
            address newOrExistingReferrer;
            if (referrer != address(0)) {
                referrals.setReferrer(referrer, msg.sender);
                newOrExistingReferrer = referrer;
            } else {
                newOrExistingReferrer = referrals.referrals(msg.sender);
            }

            if (newOrExistingReferrer != address(0)) {
                uint referrerFeeByTier = referrals.getReferrerFee(newOrExistingReferrer);
                if (referrerFeeByTier > 0) {
                    referrerShare = (buyinAmount * referrerFeeByTier) / ONE;
                    sUSD.safeTransfer(newOrExistingReferrer, referrerShare);
                    emit ReferrerPaid(newOrExistingReferrer, msg.sender, referrerShare, buyinAmount);
                }
            }
        }

        sUSD.safeTransfer(contractsAddresses.safeBox, (buyinAmount * safeBoxImpact) / ONE - referrerShare);
    }

    function _createNewMarket(
        bytes32 asset,
        uint64 timeFrame,
        SpeedMarket.Direction[] calldata directions,
        uint buyinAmount,
        bytes[] memory priceUpdateData,
        bool transferSusd,
        address referrer,
        IAddressManager.Addresses memory contractsAddresses
    ) internal {
        TempData memory tempData;
        tempData.speedAMMParams = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM).getParams(asset);
        require(tempData.speedAMMParams.supportedAsset, "Asset is not supported");
        require(buyinAmount >= minBuyinAmount && buyinAmount <= maxBuyinAmount, "Wrong buy in amount");
        require(timeFrame >= minTimeFrame && timeFrame <= maxTimeFrame, "Wrong time frame");
        require(
            directions.length >= minChainedMarkets && directions.length <= maxChainedMarkets,
            "Wrong number of directions"
        );

        tempData.payout = _getPayout(buyinAmount, uint8(directions.length), payoutMultiplier);
        require(tempData.payout <= maxProfitPerIndividualMarket, "Profit too high");

        currentRisk += (tempData.payout - buyinAmount);
        require(currentRisk <= maxRisk, "Out of liquidity");

        IPyth(contractsAddresses.pyth).updatePriceFeeds{value: IPyth(contractsAddresses.pyth).getUpdateFee(priceUpdateData)}(
            priceUpdateData
        );

        tempData.pythPrice = IPyth(contractsAddresses.pyth).getPriceUnsafe(tempData.speedAMMParams.pythId);
        require(
            (tempData.pythPrice.publishTime + tempData.speedAMMParams.maximumPriceDelay) > block.timestamp &&
                tempData.pythPrice.price > 0,
            "Stale price"
        );

        if (transferSusd) {
            uint totalAmountToTransfer = (buyinAmount * (ONE + tempData.speedAMMParams.safeBoxImpact)) / ONE;
            sUSD.safeTransferFrom(msg.sender, address(this), totalAmountToTransfer);
        }

        ChainedSpeedMarket csm = ChainedSpeedMarket(Clones.clone(chainedSpeedMarketMastercopy));
        csm.initialize(
            ChainedSpeedMarket.InitParams(
                address(this),
                msg.sender,
                asset,
                timeFrame,
                uint64(block.timestamp + timeFrame),
                uint64(block.timestamp + timeFrame * directions.length), // strike time
                tempData.pythPrice.price,
                directions,
                buyinAmount,
                tempData.speedAMMParams.safeBoxImpact,
                payoutMultiplier
            )
        );

        sUSD.safeTransfer(address(csm), tempData.payout);

        _handleReferrerAndSafeBox(referrer, buyinAmount, tempData.speedAMMParams.safeBoxImpact, contractsAddresses);

        _activeMarkets.add(address(csm));
        _activeMarketsPerUser[msg.sender].add(address(csm));

        if (contractsAddresses.stakingThales != address(0)) {
            IStakingThales(contractsAddresses.stakingThales).updateVolume(msg.sender, buyinAmount);
        }

        emit MarketCreated(
            address(csm),
            msg.sender,
            asset,
            timeFrame,
            uint64(block.timestamp + timeFrame * directions.length), // strike time
            tempData.pythPrice.price,
            directions,
            buyinAmount,
            payoutMultiplier,
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
    function resolveMarketWithOfframp(
        address market,
        bytes[][] calldata priceUpdateData,
        address collateral,
        bool toEth
    ) external payable nonReentrant notPaused {
        address user = ChainedSpeedMarket(market).user();
        require(msg.sender == user, "Only allowed from market owner");
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
                require(sent, "Failed to send Ether");
            } else {
                uint offramped = multiCollateralOnOffRamp.offramp(collateral, amountDiff);
                IERC20Upgradeable(collateral).safeTransfer(user, offramped);
            }
        }
    }

    /// @notice resolveMarkets in a batch
    function resolveMarketsBatch(address[] calldata markets, bytes[][][] calldata priceUpdateData)
        external
        payable
        nonReentrant
        notPaused
    {
        for (uint i = 0; i < markets.length; i++) {
            if (canResolveMarket(markets[i])) {
                _resolveMarket(markets[i], priceUpdateData[i]);
            }
        }
    }

    function _resolveMarket(address market, bytes[][] memory priceUpdateData) internal {
        require(canResolveMarket(market), "Can not resolve");

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();
        ISpeedMarketsAMM speedMarketsAMM = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = speedMarketsAMM.assetToPythId(ChainedSpeedMarket(market).asset());

        int64[] memory prices = new int64[](priceUpdateData.length);
        uint64 strikeTimePerDirection;
        for (uint i = 0; i < priceUpdateData.length; i++) {
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
            require(price.price > 0, "invalid price");
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
        for (uint i = 0; i < markets.length; i++) {
            if (canResolveMarket(markets[i])) {
                _resolveMarketManually(markets[i], finalPrices[i]);
            }
        }
    }

    function _resolveMarketManually(address _market, int64[] calldata _finalPrices) internal {
        require(canResolveMarket(_market), "Can not resolve");
        _resolveMarketWithPrices(_market, _finalPrices, true);
    }

    /// @notice owner can resolve market for a given market address with finalPrices
    function resolveMarketAsOwner(address _market, int64[] calldata _finalPrices) external onlyOwner {
        require(canResolveMarket(_market), "Can not resolve");
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
            uint payout = _getPayout(buyinAmount, ChainedSpeedMarket(market).numOfDirections(), payoutMultiplier);

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
        uint _payoutMultiplier
    ) external onlyOwner {
        require(_minChainedMarkets > 1, "min 2 chained markets");
        minTimeFrame = _minTimeFrame;
        maxTimeFrame = _maxTimeFrame;
        minChainedMarkets = _minChainedMarkets;
        maxChainedMarkets = _maxChainedMarkets;
        minBuyinAmount = _minBuyinAmount;
        maxBuyinAmount = _maxBuyinAmount;
        maxProfitPerIndividualMarket = _maxProfitPerIndividualMarket;
        maxRisk = _maxRisk;
        payoutMultiplier = _payoutMultiplier;
        emit LimitParamsChanged(
            _minTimeFrame,
            _maxTimeFrame,
            _minChainedMarkets,
            _maxChainedMarkets,
            _minBuyinAmount,
            _maxBuyinAmount,
            _maxProfitPerIndividualMarket,
            _maxRisk,
            _payoutMultiplier
        );
    }

    /// @notice set address manager contract address
    function setAddressManager(address _addressManager) external onlyOwner {
        addressManager = IAddressManager(_addressManager);
        emit AddressManagerChanged(_addressManager);
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
        require(speedMarketsAMM.whitelistedAddresses(msg.sender), "Resolver not whitelisted");
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
        uint _payoutMultiplier
    );
    event ReferrerPaid(address refferer, address trader, uint amount, uint volume);
    event MultiCollateralOnOffRampEnabled(bool _enabled);
    event AmountTransfered(address _destination, uint _amount);
    event AddressManagerChanged(address _addressManager);
}

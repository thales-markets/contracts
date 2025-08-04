// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

import "../interfaces/IAddressManager.sol";
import "../interfaces/ISpeedMarketsAMM.sol";
import "../interfaces/IMultiCollateralOnOffRamp.sol";
import "../interfaces/IChainedSpeedMarketsAMM.sol";
import "../interfaces/IFreeBetsHolder.sol";

import "./SpeedMarket.sol";
import "./ChainedSpeedMarket.sol";

/// @title An AMM for Overtime Speed Markets
contract SpeedMarketsAMMResolver is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint private constant ONE = 1e18;
    uint private constant MAX_APPROVAL = type(uint256).max;

    /// ========== Custom Errors ==========
    error InvalidWhitelistAddress();
    error OnlyMarketOwner();
    error EtherTransferFailed();
    error MismatchedLengths();
    error CollateralNotSupported();
    error InvalidOffRampCollateral();
    error CanNotResolve();
    error InvalidPrice();
    error MulticollateralOnrampDisabled();

    /// @return The address of the address manager contract
    IAddressManager public addressManager;
    ISpeedMarketsAMM public speedMarketsAMM;
    IChainedSpeedMarketsAMM public chainedSpeedMarketsAMM;

    receive() external payable {}

    function initialize(
        address _owner,
        address _speedMarketsAMM,
        address _addressManager
    ) external initializer {
        setOwner(_owner);
        speedMarketsAMM = ISpeedMarketsAMM(_speedMarketsAMM);
        addressManager = IAddressManager(_addressManager);
        chainedSpeedMarketsAMM = IChainedSpeedMarketsAMM(addressManager.getAddress("ChainedSpeedMarketsAMM"));
        address multiCollateralAddress = addressManager.multiCollateralOnOffRamp();
        if (multiCollateralAddress != address(0)) {
            speedMarketsAMM.sUSD().approve(multiCollateralAddress, MAX_APPROVAL);
            chainedSpeedMarketsAMM.sUSD().approve(multiCollateralAddress, MAX_APPROVAL);
        }
        initNonReentrant();
    }

    /// ========== EXTERNAL FUNCTIONS ==========

    /// @notice resolveMarket resolves an active market
    /// @param market address of the market
    /// @param priceUpdateData price update data
    /// @dev priceUpdateData is an array of bytes, each element is a price update data for a market
    function resolveMarket(address market, bytes[] calldata priceUpdateData) external payable nonReentrant notPaused {
        _resolveMarket(market, priceUpdateData);
    }

    /// @notice resolveMarket resolves an active market with offramp
    /// @param market address of the market
    /// @param priceUpdateData price update data
    /// @param collateral collateral address
    /// @param toEth whether to offramp to ETH
    /// @dev priceUpdateData is an array of bytes, each element is a price update data for a market
    function resolveMarketWithOfframp(
        address market,
        bytes[] calldata priceUpdateData,
        address collateral,
        bool toEth
    ) external payable nonReentrant notPaused {
        if (!speedMarketsAMM.multicollateralEnabled()) revert MulticollateralOnrampDisabled();
        _resolveMarketWithOfframp(market, priceUpdateData, collateral, toEth);
    }

    /// @notice resolveMarkets in a batch
    /// @param markets array of market addresses
    /// @param priceUpdateData array of price update data
    /// @dev priceUpdateData is an array of bytes, each element is a price update data for a market
    function resolveMarketsBatch(address[] calldata markets, bytes[] calldata priceUpdateData)
        external
        payable
        nonReentrant
        notPaused
    {
        for (uint i; i < markets.length; ++i) {
            if (speedMarketsAMM.canResolveMarket(markets[i])) {
                bytes[] memory subarray = new bytes[](1);
                subarray[0] = priceUpdateData[i];
                _resolveMarket(markets[i], subarray);
            }
        }
    }

    /// @notice resolveMarkets in a batch
    /// @param markets array of market addresses
    /// @param priceUpdateData array of price update data
    /// @param collateral collateral address
    /// @param toEth whether to offramp to ETH
    /// @dev priceUpdateData is an array of bytes, each element is a price update data for a market
    function resolveMarketsBatchOffRamp(
        address[] calldata markets,
        bytes[] calldata priceUpdateData,
        address collateral,
        bool toEth
    ) external payable nonReentrant notPaused {
        if (!speedMarketsAMM.multicollateralEnabled()) revert MulticollateralOnrampDisabled();
        for (uint i; i < markets.length; ++i) {
            if (speedMarketsAMM.canResolveMarket(markets[i])) {
                bytes[] memory subarray = new bytes[](1);
                subarray[0] = priceUpdateData[i];
                _resolveMarketWithOfframp(markets[i], subarray, collateral, toEth);
            }
        }
    }

    /// @notice admin resolve market for a given market address with finalPrice
    /// @param _market market address
    /// @param _finalPrice final price
    function resolveMarketManually(address _market, int64 _finalPrice) external {
        if (!speedMarketsAMM.whitelistedAddresses(msg.sender)) revert InvalidWhitelistAddress();
        _resolveMarketManually(_market, _finalPrice);
    }

    /// @notice admin resolve for a given markets with finalPrices
    /// @param markets array of market addresses
    /// @param finalPrices array of final prices
    function resolveMarketManuallyBatch(address[] calldata markets, int64[] calldata finalPrices) external {
        if (!speedMarketsAMM.whitelistedAddresses(msg.sender)) revert InvalidWhitelistAddress();
        uint len = markets.length;
        for (uint i; i < len; ++i) {
            address market = markets[i];
            if (speedMarketsAMM.canResolveMarket(market)) {
                _resolveMarketManually(market, finalPrices[i]);
            }
        }
    }

    /// ========== INTERNAL FUNCTIONS ==========

    function _resolveMarket(address market, bytes[] memory priceUpdateData) internal {
        if (!speedMarketsAMM.canResolveMarket(market)) revert CanNotResolve();
        SpeedMarket sm = SpeedMarket(market);
        IPyth iPyth = IPyth(addressManager.pyth());
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = speedMarketsAMM.assetToPythId(sm.asset());
        uint64 maximumPriceDelayForResolving = speedMarketsAMM.maximumPriceDelayForResolving();
        PythStructs.PriceFeed[] memory prices = iPyth.parsePriceFeedUpdates{value: iPyth.getUpdateFee(priceUpdateData)}(
            priceUpdateData,
            priceIds,
            sm.strikeTime(),
            sm.strikeTime() + maximumPriceDelayForResolving
        );

        PythStructs.Price memory price = prices[0].price;

        if (price.price <= 0) revert InvalidPrice();

        speedMarketsAMM.resolveMarketWithPrice(market, price.price);

        IFreeBetsHolder iFreeBetsHolder = IFreeBetsHolder(addressManager.getAddress("FreeBetsHolder"));
        if (address(sm.user()) == address(iFreeBetsHolder)) {
            iFreeBetsHolder.confirmSpeedMarketResolved(market, 2 * sm.buyinAmount(), sm.buyinAmount(), sm.collateral());
        }
    }

    function _resolveMarketWithOfframp(
        address market,
        bytes[] memory priceUpdateData,
        address collateral,
        bool toEth
    ) internal {
        address user = SpeedMarket(market).user();
        if (msg.sender != user) revert OnlyMarketOwner();
        address defaultCollateral = SpeedMarket(market).collateral();
        if (defaultCollateral != address(speedMarketsAMM.sUSD())) revert InvalidOffRampCollateral();
        uint amountBefore = speedMarketsAMM.sUSD().balanceOf(user);
        _resolveMarket(market, priceUpdateData);
        uint amountDiff = speedMarketsAMM.sUSD().balanceOf(user) - amountBefore;
        speedMarketsAMM.offrampHelper(user, amountDiff);
        if (amountDiff > 0) {
            IMultiCollateralOnOffRamp iMultiCollateralOnOffRamp = IMultiCollateralOnOffRamp(
                addressManager.multiCollateralOnOffRamp()
            );
            if (toEth) {
                uint offramped = iMultiCollateralOnOffRamp.offrampIntoEth(amountDiff);
                address payable _to = payable(user);
                bool sent = _to.send(offramped);
                if (!sent) revert EtherTransferFailed();
            } else {
                uint offramped = iMultiCollateralOnOffRamp.offramp(collateral, amountDiff);
                IERC20Upgradeable(collateral).safeTransfer(user, offramped);
            }
        }
    }

    function _resolveMarketManually(address _market, int64 _finalPrice) internal {
        SpeedMarket.Direction direction = SpeedMarket(_market).direction();
        int64 strikePrice = SpeedMarket(_market).strikePrice();
        bool isUserWinner = (_finalPrice < strikePrice && direction == SpeedMarket.Direction.Down) ||
            (_finalPrice > strikePrice && direction == SpeedMarket.Direction.Up);
        if (!speedMarketsAMM.canResolveMarket(_market) || isUserWinner) revert CanNotResolve();

        speedMarketsAMM.resolveMarketWithPrice(_market, _finalPrice);
    }

    /// ========== CHAINED MARKETS FUNCTIONS ==========

    /// @notice resolveChainedMarket resolves an active chained market
    /// @param market address of the market
    /// @param priceUpdateData price update data for each direction
    /// @dev priceUpdateData is a 2D array where each element contains price update data for a direction
    function resolveChainedMarket(address market, bytes[][] calldata priceUpdateData)
        external
        payable
        nonReentrant
        notPaused
    {
        _resolveChainedMarket(market, priceUpdateData);
    }

    /// @notice resolveChainedMarket resolves an active chained market with offramp
    /// @param market address of the market
    /// @param priceUpdateData price update data for each direction
    /// @param collateral collateral address
    /// @param toEth whether to offramp to ETH
    function resolveChainedMarketWithOfframp(
        address market,
        bytes[][] calldata priceUpdateData,
        address collateral,
        bool toEth
    ) external payable nonReentrant notPaused {
        if (!chainedSpeedMarketsAMM.multicollateralEnabled()) revert MulticollateralOnrampDisabled();
        _resolveChainedMarketWithOfframp(market, priceUpdateData, collateral, toEth);
    }

    /// @notice resolveChainedMarkets in a batch
    /// @param markets array of market addresses
    /// @param priceUpdateData array of price update data for each market
    function resolveChainedMarketsBatch(address[] calldata markets, bytes[][][] calldata priceUpdateData)
        external
        payable
        nonReentrant
        notPaused
    {
        for (uint i; i < markets.length; ++i) {
            if (chainedSpeedMarketsAMM.canResolveMarket(markets[i])) {
                _resolveChainedMarket(markets[i], priceUpdateData[i]);
            }
        }
    }

    /// @notice resolveChainedMarkets in a batch with offramp
    /// @param markets array of market addresses
    /// @param priceUpdateData array of price update data
    /// @param collateral collateral address
    /// @param toEth whether to offramp to ETH
    function resolveChainedMarketsBatchOffRamp(
        address[] calldata markets,
        bytes[][][] calldata priceUpdateData,
        address collateral,
        bool toEth
    ) external payable nonReentrant notPaused {
        if (!chainedSpeedMarketsAMM.multicollateralEnabled()) revert MulticollateralOnrampDisabled();
        for (uint i; i < markets.length; ++i) {
            if (chainedSpeedMarketsAMM.canResolveMarket(markets[i])) {
                _resolveChainedMarketWithOfframp(markets[i], priceUpdateData[i], collateral, toEth);
            }
        }
    }

    /// @notice admin resolve chained market for a given market address with finalPrices
    /// @param _market market address
    /// @param _finalPrices array of final prices for each direction
    function resolveChainedMarketManually(address _market, int64[] calldata _finalPrices) external {
        if (!speedMarketsAMM.whitelistedAddresses(msg.sender)) revert InvalidWhitelistAddress();
        _resolveChainedMarketManually(_market, _finalPrices);
    }

    /// @notice admin resolve for a given chained markets with finalPrices
    /// @param markets array of market addresses
    /// @param finalPrices array of final prices for each market
    function resolveChainedMarketManuallyBatch(address[] calldata markets, int64[][] calldata finalPrices) external {
        if (!speedMarketsAMM.whitelistedAddresses(msg.sender)) revert InvalidWhitelistAddress();
        uint len = markets.length;
        for (uint i; i < len; ++i) {
            address market = markets[i];
            if (chainedSpeedMarketsAMM.canResolveMarket(market)) {
                _resolveChainedMarketManually(market, finalPrices[i]);
            }
        }
    }

    /// ========== INTERNAL CHAINED MARKETS FUNCTIONS ==========

    function _resolveChainedMarket(address market, bytes[][] memory priceUpdateData) internal {
        if (!chainedSpeedMarketsAMM.canResolveMarket(market)) revert CanNotResolve();

        IPyth iPyth = IPyth(addressManager.pyth());
        bytes32[] memory priceIds = new bytes32[](1);
        ChainedSpeedMarket cs = ChainedSpeedMarket(market);
        priceIds[0] = speedMarketsAMM.assetToPythId(cs.asset());

        int64[] memory prices = new int64[](priceUpdateData.length);
        uint64 strikeTimePerDirection;
        for (uint i; i < priceUpdateData.length; ++i) {
            strikeTimePerDirection = cs.initialStrikeTime() + uint64(i * cs.timeFrame());

            PythStructs.PriceFeed[] memory pricesPerDirection = iPyth.parsePriceFeedUpdates{
                value: iPyth.getUpdateFee(priceUpdateData[i])
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

        chainedSpeedMarketsAMM.resolveMarketWithPrices(market, prices, false);

        IFreeBetsHolder iFreeBetsHolder = IFreeBetsHolder(addressManager.getAddress("FreeBetsHolder"));
        if (cs.user() == address(iFreeBetsHolder)) {
            iFreeBetsHolder.confirmSpeedMarketResolved(
                market,
                _getPayout(cs.buyinAmount(), uint8(cs.numOfDirections()), cs.payoutMultiplier()),
                cs.buyinAmount(),
                cs.collateral()
            );
        }
    }

    function _resolveChainedMarketWithOfframp(
        address market,
        bytes[][] memory priceUpdateData,
        address collateral,
        bool toEth
    ) internal {
        address user = ChainedSpeedMarket(market).user();
        if (msg.sender != user) revert OnlyMarketOwner();
        IERC20Upgradeable defaultCollateral = IERC20Upgradeable(ChainedSpeedMarket(market).collateral());
        if (address(defaultCollateral) != address(chainedSpeedMarketsAMM.sUSD())) revert InvalidOffRampCollateral();
        uint amountBefore = chainedSpeedMarketsAMM.sUSD().balanceOf(user);
        _resolveChainedMarket(market, priceUpdateData);
        uint amountDiff = chainedSpeedMarketsAMM.sUSD().balanceOf(user) - amountBefore;
        chainedSpeedMarketsAMM.offrampHelper(user, amountDiff);
        if (amountDiff > 0) {
            IMultiCollateralOnOffRamp iMultiCollateralOnOffRamp = IMultiCollateralOnOffRamp(
                addressManager.multiCollateralOnOffRamp()
            );
            if (toEth) {
                uint offramped = iMultiCollateralOnOffRamp.offrampIntoEth(amountDiff);
                address payable _to = payable(user);
                bool sent = _to.send(offramped);
                if (!sent) revert EtherTransferFailed();
            } else {
                uint offramped = iMultiCollateralOnOffRamp.offramp(collateral, amountDiff);
                IERC20Upgradeable(collateral).safeTransfer(user, offramped);
            }
        }
    }

    function _resolveChainedMarketManually(address _market, int64[] calldata _finalPrices) internal {
        // For chained markets, we need to check each direction
        // Manual resolution is only allowed if the user would lose
        ChainedSpeedMarket chainedMarket = ChainedSpeedMarket(_market);
        int64 currentPrice = chainedMarket.initialStrikePrice();
        SpeedMarket.Direction[] memory directions = new SpeedMarket.Direction[](chainedMarket.numOfDirections());

        for (uint i = 0; i < _finalPrices.length; i++) {
            directions[i] = chainedMarket.directions(i);
            bool userLostDirection = (_finalPrices[i] >= currentPrice && directions[i] == SpeedMarket.Direction.Down) ||
                (_finalPrices[i] <= currentPrice && directions[i] == SpeedMarket.Direction.Up);

            if (userLostDirection) {
                // User lost, manual resolution is allowed
                chainedSpeedMarketsAMM.resolveMarketWithPrices(_market, _finalPrices, true);
                return;
            }
            currentPrice = _finalPrices[i];
        }

        // If we reach here, user would win - manual resolution not allowed
        revert CanNotResolve();
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

    /// ========== SETUP FUNCTIONS ==========

    /// @notice Setup approval for multiCollateralOnOffRamp
    /// @param amount The amount to approve (use type(uint256).max for unlimited)
    function setupMultiCollateralApproval(uint amount) external onlyOwner {
        address multiCollateralAddress = addressManager.multiCollateralOnOffRamp();
        if (multiCollateralAddress != address(0)) {
            speedMarketsAMM.sUSD().approve(multiCollateralAddress, amount);
            chainedSpeedMarketsAMM.sUSD().approve(multiCollateralAddress, amount);
        }
        emit SetMulticollateralApproval(amount);
    }

    /// @notice Set chained speed markets AMM address
    /// @param _chainedSpeedMarketsAMM The address of the chained speed markets AMM
    function setChainedSpeedMarketsAMM(address _chainedSpeedMarketsAMM) external onlyOwner {
        chainedSpeedMarketsAMM = IChainedSpeedMarketsAMM(_chainedSpeedMarketsAMM);
        emit ChainedSpeedMarketsAMMSet(_chainedSpeedMarketsAMM);
    }

    event ChainedSpeedMarketsAMMSet(address indexed _chainedSpeedMarketsAMM);
    event SetMulticollateralApproval(uint amount);
}

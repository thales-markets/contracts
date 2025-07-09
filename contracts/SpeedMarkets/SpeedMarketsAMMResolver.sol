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

import "./SpeedMarket.sol";

/// @title An AMM for Thales speed markets
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

    receive() external payable {}

    function initialize(
        address _owner,
        address _speedMarketsAMM,
        address _addressManager
    ) external initializer {
        setOwner(_owner);
        speedMarketsAMM = ISpeedMarketsAMM(_speedMarketsAMM);
        addressManager = IAddressManager(_addressManager);
        address multiCollateralAddress = addressManager.multiCollateralOnOffRamp();
        if (multiCollateralAddress != address(0)) {
            speedMarketsAMM.sUSD().approve(multiCollateralAddress, MAX_APPROVAL);
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

        IPyth iPyth = IPyth(addressManager.pyth());
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = speedMarketsAMM.assetToPythId(SpeedMarket(market).asset());
        uint64 maximumPriceDelayForResolving = speedMarketsAMM.maximumPriceDelayForResolving();
        PythStructs.PriceFeed[] memory prices = iPyth.parsePriceFeedUpdates{value: iPyth.getUpdateFee(priceUpdateData)}(
            priceUpdateData,
            priceIds,
            SpeedMarket(market).strikeTime(),
            SpeedMarket(market).strikeTime() + maximumPriceDelayForResolving
        );

        PythStructs.Price memory price = prices[0].price;

        if (price.price <= 0) revert InvalidPrice();

        speedMarketsAMM.resolveMarketWithPrice(market, price.price);
    }

    function _resolveMarketWithOfframp(
        address market,
        bytes[] memory priceUpdateData,
        address collateral,
        bool toEth
    ) internal {
        address user = SpeedMarket(market).user();
        if (msg.sender != user) revert OnlyMarketOwner();
        IERC20Upgradeable defaultCollateral = IERC20Upgradeable(SpeedMarket(market).collateral());
        if (address(defaultCollateral) != address(speedMarketsAMM.sUSD())) revert InvalidOffRampCollateral();
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

    /// ========== SETUP FUNCTIONS ==========

    /// @notice Setup approval for multiCollateralOnOffRamp
    /// @param amount The amount to approve (use type(uint256).max for unlimited)
    function setupMultiCollateralApproval(uint amount) external onlyOwner {
        address multiCollateralAddress = addressManager.multiCollateralOnOffRamp();
        if (multiCollateralAddress != address(0)) {
            speedMarketsAMM.sUSD().approve(multiCollateralAddress, amount);
        }
    }
}

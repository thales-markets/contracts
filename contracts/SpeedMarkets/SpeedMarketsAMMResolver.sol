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
        initNonReentrant();
    }

    /// @notice resolveMarket resolves an active market
    /// @param market address of the market
    function resolveMarket(address market, bytes[] calldata priceUpdateData) external payable nonReentrant notPaused {
        _resolveMarket(market, priceUpdateData);
    }

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

    /// @notice resolveMarket resolves an active market with offramp
    /// @param market address of the market
    /// @param priceUpdateData price update data
    /// @param collateral collateral address
    /// @param toEth whether to offramp to ETH
    function resolveMarketWithOfframp(
        address market,
        bytes[] calldata priceUpdateData,
        address collateral,
        bool toEth
    ) external payable nonReentrant notPaused {
        if (!speedMarketsAMM.multicollateralEnabled()) revert MulticollateralOnrampDisabled();
        address user = SpeedMarket(market).user();
        if (msg.sender != user) revert OnlyMarketOwner();
        IERC20Upgradeable defaultCollateral = IERC20Upgradeable(SpeedMarket(market).defaultCollateral());
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

    /// @notice resolveMarkets in a batch
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

    /// @notice admin resolve market for a given market address with finalPrice
    function resolveMarketManually(address _market, int64 _finalPrice) external {
        if (!speedMarketsAMM.whitelistedAddresses(msg.sender)) revert InvalidWhitelistAddress();
        _resolveMarketManually(_market, _finalPrice);
    }

    /// @notice admin resolve for a given markets with finalPrices
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

    function _resolveMarketManually(address _market, int64 _finalPrice) internal {
        SpeedMarket.Direction direction = SpeedMarket(_market).direction();
        int64 strikePrice = SpeedMarket(_market).strikePrice();
        bool isUserWinner = (_finalPrice < strikePrice && direction == SpeedMarket.Direction.Down) ||
            (_finalPrice > strikePrice && direction == SpeedMarket.Direction.Up);
        if (!speedMarketsAMM.canResolveMarket(_market) || isUserWinner) revert CanNotResolve();

        speedMarketsAMM.resolveMarketWithPrice(_market, _finalPrice);
    }
}

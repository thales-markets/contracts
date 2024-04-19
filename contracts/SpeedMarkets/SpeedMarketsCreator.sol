// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

import "../interfaces/IAddressManager.sol";
import "../interfaces/ISpeedMarkets.sol";

import "./SpeedMarkets.sol";

/// @title speed/chained markets prepared for creation with latest Pyth price
contract SpeedMarketsCreator is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    int64 private constant ONE = 1e8;

    struct SpeedMarketParams {
        bytes32 asset;
        uint64 strikeTime;
        uint64 delta;
        int64 strikePrice;
        int64 strikePriceSlippage;
        SpeedMarkets.Direction direction;
        address collateral;
        uint buyinAmount;
        address referrer;
        uint skewImpact;
    }

    struct PendingSpeedMarket {
        address user;
        bytes32 asset;
        uint64 strikeTime;
        uint64 delta;
        int64 strikePrice;
        int64 strikePriceSlippage;
        SpeedMarkets.Direction direction;
        address collateral;
        uint buyinAmount;
        address referrer;
        uint skewImpact;
        uint256 createdAt;
    }

    struct AssetPriceData {
        bytes32 asset;
        bytes[] priceUpdateData;
    }

    uint64 public maximumCreationDelay;

    PendingSpeedMarket[] public pendingSpeedMarkets;

    IAddressManager public addressManager;

    function initialize(address _owner, address _addressManager) external initializer {
        setOwner(_owner);
        addressManager = IAddressManager(_addressManager);
    }

    /// @notice add new speed market to pending - waiting for creation
    /// @param _params parameters for adding pending speed market
    function addPendingSpeedMarket(SpeedMarketParams calldata _params) external payable nonReentrant notPaused {
        PendingSpeedMarket memory pendingSpeedMarket = PendingSpeedMarket(
            msg.sender,
            _params.asset,
            _params.strikeTime,
            _params.delta,
            _params.strikePrice,
            _params.strikePriceSlippage,
            _params.direction,
            _params.collateral,
            _params.buyinAmount,
            _params.referrer,
            _params.skewImpact,
            block.timestamp
        );

        pendingSpeedMarkets.push(pendingSpeedMarket);

        emit AddSpeedMarket(pendingSpeedMarket);
    }

    /// @notice create all speed markets from pending using latest price feeds from params
    /// @param _assetPriceData array of pyth priceUpdateData per asset
    function createPendingSpeedMarkets(AssetPriceData[] calldata _assetPriceData) external payable nonReentrant notPaused {
        require(pendingSpeedMarkets.length > 0, "No pending markets");
        require(_assetPriceData.length > 0, "Missing asset price"); // TODO: check max number of assets

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();

        ISpeedMarkets iSpeedMarkets = ISpeedMarkets(contractsAddresses.speedMarketsAMM);
        IPyth iPyth = IPyth(contractsAddresses.pyth);

        // update latest pyth price
        for (uint8 i = 0; i < _assetPriceData.length; i++) {
            require(iSpeedMarkets.supportedAsset(_assetPriceData[i].asset), "Asset not supported");
            iPyth.updatePriceFeeds{value: iPyth.getUpdateFee(_assetPriceData[i].priceUpdateData)}(
                _assetPriceData[i].priceUpdateData
            );
        }

        uint64 maximumPriceDelay = iSpeedMarkets.maximumPriceDelay();

        // process all pending speed markets
        for (uint8 i = 0; i < pendingSpeedMarkets.length; i++) {
            PendingSpeedMarket memory pendingSpeedMarket = pendingSpeedMarkets[i];

            if ((pendingSpeedMarket.createdAt + maximumCreationDelay) <= block.timestamp) {
                // too late for processing
                continue;
            }

            PythStructs.Price memory pythPrice = iPyth.getPriceUnsafe(iSpeedMarkets.assetToPythId(pendingSpeedMarket.asset));
            require((pythPrice.publishTime + maximumPriceDelay) > block.timestamp && pythPrice.price > 0, "Stale price");

            int64 maxPrice = (pendingSpeedMarket.strikePrice * (ONE + pendingSpeedMarket.strikePriceSlippage)) / ONE;
            int64 minPrice = (pendingSpeedMarket.strikePrice * (ONE - pendingSpeedMarket.strikePriceSlippage)) / ONE;
            require(pythPrice.price <= maxPrice && pythPrice.price >= minPrice, "Pyth price exceeds slippage");

            try
                iSpeedMarkets.createNewMarket(
                    SpeedMarkets.CreateMarketParams(
                        pendingSpeedMarket.user,
                        pendingSpeedMarket.asset,
                        pendingSpeedMarket.strikeTime,
                        pendingSpeedMarket.delta,
                        pythPrice,
                        pendingSpeedMarket.direction,
                        pendingSpeedMarket.collateral,
                        pendingSpeedMarket.buyinAmount,
                        pendingSpeedMarket.referrer,
                        pendingSpeedMarket.skewImpact
                    )
                )
            {} catch Error(string memory reason) {
                emit LogError(
                    reason,
                    pendingSpeedMarket.user,
                    pendingSpeedMarket.delta,
                    pendingSpeedMarket.strikeTime,
                    pendingSpeedMarket.collateral,
                    pendingSpeedMarket.createdAt
                );
            }
        }

        emit CreateSpeedMarkets(pendingSpeedMarkets.length);

        delete pendingSpeedMarkets;
    }

    /// @notice create speed market
    /// @param _speedMarketParams parameters for creating speed market
    /// @param _assetPriceData array of pyth priceUpdateData per asset
    function createSpeedMarket(SpeedMarketParams calldata _speedMarketParams, AssetPriceData[] calldata _assetPriceData)
        external
        payable
        nonReentrant
        notPaused
    {
        require(_assetPriceData.length > 0, "Missing asset price"); // TODO: check max number of assets

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();

        ISpeedMarkets iSpeedMarkets = ISpeedMarkets(contractsAddresses.speedMarketsAMM);
        IPyth iPyth = IPyth(contractsAddresses.pyth);

        // update latest pyth price
        for (uint8 i = 0; i < _assetPriceData.length; i++) {
            require(iSpeedMarkets.supportedAsset(_assetPriceData[i].asset), "Asset not supported");
            iPyth.updatePriceFeeds{value: iPyth.getUpdateFee(_assetPriceData[i].priceUpdateData)}(
                _assetPriceData[i].priceUpdateData
            );
        }

        uint64 maximumPriceDelay = iSpeedMarkets.maximumPriceDelay();
        PythStructs.Price memory pythPrice = iPyth.getPriceUnsafe(iSpeedMarkets.assetToPythId(_speedMarketParams.asset));
        require((pythPrice.publishTime + maximumPriceDelay) > block.timestamp && pythPrice.price > 0, "Stale price");

        int64 maxPrice = (_speedMarketParams.strikePrice * (ONE + _speedMarketParams.strikePriceSlippage)) / ONE;
        int64 minPrice = (_speedMarketParams.strikePrice * (ONE - _speedMarketParams.strikePriceSlippage)) / ONE;
        require(pythPrice.price <= maxPrice && pythPrice.price >= minPrice, "Pyth price exceeds slippage");

        iSpeedMarkets.createNewMarket(
            SpeedMarkets.CreateMarketParams(
                msg.sender,
                _speedMarketParams.asset,
                _speedMarketParams.strikeTime,
                _speedMarketParams.delta,
                pythPrice,
                _speedMarketParams.direction,
                _speedMarketParams.collateral,
                _speedMarketParams.buyinAmount,
                _speedMarketParams.referrer,
                _speedMarketParams.skewImpact
            )
        );
    }

    //////////////////setters/////////////////

    /// @notice Set address of address manager
    /// @param _addressManager to use address for fetching other contract addresses
    function setAddressManager(address _addressManager) external onlyOwner {
        addressManager = IAddressManager(_addressManager);
        emit SetAddressManager(_addressManager);
    }

    /// @notice Set parameters for limits
    function setMaxCreationDelay(uint64 _maximumCreationDelay) external onlyOwner {
        maximumCreationDelay = _maximumCreationDelay;
        emit SetMaxCreationDelay(_maximumCreationDelay);
    }

    //////////////////events/////////////////

    event AddSpeedMarket(PendingSpeedMarket _PendingSpeedMarket);
    event CreateSpeedMarkets(uint _size);

    event SetAddressManager(address _addressManager);
    event SetMaxCreationDelay(uint64 _maximumCreationDelay);

    event LogError(
        string _errorMessage,
        address _user,
        uint64 _delta,
        uint64 _strikeTime,
        address _collateral,
        uint256 _createdAt
    );
}

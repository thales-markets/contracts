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

    struct SpeedMarketElem {
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

    SpeedMarketElem[] public pendingSpeedMarkets;

    IAddressManager public addressManager;

    function initialize(address _owner, address _addressManager) external initializer {
        setOwner(_owner);
        addressManager = IAddressManager(_addressManager);
    }

    /// @notice add new speed market to pending - waiting for creation
    function addPendingSpeedMarket(
        bytes32 _asset,
        uint64 _strikeTime,
        uint64 _delta,
        int64 _strikePrice,
        int64 _strikePriceSlippage,
        SpeedMarkets.Direction _direction,
        address _collateral,
        uint _buyinAmount,
        address _referrer,
        uint _skewImpact
    ) external payable nonReentrant notPaused {
        SpeedMarketElem memory speedMarketElem = SpeedMarketElem(
            msg.sender,
            _asset,
            _strikeTime,
            _delta,
            _strikePrice,
            _strikePriceSlippage,
            _direction,
            _collateral,
            _buyinAmount,
            _referrer,
            _skewImpact,
            block.timestamp
        );

        pendingSpeedMarkets.push(speedMarketElem);

        emit AddSpeedMarket(speedMarketElem);
    }

    /// @notice create all speed markets from pending using latest price feeds from params
    /// @param _assetPriceData array of pyth priceUpdateData per asset
    function createPendingSpeedMarkets(AssetPriceData[] memory _assetPriceData) external payable nonReentrant notPaused {
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
            SpeedMarketElem memory pendingSpeedMarket = pendingSpeedMarkets[i];

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

    event AddSpeedMarket(SpeedMarketElem _speedMarketElem);
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

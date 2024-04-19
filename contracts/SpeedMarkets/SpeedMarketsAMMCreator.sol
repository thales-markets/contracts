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
import "../interfaces/ISpeedMarketsAMM.sol";
import "../interfaces/IChainedSpeedMarketsAMM.sol";

import "./SpeedMarket.sol";
import "./SpeedMarketsAMM.sol";
import "./ChainedSpeedMarketsAMM.sol";

/// @title speed/chained markets prepared for creation with latest Pyth price
contract SpeedMarketsAMMCreator is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    int64 private constant ONE = 1e8;

    struct SpeedMarketElem {
        address user;
        bytes32 asset;
        uint64 strikeTime;
        uint64 delta;
        int64 strikePrice;
        int64 strikePriceSlippage;
        SpeedMarket.Direction direction;
        address collateral;
        uint buyinAmount;
        address referrer;
        uint skewImpact;
        uint256 createdAt;
    }

    struct ChainedSpeedMarketElem {
        address user;
        bytes32 asset;
        uint64 timeFrame;
        int64 strikePrice;
        int64 strikePriceSlippage;
        SpeedMarket.Direction[] directions;
        address collateral;
        uint buyinAmount;
        address referrer;
        uint256 createdAt;
    }

    struct AssetPriceData {
        bytes32 asset;
        bytes[] priceUpdateData;
    }

    uint64 public maximumCreationDelay;

    SpeedMarketElem[] public pendingSpeedMarkets;
    ChainedSpeedMarketElem[] public pendingChainedSpeedMarkets;

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
        SpeedMarket.Direction _direction,
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

    /// @notice add new chained speed market to pending - waiting for creation
    function addPendingChainedSpeedMarket(
        bytes32 _asset,
        uint64 _timeFrame,
        int64 _strikePrice,
        int64 _strikePriceSlippage,
        SpeedMarket.Direction[] calldata _directions,
        address _collateral,
        uint _buyinAmount,
        address _referrer
    ) external payable nonReentrant notPaused {
        ChainedSpeedMarketElem memory chainedSpeedMarketElem = ChainedSpeedMarketElem(
            msg.sender,
            _asset,
            _timeFrame,
            _strikePrice,
            _strikePriceSlippage,
            _directions,
            _collateral,
            _buyinAmount,
            _referrer,
            block.timestamp
        );

        pendingChainedSpeedMarkets.push(chainedSpeedMarketElem);

        emit AddChainedSpeedMarket(chainedSpeedMarketElem);
    }

    /// @notice create all speed markets from pending using latest price feeds from params
    /// @param _assetPriceData array of pyth priceUpdateData per asset
    function createPendingSpeedMarkets(AssetPriceData[] memory _assetPriceData) external payable nonReentrant notPaused {
        require(pendingSpeedMarkets.length > 0, "No pending markets");
        require(_assetPriceData.length > 0, "Missing asset price"); // TODO: check max number of assets

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();

        ISpeedMarketsAMM iSpeedMarketsAMM = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM);
        IPyth iPyth = IPyth(contractsAddresses.pyth);

        // update latest pyth price
        for (uint8 i = 0; i < _assetPriceData.length; i++) {
            require(iSpeedMarketsAMM.supportedAsset(_assetPriceData[i].asset), "Asset not supported");
            iPyth.updatePriceFeeds{value: iPyth.getUpdateFee(_assetPriceData[i].priceUpdateData)}(
                _assetPriceData[i].priceUpdateData
            );
        }

        uint64 maximumPriceDelay = iSpeedMarketsAMM.maximumPriceDelay();

        // process all pending speed markets
        for (uint8 i = 0; i < pendingSpeedMarkets.length; i++) {
            SpeedMarketElem memory pendingSpeedMarket = pendingSpeedMarkets[i];

            if ((pendingSpeedMarket.createdAt + maximumCreationDelay) <= block.timestamp) {
                // too late for processing
                continue;
            }

            PythStructs.Price memory pythPrice = iPyth.getPriceUnsafe(
                iSpeedMarketsAMM.assetToPythId(pendingSpeedMarket.asset)
            );
            require((pythPrice.publishTime + maximumPriceDelay) > block.timestamp && pythPrice.price > 0, "Stale price");

            int64 maxPrice = (pendingSpeedMarket.strikePrice * (ONE + pendingSpeedMarket.strikePriceSlippage)) / ONE;
            int64 minPrice = (pendingSpeedMarket.strikePrice * (ONE - pendingSpeedMarket.strikePriceSlippage)) / ONE;
            require(pythPrice.price <= maxPrice && pythPrice.price >= minPrice, "Pyth price exceeds slippage");

            try
                iSpeedMarketsAMM.createNewMarket(
                    SpeedMarketsAMM.CreateMarketParams(
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

    /// @notice create all chained speed markets from pending using latest price feeds from params
    /// @param _assetPriceData array of pyth priceUpdateData per asset
    function createChainedPendingSpeedMarkets(AssetPriceData[] memory _assetPriceData)
        external
        payable
        nonReentrant
        notPaused
    {
        require(pendingChainedSpeedMarkets.length > 0, "No pending markets");
        require(_assetPriceData.length > 0, "Missing asset price"); // TODO: check max number of assets

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();

        ISpeedMarketsAMM iSpeedMarketsAMM = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM);
        IPyth iPyth = IPyth(contractsAddresses.pyth);

        // update latest pyth price
        for (uint8 i = 0; i < _assetPriceData.length; i++) {
            require(iSpeedMarketsAMM.supportedAsset(_assetPriceData[i].asset), "Asset not supported");
            iPyth.updatePriceFeeds{value: iPyth.getUpdateFee(_assetPriceData[i].priceUpdateData)}(
                _assetPriceData[i].priceUpdateData
            );
        }

        uint64 maximumPriceDelay = iSpeedMarketsAMM.maximumPriceDelay();

        // process all pending chained speed markets
        for (uint8 i = 0; i < pendingChainedSpeedMarkets.length; i++) {
            ChainedSpeedMarketElem memory pendingChainedSpeedMarket = pendingChainedSpeedMarkets[i];

            if ((pendingChainedSpeedMarket.createdAt + maximumCreationDelay) <= block.timestamp) {
                // too late for processing
                continue;
            }

            PythStructs.Price memory pythPrice = iPyth.getPriceUnsafe(
                iSpeedMarketsAMM.assetToPythId(pendingChainedSpeedMarket.asset)
            );
            require((pythPrice.publishTime + maximumPriceDelay) > block.timestamp && pythPrice.price > 0, "Stale price");

            int64 maxPrice = (pendingChainedSpeedMarket.strikePrice *
                (ONE + pendingChainedSpeedMarket.strikePriceSlippage)) / ONE;
            int64 minPrice = (pendingChainedSpeedMarket.strikePrice *
                (ONE - pendingChainedSpeedMarket.strikePriceSlippage)) / ONE;
            require(pythPrice.price <= maxPrice && pythPrice.price >= minPrice, "Pyth price exceeds slippage");

            try
                IChainedSpeedMarketsAMM(addressManager.getAddress("ChainedSpeedMarketsAMM")).createNewMarket(
                    ChainedSpeedMarketsAMM.CreateMarketParams(
                        pendingChainedSpeedMarket.user,
                        pendingChainedSpeedMarket.asset,
                        pendingChainedSpeedMarket.timeFrame,
                        pythPrice,
                        pendingChainedSpeedMarket.directions,
                        pendingChainedSpeedMarket.collateral,
                        pendingChainedSpeedMarket.buyinAmount,
                        pendingChainedSpeedMarket.referrer
                    )
                )
            {} catch Error(string memory reason) {
                emit LogError(
                    reason,
                    pendingChainedSpeedMarket.user,
                    pendingChainedSpeedMarket.timeFrame,
                    0,
                    pendingChainedSpeedMarket.collateral,
                    pendingChainedSpeedMarket.createdAt
                );
            }
        }

        emit CreateChainedSpeedMarkets(pendingChainedSpeedMarkets.length);

        delete pendingChainedSpeedMarkets;
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
    event AddChainedSpeedMarket(ChainedSpeedMarketElem _chainedSpeedMarketElem);
    event CreateSpeedMarkets(uint _size);
    event CreateChainedSpeedMarkets(uint _size);

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

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

import "../interfaces/IAddressManager.sol";
import "../interfaces/ISpeedMarketsAMM.sol";
import "../interfaces/IChainedSpeedMarketsAMM.sol";

import "./SpeedMarket.sol";

/// @title Pending speed/chained markets prepared for creation with latest Pyth price
contract PendingSpeedMarketsAMM is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    struct SpeedMarketElem {
        address user;
        bytes32 asset;
        uint64 strikeTime;
        uint64 delta;
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

    mapping(bytes32 => bytes[]) private priceUpdateDataByAsset;

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
        SpeedMarket.Direction[] calldata _directions,
        address _collateral,
        uint _buyinAmount,
        address _referrer
    ) external payable nonReentrant notPaused {
        ChainedSpeedMarketElem memory chainedSpeedMarketElem = ChainedSpeedMarketElem(
            msg.sender,
            _asset,
            _timeFrame,
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

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();

        for (uint8 i = 0; i < _assetPriceData.length; i++) {
            // populate map with pyth latest prices for all assets (also for any future asset)
            priceUpdateDataByAsset[_assetPriceData[i].asset] = _assetPriceData[i].priceUpdateData;

            // update latest pyth price
            IPyth iPyth = IPyth(contractsAddresses.pyth);
            iPyth.updatePriceFeeds{value: iPyth.getUpdateFee(_assetPriceData[i].priceUpdateData)}(
                _assetPriceData[i].priceUpdateData
            );
        }

        for (uint8 i = 0; i < pendingSpeedMarkets.length; i++) {
            SpeedMarketElem memory speedMarket = pendingSpeedMarkets[i];
            uint64 maximumPriceDelay = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM).maximumPriceDelay();

            if ((speedMarket.createdAt + maximumPriceDelay) <= block.timestamp) {
                // too late for processing
                continue;
            }

            try
                ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM).createNewMarket(
                    speedMarket.user,
                    speedMarket.asset,
                    speedMarket.strikeTime,
                    speedMarket.delta,
                    speedMarket.direction,
                    speedMarket.collateral,
                    speedMarket.buyinAmount,
                    speedMarket.referrer,
                    speedMarket.skewImpact
                )
            {} catch Error(string memory reason) {
                emit LogError(
                    reason,
                    speedMarket.user,
                    speedMarket.delta,
                    speedMarket.strikeTime,
                    speedMarket.collateral,
                    speedMarket.createdAt
                );
            }
        }

        emit CreateSpeedMarkets(pendingSpeedMarkets.length);

        delete pendingSpeedMarkets;
    }

    /// @notice create all chained speed markets from pending using latest price feeds from params
    /// @param _assetPriceData array of pyth priceUpdateData per asset
    function createPendingChainedSpeedMarkets(AssetPriceData[] memory _assetPriceData)
        external
        payable
        nonReentrant
        notPaused
    {
        require(pendingChainedSpeedMarkets.length > 0, "No pending markets");

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();

        for (uint8 i = 0; i < _assetPriceData.length; i++) {
            priceUpdateDataByAsset[_assetPriceData[i].asset] = _assetPriceData[i].priceUpdateData;
            // populate map with pyth latest prices for all assets (also for any future asset)

            // update latest pyth price
            IPyth iPyth = IPyth(contractsAddresses.pyth);
            iPyth.updatePriceFeeds{value: iPyth.getUpdateFee(_assetPriceData[i].priceUpdateData)}(
                _assetPriceData[i].priceUpdateData
            );
        }

        for (uint8 i = 0; i < pendingChainedSpeedMarkets.length; i++) {
            ChainedSpeedMarketElem memory chainedSpeedMarket = pendingChainedSpeedMarkets[i];
            uint64 maximumPriceDelay = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM).maximumPriceDelay();

            if ((chainedSpeedMarket.createdAt + maximumPriceDelay) <= block.timestamp) {
                // too late for processing
                continue;
            }

            try
                IChainedSpeedMarketsAMM(addressManager.getAddress("ChainedSpeedMarketsAMM")).createNewMarket(
                    chainedSpeedMarket.user,
                    chainedSpeedMarket.asset,
                    chainedSpeedMarket.timeFrame,
                    chainedSpeedMarket.directions,
                    chainedSpeedMarket.collateral,
                    chainedSpeedMarket.buyinAmount,
                    chainedSpeedMarket.referrer
                )
            {} catch Error(string memory reason) {
                emit LogError(
                    reason,
                    chainedSpeedMarket.user,
                    chainedSpeedMarket.timeFrame,
                    0,
                    chainedSpeedMarket.collateral,
                    chainedSpeedMarket.createdAt
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

    //////////////////events/////////////////

    event AddSpeedMarket(SpeedMarketElem _speedMarketElem);
    event AddChainedSpeedMarket(ChainedSpeedMarketElem _chainedSpeedMarketElem);
    event CreateSpeedMarkets(uint _size);
    event CreateChainedSpeedMarkets(uint _size);

    event SetAddressManager(address _addressManager);

    event LogError(
        string _errorMessage,
        address _user,
        uint64 _delta,
        uint64 _strikeTime,
        address _collateral,
        uint256 _createdAt
    );
}

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
import "../interfaces/ISpeedMarkets.sol";

/// @title Pending speed markets prepared for creation with latest Pyth price
contract PendingSpeedMarkets is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    struct SpeedMarketElem {
        address user;
        bytes32 asset;
        uint64 strikeTime;
        uint64 delta;
        ISpeedMarkets.Direction direction;
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

    mapping(bytes32 => bytes[]) private priceUpdateDataByAsset;

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
        ISpeedMarkets.Direction _direction,
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
            uint64 maximumPriceDelay = ISpeedMarkets(contractsAddresses.speedMarketsAMM).maximumPriceDelay();

            if ((speedMarket.createdAt + maximumPriceDelay) <= block.timestamp) {
                // too late for processing
                continue;
            }

            try
                ISpeedMarkets(contractsAddresses.speedMarketsAMM).createNewMarket(
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

    /// @notice Set address of address manager
    /// @param _addressManager to use address for fetching other contract addresses
    function setAddressManager(address _addressManager) external onlyOwner {
        addressManager = IAddressManager(_addressManager);
        emit SetAddressManager(_addressManager);
    }

    //////////////////events/////////////////

    event AddSpeedMarket(SpeedMarketElem _speedMarketElem);
    event CreateSpeedMarkets(uint _size);

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

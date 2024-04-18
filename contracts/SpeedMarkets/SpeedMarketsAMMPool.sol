// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

import "../interfaces/ISpeedMarketsAMM.sol";
import "../interfaces/IChainedSpeedMarketsAMM.sol";

import "./SpeedMarket.sol";

/// @title Pool of speed markets prepared for creation with latest Pyth price
contract SpeedMarketsAMMPool is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    struct SpeedMarketElem {
        address user;
        bytes32 asset;
        uint64 strikeTime;
        uint64 delta;
        SpeedMarket.Direction direction;
        uint buyinAmount;
        bool isDefaultCollateral;
        address collateral;
        address referrer;
        uint skewImpact;
        uint256 createdAt;
    }

    struct ChainedSpeedMarketElem {
        address user;
        bytes32 asset;
        uint64 timeFrame;
        SpeedMarket.Direction[] directions;
        uint buyinAmount;
        bool isDefaultCollateral;
        address collateral;
        address referrer;
        uint256 createdAt;
    }

    struct AssetPriceData {
        bytes32 asset;
        bytes[] priceUpdateData;
    }

    mapping(bytes32 => bytes[]) private priceUpdateDataByAsset;

    SpeedMarketElem[] public speedMarketsPool;
    ChainedSpeedMarketElem[] public chainedSpeedMarketsPool;

    address public speedMarketsAMM;
    address public chainedSpeedMarketsAMM;

    function initialize(
        address _owner,
        address _speedMarketsAMM,
        address _chainedSpeedMarketsAMM
    ) external initializer {
        setOwner(_owner);
        speedMarketsAMM = _speedMarketsAMM;
        chainedSpeedMarketsAMM = _chainedSpeedMarketsAMM;
    }

    /// @notice add new speed market to pool - waiting for creation
    function addSpeedMarketToPool(
        bytes32 _asset,
        uint64 _strikeTime,
        uint64 _delta,
        SpeedMarket.Direction _direction,
        uint _buyinAmount,
        bool _isDefaultCollateral,
        address _collateral,
        address _referrer,
        uint _skewImpact
    ) external payable nonReentrant notPaused {
        SpeedMarketElem memory speedMarketElem = SpeedMarketElem(
            msg.sender,
            _asset,
            _strikeTime,
            _delta,
            _direction,
            _buyinAmount,
            _isDefaultCollateral,
            _collateral,
            _referrer,
            _skewImpact,
            block.timestamp
        );

        speedMarketsPool.push(speedMarketElem);

        emit AddSpeedMarket(speedMarketElem);
    }

    /// @notice add new chained speed market to pool - waiting for creation
    function addChainedSpeedMarketToPool(
        bytes32 _asset,
        uint64 _timeFrame,
        SpeedMarket.Direction[] calldata _directions,
        uint _buyinAmount,
        bool _isDefaultCollateral,
        address _collateral,
        address _referrer
    ) external payable nonReentrant notPaused {
        ChainedSpeedMarketElem memory chainedSpeedMarketElem = ChainedSpeedMarketElem(
            msg.sender,
            _asset,
            _timeFrame,
            _directions,
            _buyinAmount,
            _isDefaultCollateral,
            _collateral,
            _referrer,
            block.timestamp
        );

        chainedSpeedMarketsPool.push(chainedSpeedMarketElem);

        emit AddChainedSpeedMarket(chainedSpeedMarketElem);
    }

    /// @notice create all speed markets from pool using latest price feeds from params
    /// @param _assetPriceData array of pyth priceUpdateData per asset
    function createSpeedMarketsFromPool(AssetPriceData[] memory _assetPriceData) external payable nonReentrant notPaused {
        require(speedMarketsPool.length > 0, "Pool is empty");

        // populate map with pyth latest prices for all assets (also for any future asset)
        for (uint8 i = 0; i < _assetPriceData.length; i++) {
            priceUpdateDataByAsset[_assetPriceData[i].asset] = _assetPriceData[i].priceUpdateData;
        }

        for (uint8 i = 0; i < speedMarketsPool.length; i++) {
            SpeedMarketElem memory speedMarket = speedMarketsPool[i];
            uint64 maximumPriceDelay = ISpeedMarketsAMM(speedMarketsAMM).maximumPriceDelay();

            if ((speedMarket.createdAt + maximumPriceDelay) <= block.timestamp) {
                // too late for processing
                continue;
            }

            if (speedMarket.isDefaultCollateral) {
                try
                    ISpeedMarketsAMM(speedMarketsAMM).createNewMarket(
                        speedMarket.user,
                        speedMarket.asset,
                        speedMarket.strikeTime,
                        speedMarket.delta,
                        speedMarket.direction,
                        speedMarket.buyinAmount,
                        priceUpdateDataByAsset[speedMarket.asset], // TODO: passing big sized param could be optimized by updating Pyth price here
                        speedMarket.referrer,
                        speedMarket.skewImpact
                    )
                {} catch Error(string memory reason) {
                    emit LogError(
                        reason,
                        speedMarket.user,
                        speedMarket.isDefaultCollateral,
                        speedMarket.delta,
                        speedMarket.strikeTime,
                        speedMarket.createdAt
                    );
                }
            } else {
                try
                    ISpeedMarketsAMM(speedMarketsAMM).createNewMarketWithDifferentCollateral(
                        speedMarket.user,
                        speedMarket.asset,
                        speedMarket.strikeTime,
                        speedMarket.delta,
                        speedMarket.direction,
                        priceUpdateDataByAsset[speedMarket.asset],
                        speedMarket.collateral,
                        speedMarket.buyinAmount,
                        speedMarket.referrer,
                        speedMarket.skewImpact
                    )
                {} catch Error(string memory reason) {
                    emit LogError(
                        reason,
                        speedMarket.user,
                        speedMarket.isDefaultCollateral,
                        speedMarket.delta,
                        speedMarket.strikeTime,
                        speedMarket.createdAt
                    );
                }
            }
        }

        emit CreateSpeedMarkets(speedMarketsPool.length);

        delete speedMarketsPool;
    }

    /// @notice create all chained speed markets from pool using latest price feeds from params
    /// @param _assetPriceData array of pyth priceUpdateData per asset
    function createChainedSpeedMarketsFromPool(AssetPriceData[] memory _assetPriceData)
        external
        payable
        nonReentrant
        notPaused
    {
        require(chainedSpeedMarketsPool.length > 0, "Pool is empty");

        // populate map with pyth latest prices for all assets (also for any future asset)
        for (uint8 i = 0; i < _assetPriceData.length; i++) {
            priceUpdateDataByAsset[_assetPriceData[i].asset] = _assetPriceData[i].priceUpdateData;
        }

        for (uint8 i = 0; i < chainedSpeedMarketsPool.length; i++) {
            ChainedSpeedMarketElem memory chainedSpeedMarket = chainedSpeedMarketsPool[i];
            uint64 maximumPriceDelay = ISpeedMarketsAMM(speedMarketsAMM).maximumPriceDelay();

            if ((chainedSpeedMarket.createdAt + maximumPriceDelay) <= block.timestamp) {
                // too late for processing
                continue;
            }

            if (chainedSpeedMarket.isDefaultCollateral) {
                try
                    IChainedSpeedMarketsAMM(chainedSpeedMarketsAMM).createNewMarket(
                        chainedSpeedMarket.user,
                        chainedSpeedMarket.asset,
                        chainedSpeedMarket.timeFrame,
                        chainedSpeedMarket.directions,
                        chainedSpeedMarket.buyinAmount,
                        priceUpdateDataByAsset[chainedSpeedMarket.asset],
                        chainedSpeedMarket.referrer
                    )
                {} catch Error(string memory reason) {
                    emit LogError(
                        reason,
                        chainedSpeedMarket.user,
                        chainedSpeedMarket.isDefaultCollateral,
                        chainedSpeedMarket.timeFrame,
                        0,
                        chainedSpeedMarket.createdAt
                    );
                }
            } else {
                try
                    IChainedSpeedMarketsAMM(chainedSpeedMarketsAMM).createNewMarketWithDifferentCollateral(
                        chainedSpeedMarket.user,
                        chainedSpeedMarket.asset,
                        chainedSpeedMarket.timeFrame,
                        chainedSpeedMarket.directions,
                        priceUpdateDataByAsset[chainedSpeedMarket.asset],
                        chainedSpeedMarket.collateral,
                        chainedSpeedMarket.buyinAmount,
                        chainedSpeedMarket.referrer
                    )
                {} catch Error(string memory reason) {
                    emit LogError(
                        reason,
                        chainedSpeedMarket.user,
                        chainedSpeedMarket.isDefaultCollateral,
                        chainedSpeedMarket.timeFrame,
                        0,
                        chainedSpeedMarket.createdAt
                    );
                }
            }
        }

        emit CreateChainedSpeedMarkets(chainedSpeedMarketsPool.length);

        delete chainedSpeedMarketsPool;
    }

    /// @notice Set speed and chained speed markets AMM addresses
    /// @param _speedMarketsAMM to use address for creating speed markets
    /// @param _chainedSpeedMarketsAMM to use address for creating chained speed markets
    function setSpeedMarketsAMM(address _speedMarketsAMM, address _chainedSpeedMarketsAMM) external onlyOwner {
        speedMarketsAMM = _speedMarketsAMM;
        chainedSpeedMarketsAMM = _chainedSpeedMarketsAMM;
        emit SetSpeedMarketsAMM(_speedMarketsAMM, _chainedSpeedMarketsAMM);
    }

    //////////////////events/////////////////

    event AddSpeedMarket(SpeedMarketElem _speedMarketElem);
    event AddChainedSpeedMarket(ChainedSpeedMarketElem _chainedSpeedMarketElem);
    event CreateSpeedMarkets(uint _size);
    event CreateChainedSpeedMarkets(uint _size);

    event SetSpeedMarketsAMM(address _speedMarketsAMM, address _chainedSpeedMarketsAMM);

    event LogError(
        string _errorMessage,
        address _user,
        bool _isDefaultCollateral,
        uint64 _delta,
        uint64 _strikeTime,
        uint256 _createdAt
    );
}

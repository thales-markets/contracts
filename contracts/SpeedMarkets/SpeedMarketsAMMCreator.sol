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
    uint private constant ONE = 1e18;

    struct SpeedMarketParams {
        bytes32 asset;
        uint64 strikeTime;
        uint64 delta;
        uint strikePrice;
        uint strikePriceSlippage;
        SpeedMarket.Direction direction;
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
        uint strikePrice;
        uint strikePriceSlippage;
        SpeedMarket.Direction direction;
        address collateral;
        uint buyinAmount;
        address referrer;
        uint skewImpact;
        uint256 createdAt;
    }

    struct ChainedSpeedMarketParams {
        bytes32 asset;
        uint64 timeFrame;
        uint strikePrice;
        uint strikePriceSlippage;
        SpeedMarket.Direction[] directions;
        address collateral;
        uint buyinAmount;
        address referrer;
    }

    struct PendingChainedSpeedMarket {
        address user;
        bytes32 asset;
        uint64 timeFrame;
        uint strikePrice;
        uint strikePriceSlippage;
        SpeedMarket.Direction[] directions;
        address collateral;
        uint buyinAmount;
        address referrer;
        uint256 createdAt;
    }

    uint64 public maxCreationDelay;

    PendingSpeedMarket[] public pendingSpeedMarkets;
    PendingChainedSpeedMarket[] public pendingChainedSpeedMarkets;

    IAddressManager public addressManager;

    function initialize(address _owner, address _addressManager) external initializer {
        setOwner(_owner);
        addressManager = IAddressManager(_addressManager);
    }

    /// @notice add new speed market to pending - waiting for creation
    /// @param _params parameters for adding pending speed market
    function addPendingSpeedMarket(SpeedMarketParams calldata _params) external nonReentrant notPaused {
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

    /// @notice create all speed markets from pending using latest price feeds from param
    /// @param _priceUpdateData pyth priceUpdateData for all supported assets
    function createFromPendingSpeedMarkets(bytes[] calldata _priceUpdateData) external payable nonReentrant notPaused {
        require(pendingSpeedMarkets.length > 0, "No pending markets");
        require(_priceUpdateData.length > 0, "Empty price update data");

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();
        _updatePythPrice(contractsAddresses.pyth, _priceUpdateData);

        ISpeedMarketsAMM iSpeedMarketsAMM = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM);
        uint64 maximumPriceDelay = iSpeedMarketsAMM.maximumPriceDelay();
        uint8 createdSize;

        // process all pending speed markets
        for (uint8 i = 0; i < pendingSpeedMarkets.length; i++) {
            PendingSpeedMarket memory pendingSpeedMarket = pendingSpeedMarkets[i];

            if ((pendingSpeedMarket.createdAt + maxCreationDelay) <= block.timestamp) {
                // too late for processing
                continue;
            }

            PythStructs.Price memory pythPrice = _getPythPrice(
                contractsAddresses,
                pendingSpeedMarket.asset,
                maximumPriceDelay,
                pendingSpeedMarket.strikePrice,
                pendingSpeedMarket.strikePriceSlippage
            );

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
            {
                createdSize++;
            } catch Error(string memory reason) {
                emit LogError(reason, pendingSpeedMarket);
            } catch (bytes memory data) {
                emit LogErrorData(data, pendingSpeedMarket);
            }
        }

        uint pendingSize = pendingSpeedMarkets.length;
        delete pendingSpeedMarkets;

        emit CreateSpeedMarkets(pendingSize, createdSize);
    }

    /// @notice create speed market
    /// @param _speedMarketParams parameters for creating speed market
    /// @param _priceUpdateData pyth priceUpdateData for all supported assets
    function createSpeedMarket(SpeedMarketParams calldata _speedMarketParams, bytes[] calldata _priceUpdateData)
        external
        payable
        nonReentrant
        notPaused
    {
        require(_priceUpdateData.length > 0, "Empty price update data");

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();
        _updatePythPrice(contractsAddresses.pyth, _priceUpdateData);

        ISpeedMarketsAMM iSpeedMarketsAMM = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM);

        PythStructs.Price memory pythPrice = _getPythPrice(
            contractsAddresses,
            _speedMarketParams.asset,
            iSpeedMarketsAMM.maximumPriceDelay(),
            _speedMarketParams.strikePrice,
            _speedMarketParams.strikePriceSlippage
        );

        iSpeedMarketsAMM.createNewMarket(
            SpeedMarketsAMM.CreateMarketParams(
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

    //////////////////chained/////////////////

    /// @notice add new chained speed market to pending - waiting for creation
    /// @param _params parameters for adding pending chained speed market
    function addPendingChainedSpeedMarket(ChainedSpeedMarketParams calldata _params) external nonReentrant notPaused {
        PendingChainedSpeedMarket memory pendingChainedSpeedMarket = PendingChainedSpeedMarket(
            msg.sender,
            _params.asset,
            _params.timeFrame,
            _params.strikePrice,
            _params.strikePriceSlippage,
            _params.directions,
            _params.collateral,
            _params.buyinAmount,
            _params.referrer,
            block.timestamp
        );

        pendingChainedSpeedMarkets.push(pendingChainedSpeedMarket);

        emit AddChainedSpeedMarket(pendingChainedSpeedMarket);
    }

    /// @notice create all chained speed markets from pending using latest price feeds from param
    /// @param _priceUpdateData pyth priceUpdateData for all supported assets
    function createFromPendingChainedSpeedMarkets(bytes[] calldata _priceUpdateData)
        external
        payable
        nonReentrant
        notPaused
    {
        require(pendingChainedSpeedMarkets.length > 0, "No pending markets");
        require(_priceUpdateData.length > 0, "Empty price update data");

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();
        _updatePythPrice(contractsAddresses.pyth, _priceUpdateData);

        ISpeedMarketsAMM iSpeedMarketsAMM = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM);
        uint64 maximumPriceDelay = iSpeedMarketsAMM.maximumPriceDelay();
        uint8 createdSize;

        // process all pending chained speed markets
        for (uint8 i = 0; i < pendingChainedSpeedMarkets.length; i++) {
            PendingChainedSpeedMarket memory pendingChainedSpeedMarket = pendingChainedSpeedMarkets[i];

            if ((pendingChainedSpeedMarket.createdAt + maxCreationDelay) <= block.timestamp) {
                // too late for processing
                continue;
            }

            PythStructs.Price memory pythPrice = _getPythPrice(
                contractsAddresses,
                pendingChainedSpeedMarket.asset,
                maximumPriceDelay,
                pendingChainedSpeedMarket.strikePrice,
                pendingChainedSpeedMarket.strikePriceSlippage
            );

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
            {
                createdSize++;
            } catch Error(string memory reason) {
                emit LogChainedError(reason, pendingChainedSpeedMarket);
            } catch (bytes memory data) {
                emit LogChainedErrorData(data, pendingChainedSpeedMarket);
            }
        }

        uint pendingSize = pendingChainedSpeedMarkets.length;
        delete pendingChainedSpeedMarkets;

        emit CreateSpeedMarkets(pendingSize, createdSize);
    }

    /// @notice create chained speed market
    /// @param _chainedMarketParams parameters for creating chained speed market
    /// @param _priceUpdateData pyth priceUpdateData for all supported assets
    function createChainedSpeedMarket(
        ChainedSpeedMarketParams calldata _chainedMarketParams,
        bytes[] calldata _priceUpdateData
    ) external payable nonReentrant notPaused {
        require(_priceUpdateData.length > 0, "Empty price update data");

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();
        _updatePythPrice(contractsAddresses.pyth, _priceUpdateData);

        ISpeedMarketsAMM iSpeedMarketsAMM = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM);

        PythStructs.Price memory pythPrice = _getPythPrice(
            contractsAddresses,
            _chainedMarketParams.asset,
            iSpeedMarketsAMM.maximumPriceDelay(),
            _chainedMarketParams.strikePrice,
            _chainedMarketParams.strikePriceSlippage
        );

        IChainedSpeedMarketsAMM(addressManager.getAddress("ChainedSpeedMarketsAMM")).createNewMarket(
            ChainedSpeedMarketsAMM.CreateMarketParams(
                msg.sender,
                _chainedMarketParams.asset,
                _chainedMarketParams.timeFrame,
                pythPrice,
                _chainedMarketParams.directions,
                _chainedMarketParams.collateral,
                _chainedMarketParams.buyinAmount,
                _chainedMarketParams.referrer
            )
        );
    }

    function _updatePythPrice(address _pyth, bytes[] calldata _priceUpdateData) internal {
        IPyth iPyth = IPyth(_pyth);
        iPyth.updatePriceFeeds{value: iPyth.getUpdateFee(_priceUpdateData)}(_priceUpdateData);
    }

    function _getPythPrice(
        IAddressManager.Addresses memory _contractsAddresses,
        bytes32 _asset,
        uint64 _maximumPriceDelay,
        uint _strikePrice,
        uint _strikePriceSlippage
    ) internal view returns (PythStructs.Price memory pythPrice) {
        ISpeedMarketsAMM iSpeedMarketsAMM = ISpeedMarketsAMM(_contractsAddresses.speedMarketsAMM);
        IPyth iPyth = IPyth(_contractsAddresses.pyth);

        pythPrice = iPyth.getPriceUnsafe(iSpeedMarketsAMM.assetToPythId(_asset));
        require((pythPrice.publishTime + _maximumPriceDelay) > block.timestamp && pythPrice.price > 0, "Stale price");

        int64 maxPrice = int64(uint64((_strikePrice * (ONE + _strikePriceSlippage)) / ONE));
        int64 minPrice = int64(uint64((_strikePrice * (ONE - _strikePriceSlippage)) / ONE));
        require(pythPrice.price <= maxPrice && pythPrice.price >= minPrice, "Pyth price exceeds slippage");
    }

    //////////////////getters/////////////////

    /// @notice get length of pending speed markets
    function getPendingSpeedMarketsSize() external view returns (uint) {
        return pendingSpeedMarkets.length;
    }

    /// @notice get length of pending chained speed markets
    function getPendingChainedSpeedMarketsSize() external view returns (uint) {
        return pendingChainedSpeedMarkets.length;
    }

    //////////////////setters/////////////////

    /// @notice Set address of address manager
    /// @param _addressManager to use address for fetching other contract addresses
    function setAddressManager(address _addressManager) external onlyOwner {
        addressManager = IAddressManager(_addressManager);
        emit SetAddressManager(_addressManager);
    }

    /// @notice Set max creation delay
    function setMaxCreationDelay(uint64 _maxCreationDelay) external onlyOwner {
        maxCreationDelay = _maxCreationDelay;
        emit SetMaxCreationDelay(_maxCreationDelay);
    }

    //////////////////events/////////////////

    event AddSpeedMarket(PendingSpeedMarket _pendingSpeedMarket);
    event AddChainedSpeedMarket(PendingChainedSpeedMarket _pendingChainedSpeedMarket);
    event CreateSpeedMarkets(uint _pendingSize, uint8 _createdSize);

    event SetAddressManager(address _addressManager);
    event SetMaxCreationDelay(uint64 _maxCreationDelay);

    event LogError(string _errorMessage, PendingSpeedMarket _pendingSpeedMarket);
    event LogErrorData(bytes _data, PendingSpeedMarket _pendingSpeedMarket);

    event LogChainedError(string _errorMessage, PendingChainedSpeedMarket _pendingChainedSpeedMarket);
    event LogChainedErrorData(bytes _data, PendingChainedSpeedMarket _pendingChainedSpeedMarket);
}

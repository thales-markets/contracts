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
    uint private constant ONE = 1e18;

    struct SpeedMarketParams {
        bytes32 asset;
        uint64 strikeTime;
        uint64 delta;
        uint strikePrice;
        uint strikePriceSlippage;
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
        uint strikePrice;
        uint strikePriceSlippage;
        SpeedMarkets.Direction direction;
        address collateral;
        uint buyinAmount;
        address referrer;
        uint skewImpact;
        uint256 createdAt;
    }

    uint64 public maxCreationDelay;

    PendingSpeedMarket[] public pendingSpeedMarkets;

    IAddressManager public addressManager;

    mapping(address => bool) public whitelistedAddresses;

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
    function createFromPendingSpeedMarkets(bytes[] calldata _priceUpdateData)
        external
        payable
        nonReentrant
        notPaused
        isAddressWhitelisted
    {
        if (pendingSpeedMarkets.length == 0) {
            return;
        }
        require(_priceUpdateData.length > 0, "Empty price update data");

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();
        _updatePythPrice(contractsAddresses.pyth, _priceUpdateData);

        ISpeedMarkets iSpeedMarkets = ISpeedMarkets(contractsAddresses.speedMarketsAMM);
        uint64 maximumPriceDelay = iSpeedMarkets.maximumPriceDelay();
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
                        pendingSpeedMarket.skewImpact,
                        i
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
        isAddressWhitelisted
    {
        require(_priceUpdateData.length > 0, "Empty price update data");

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();
        _updatePythPrice(contractsAddresses.pyth, _priceUpdateData);

        ISpeedMarkets iSpeedMarkets = ISpeedMarkets(contractsAddresses.speedMarketsAMM);

        PythStructs.Price memory pythPrice = _getPythPrice(
            contractsAddresses,
            _speedMarketParams.asset,
            iSpeedMarkets.maximumPriceDelay(),
            _speedMarketParams.strikePrice,
            _speedMarketParams.strikePriceSlippage
        );

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
                _speedMarketParams.skewImpact,
                0
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
        ISpeedMarkets iSpeedMarkets = ISpeedMarkets(_contractsAddresses.speedMarketsAMM);
        IPyth iPyth = IPyth(_contractsAddresses.pyth);

        pythPrice = iPyth.getPriceUnsafe(iSpeedMarkets.assetToPythId(_asset));
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

    /// @notice adding/removing whitelist address depending on a flag
    /// @param _whitelistAddress address that needed to be whitelisted or removed from WL
    /// @param _flag adding or removing from whitelist (true: add, false: remove)
    function addToWhitelist(address _whitelistAddress, bool _flag) external onlyOwner {
        require(_whitelistAddress != address(0));
        whitelistedAddresses[_whitelistAddress] = _flag;
        emit AddedIntoWhitelist(_whitelistAddress, _flag);
    }

    //////////////////modifiers/////////////////

    modifier isAddressWhitelisted() {
        require(whitelistedAddresses[msg.sender], "Creator not whitelisted");
        _;
    }

    //////////////////events/////////////////

    event AddSpeedMarket(PendingSpeedMarket _PendingSpeedMarket);
    event CreateSpeedMarkets(uint _pendingSize, uint8 _createdSize);

    event SetAddressManager(address _addressManager);
    event SetMaxCreationDelay(uint64 _maxCreationDelay);
    event AddedIntoWhitelist(address _whitelistAddress, bool _flag);

    event LogError(string _errorMessage, PendingSpeedMarket _pendingSpeedMarket);
    event LogErrorData(bytes _data, PendingSpeedMarket _pendingSpeedMarket);
}

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
import "../interfaces/IFreeBetsHolder.sol";

import "./SpeedMarketsAMM.sol";

/// @title speed/chained markets prepared for creation with latest Pyth price
contract SpeedMarketsAMMCreator is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    uint private constant ONE = 1e18;
    address constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

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

    mapping(address => bool) public whitelistedAddresses;

    mapping(bytes32 => address) public requestIdToMarket;

    function initialize(address _owner, address _addressManager) external initializer {
        setOwner(_owner);
        addressManager = IAddressManager(_addressManager);
    }

    /// @notice add new speed market to pending - waiting for creation
    /// @param _params parameters for adding pending speed market
    function addPendingSpeedMarket(SpeedMarketParams calldata _params)
        external
        nonReentrant
        notPaused
        returns (bytes32 requestId)
    {
        return _addPendingSpeedMarket(_params);
    }

    function _addPendingSpeedMarket(SpeedMarketParams calldata _params) internal returns (bytes32 requestId) {
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

        requestId = keccak256(abi.encode(pendingSpeedMarket));

        emit AddSpeedMarket(pendingSpeedMarket, requestId);
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
        address freeBetsHolder = addressManager.getAddress("FreeBetsHolder");
        _updatePythPrice(contractsAddresses.pyth, _priceUpdateData);

        ISpeedMarketsAMM iSpeedMarketsAMM = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM);
        uint64 maximumPriceDelay = iSpeedMarketsAMM.maximumPriceDelay();
        uint8 createdSize;

        // process all pending speed markets
        for (uint8 i = 0; i < pendingSpeedMarkets.length; i++) {
            PendingSpeedMarket memory pendingSpeedMarket = pendingSpeedMarkets[i];
            bytes32 requestId = keccak256(abi.encode(pendingSpeedMarket));

            if ((pendingSpeedMarket.createdAt + maxCreationDelay) <= block.timestamp) {
                // too late for processing
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogError("maxCreationDelay expired", pendingSpeedMarket);
                continue;
            }

            PythStructs.Price memory pythPrice = _getPythPrice(contractsAddresses, pendingSpeedMarket.asset);

            bool isStalePrice = (pythPrice.publishTime + maximumPriceDelay) <= block.timestamp || pythPrice.price <= 0;
            if (isStalePrice) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogError("Stale price", pendingSpeedMarket);
                continue;
            }

            int64 maxPrice = int64(
                uint64((pendingSpeedMarket.strikePrice * (ONE + pendingSpeedMarket.strikePriceSlippage)) / ONE)
            );
            int64 minPrice = int64(
                uint64((pendingSpeedMarket.strikePrice * (ONE - pendingSpeedMarket.strikePriceSlippage)) / ONE)
            );
            if (pythPrice.price > maxPrice || pythPrice.price < minPrice) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogError("Pyth price exceeds slippage", pendingSpeedMarket);
                continue;
            }

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
            returns (address speedMarketAddress) {
                emit LogCreatedSpeedMarket(speedMarketAddress, freeBetsHolder, pendingSpeedMarket.user);
                if (
                    speedMarketAddress != address(0) &&
                    freeBetsHolder != address(0) &&
                    pendingSpeedMarket.user == freeBetsHolder
                ) {
                    uint buyAmount = pendingSpeedMarket.buyinAmount;
                    if (iSpeedMarketsAMM.supportedNativeCollateral(pendingSpeedMarket.collateral)) {
                        SpeedMarket sm = SpeedMarket(speedMarketAddress);
                        buyAmount = (pendingSpeedMarket.buyinAmount * (ONE + sm.safeBoxImpact() + sm.lpFee())) / ONE;
                    }
                    IFreeBetsHolder(freeBetsHolder).confirmSpeedOrChainedSpeedMarketTrade(
                        requestId,
                        speedMarketAddress,
                        pendingSpeedMarket.collateral,
                        buyAmount,
                        false
                    );
                }
                createdSize++;
                requestIdToMarket[requestId] = speedMarketAddress;
            } catch Error(string memory reason) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogError(reason, pendingSpeedMarket);
            } catch (bytes memory data) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
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

        ISpeedMarketsAMM iSpeedMarketsAMM = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM);

        PythStructs.Price memory pythPrice = _getPythPrice(contractsAddresses, _speedMarketParams.asset);

        require(
            (pythPrice.publishTime + iSpeedMarketsAMM.maximumPriceDelay()) > block.timestamp && pythPrice.price > 0,
            "Stale price"
        );

        int64 maxPrice = int64(
            uint64((_speedMarketParams.strikePrice * (ONE + _speedMarketParams.strikePriceSlippage)) / ONE)
        );
        int64 minPrice = int64(
            uint64((_speedMarketParams.strikePrice * (ONE - _speedMarketParams.strikePriceSlippage)) / ONE)
        );
        require(pythPrice.price <= maxPrice && pythPrice.price >= minPrice, "Pyth price exceeds slippage");

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
    function addPendingChainedSpeedMarket(ChainedSpeedMarketParams calldata _params)
        external
        nonReentrant
        notPaused
        returns (bytes32 requestId)
    {
        return _addPendingChainedSpeedMarket(_params);
    }

    function _addPendingChainedSpeedMarket(ChainedSpeedMarketParams calldata _params) internal returns (bytes32 requestId) {
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

        requestId = keccak256(abi.encode(pendingChainedSpeedMarket));

        emit AddChainedSpeedMarket(pendingChainedSpeedMarket, requestId);
    }

    /// @notice create all chained speed markets from pending using latest price feeds from param
    /// @param _priceUpdateData pyth priceUpdateData for all supported assets
    function createFromPendingChainedSpeedMarkets(bytes[] calldata _priceUpdateData)
        external
        payable
        nonReentrant
        notPaused
        isAddressWhitelisted
    {
        if (pendingChainedSpeedMarkets.length == 0) {
            return;
        }
        require(_priceUpdateData.length > 0, "Empty price update data");

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();
        address freeBetsHolder = addressManager.getAddress("FreeBetsHolder");
        _updatePythPrice(contractsAddresses.pyth, _priceUpdateData);

        ISpeedMarketsAMM iSpeedMarketsAMM = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM);
        uint64 maximumPriceDelay = iSpeedMarketsAMM.maximumPriceDelay();
        uint8 createdSize;

        // process all pending chained speed markets
        for (uint8 i = 0; i < pendingChainedSpeedMarkets.length; i++) {
            PendingChainedSpeedMarket memory pendingChainedSpeedMarket = pendingChainedSpeedMarkets[i];
            bytes32 requestId = keccak256(abi.encode(pendingChainedSpeedMarket));

            if ((pendingChainedSpeedMarket.createdAt + maxCreationDelay) <= block.timestamp) {
                // too late for processing
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogChainedError("maxCreationDelay expired", pendingChainedSpeedMarket);
                continue;
            }

            PythStructs.Price memory pythPrice = _getPythPrice(contractsAddresses, pendingChainedSpeedMarket.asset);

            bool isStalePrice = (pythPrice.publishTime + maximumPriceDelay) <= block.timestamp || pythPrice.price <= 0;
            if (isStalePrice) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogChainedError("Stale price", pendingChainedSpeedMarket);
                continue;
            }

            int64 maxPrice = int64(
                uint64((pendingChainedSpeedMarket.strikePrice * (ONE + pendingChainedSpeedMarket.strikePriceSlippage)) / ONE)
            );
            int64 minPrice = int64(
                uint64((pendingChainedSpeedMarket.strikePrice * (ONE - pendingChainedSpeedMarket.strikePriceSlippage)) / ONE)
            );
            if (pythPrice.price > maxPrice || pythPrice.price < minPrice) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogChainedError("Pyth price exceeds slippage", pendingChainedSpeedMarket);
                continue;
            }

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
            returns (address chainedSpeedMarketAddress) {
                if (chainedSpeedMarketAddress != address(0) && pendingChainedSpeedMarket.user == freeBetsHolder) {
                    uint buyAmount = pendingChainedSpeedMarket.buyinAmount;
                    if (iSpeedMarketsAMM.supportedNativeCollateral(pendingChainedSpeedMarket.collateral)) {
                        ChainedSpeedMarket csm = ChainedSpeedMarket(chainedSpeedMarketAddress);
                        buyAmount = (pendingChainedSpeedMarket.buyinAmount * (ONE + csm.safeBoxImpact())) / ONE;
                    }
                    IFreeBetsHolder(freeBetsHolder).confirmSpeedOrChainedSpeedMarketTrade(
                        requestId,
                        chainedSpeedMarketAddress,
                        pendingChainedSpeedMarket.collateral,
                        pendingChainedSpeedMarket.buyinAmount,
                        true
                    );
                }
                requestIdToMarket[requestId] = chainedSpeedMarketAddress;
                createdSize++;
            } catch Error(string memory reason) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogChainedError(reason, pendingChainedSpeedMarket);
            } catch (bytes memory data) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
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
    ) external payable nonReentrant notPaused isAddressWhitelisted {
        require(_priceUpdateData.length > 0, "Empty price update data");

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();
        _updatePythPrice(contractsAddresses.pyth, _priceUpdateData);

        ISpeedMarketsAMM iSpeedMarketsAMM = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM);

        PythStructs.Price memory pythPrice = _getPythPrice(contractsAddresses, _chainedMarketParams.asset);

        require(
            (pythPrice.publishTime + iSpeedMarketsAMM.maximumPriceDelay()) > block.timestamp && pythPrice.price > 0,
            "Stale price"
        );

        int64 maxPrice = int64(
            uint64((_chainedMarketParams.strikePrice * (ONE + _chainedMarketParams.strikePriceSlippage)) / ONE)
        );
        int64 minPrice = int64(
            uint64((_chainedMarketParams.strikePrice * (ONE - _chainedMarketParams.strikePriceSlippage)) / ONE)
        );
        require(pythPrice.price <= maxPrice && pythPrice.price >= minPrice, "Pyth price exceeds slippage");

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

    function _getPythPrice(IAddressManager.Addresses memory _contractsAddresses, bytes32 _asset)
        internal
        view
        returns (PythStructs.Price memory pythPrice)
    {
        ISpeedMarketsAMM iSpeedMarketsAMM = ISpeedMarketsAMM(_contractsAddresses.speedMarketsAMM);
        IPyth iPyth = IPyth(_contractsAddresses.pyth);

        pythPrice = iPyth.getPriceUnsafe(iSpeedMarketsAMM.assetToPythId(_asset));
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

    function getChainedAndSpeedMarketsAMMAddresses()
        external
        view
        returns (address chainedSpeedMarketsAMM, address speedMarketsAMM)
    {
        string[] memory contractNames = new string[](2);
        contractNames[0] = "ChainedSpeedMarketsAMM";
        contractNames[1] = "SpeedMarketsAMM";
        address[] memory addresses = addressManager.getAddresses(contractNames);
        return (addresses[0], addresses[1]);
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

    event AddSpeedMarket(PendingSpeedMarket _pendingSpeedMarket, bytes32 _requestId);
    event AddChainedSpeedMarket(PendingChainedSpeedMarket _pendingChainedSpeedMarket, bytes32 _requestId);
    event CreateSpeedMarkets(uint _pendingSize, uint8 _createdSize);

    event SetAddressManager(address _addressManager);
    event SetMaxCreationDelay(uint64 _maxCreationDelay);
    event AddedIntoWhitelist(address _whitelistAddress, bool _flag);

    event LogError(string _errorMessage, PendingSpeedMarket _pendingSpeedMarket);
    event LogErrorData(bytes _data, PendingSpeedMarket _pendingSpeedMarket);

    event LogChainedError(string _errorMessage, PendingChainedSpeedMarket _pendingChainedSpeedMarket);
    event LogChainedErrorData(bytes _data, PendingChainedSpeedMarket _pendingChainedSpeedMarket);
    event LogCreatedSpeedMarket(address _speedMarketAddress, address _freeBetsHolder, address _user);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

import "./ChainlinkStructs.sol";

import "../interfaces/IAddressManager.sol";
import "../interfaces/ISpeedMarketsAMM.sol";
import "../interfaces/IChainedSpeedMarketsAMM.sol";
import "../interfaces/IChainlinkVerifierProxy.sol";
import "../interfaces/IChainlinkFeeManager.sol";
import "../interfaces/IWeth.sol";

/// @title speed/chained markets prepared for creation with latest oracle price
contract SpeedMarketsAMMCreator is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint private constant ONE = 1e18;
    int192 private constant PRICE_DIVISOR = 1e10;
    address constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    struct SpeedMarketParams {
        bytes32 asset;
        uint64 strikeTime;
        uint64 delta;
        uint strikePrice;
        uint strikePriceSlippage;
        ISpeedMarketsAMM.OracleSource oracleSource;
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
        ISpeedMarketsAMM.OracleSource oracleSource;
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

    struct CreateFromPendingSpeedParams {
        ISpeedMarketsAMM.OracleSource oracleSource;
        bytes[] priceUpdateData;
        uint64 minDelta;
    }

    uint64 public maxCreationDelay;

    PendingSpeedMarket[] public pendingSpeedMarkets;
    PendingChainedSpeedMarket[] public pendingChainedSpeedMarkets;

    IAddressManager public addressManager;

    mapping(address => bool) public whitelistedAddresses;

    mapping(bytes32 => address) public requestIdToMarket;

    receive() external payable {}

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

    /// @notice Creates all pending speed markets using the latest oracle price feeds.
    /// @param _params Struct containing all parameters required to process pending markets:
    /// - `oracleSource`: The oracle source to use for price updates (e.g., Pyth, Chainlink).
    /// - `priceUpdateData`: The oracle price update payloads for all supported assets.
    /// - `minDelta`: The minimum allowed time delta for pending market creation.
    function createFromPendingSpeedMarkets(CreateFromPendingSpeedParams calldata _params)
        external
        payable
        nonReentrant
        notPaused
        isAddressWhitelisted
    {
        if (pendingSpeedMarkets.length == 0) {
            return;
        }
        require(_params.priceUpdateData.length > 0, "Empty price update data");

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();
        if (_params.oracleSource == ISpeedMarketsAMM.OracleSource.Pyth) {
            _updatePythPrice(contractsAddresses.pyth, _params.priceUpdateData);
        }

        ISpeedMarketsAMM iSpeedMarketsAMM = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM);
        uint64 maximumPriceDelay = iSpeedMarketsAMM.maximumPriceDelay();
        uint8 createdSize;

        // process all pending speed markets
        for (uint8 i = 0; i < pendingSpeedMarkets.length; i++) {
            PendingSpeedMarket memory pendingSpeedMarket = pendingSpeedMarkets[i];
            bytes32 requestId = keccak256(abi.encode(pendingSpeedMarket));

            if (_isExpired(pendingSpeedMarket.createdAt)) {
                // too late for processing
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogError("maxCreationDelay expired", pendingSpeedMarket, requestId);
                continue;
            }

            if (_isInvalidDelta(pendingSpeedMarket.strikeTime, pendingSpeedMarket.delta, _params.minDelta)) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogError("invalid delta/strike time", pendingSpeedMarket, requestId);
                continue;
            }

            (int64 price, uint64 publishTime) = _getPriceAndPublishTime(
                contractsAddresses,
                pendingSpeedMarket.asset,
                _params.oracleSource,
                _params.priceUpdateData
            );

            if (_isStalePrice(price, publishTime, maximumPriceDelay)) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogError("Stale price", pendingSpeedMarket, requestId);
                continue;
            }

            if (_isPriceSlippageExceeded(price, pendingSpeedMarket.strikePrice, pendingSpeedMarket.strikePriceSlippage)) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogError("price exceeds slippage", pendingSpeedMarket, requestId);
                continue;
            }

            SpeedMarketsAMM.CreateMarketParams memory marketParams = SpeedMarketsAMM.CreateMarketParams({
                user: pendingSpeedMarket.user,
                asset: pendingSpeedMarket.asset,
                strikeTime: pendingSpeedMarket.strikeTime,
                delta: pendingSpeedMarket.delta,
                strikePrice: price,
                strikePricePublishTime: publishTime,
                oracleSource: _params.oracleSource,
                direction: pendingSpeedMarket.direction,
                collateral: pendingSpeedMarket.collateral,
                collateralAmount: pendingSpeedMarket.buyinAmount,
                referrer: pendingSpeedMarket.referrer,
                skewImpact: pendingSpeedMarket.skewImpact
            });

            try iSpeedMarketsAMM.createNewMarket(marketParams) returns (address speedMarketAddress) {
                requestIdToMarket[requestId] = speedMarketAddress;
                createdSize++;
            } catch Error(string memory reason) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogError(reason, pendingSpeedMarket, requestId);
            } catch (bytes memory data) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogErrorData(data, pendingSpeedMarket, requestId);
            }
        }

        uint pendingSize = pendingSpeedMarkets.length;
        delete pendingSpeedMarkets;

        emit CreateSpeedMarkets(pendingSize, createdSize);
    }

    /// @notice Deletes pending speed markets.
    /// @dev Can delete all markets or only those for specific users.
    /// @param _all If true, deletes all pending markets. If false, deletes only markets for `_users`.
    /// @param _users An array of addresses whose pending markets should be removed. Ignored if `_all` is true.
    function deletePendingSpeedMarkets(bool _all, address[] calldata _users) external isAddressWhitelisted {
        if (_all) {
            delete pendingSpeedMarkets;
            return;
        }

        uint i = 0;
        while (i < pendingSpeedMarkets.length) {
            bool shouldDelete = false;
            for (uint j = 0; j < _users.length; j++) {
                if (pendingSpeedMarkets[i].user == _users[j]) {
                    shouldDelete = true;
                    break;
                }
            }

            if (shouldDelete) {
                // Swap with last element and pop
                pendingSpeedMarkets[i] = pendingSpeedMarkets[pendingSpeedMarkets.length - 1];
                pendingSpeedMarkets.pop();
            } else {
                i++;
            }
        }
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
    /// @param _oracleSource oracle source for priceUpdateData
    /// @param _priceUpdateData oracle priceUpdateData for all supported assets
    function createFromPendingChainedSpeedMarkets(
        ISpeedMarketsAMM.OracleSource _oracleSource,
        bytes[] calldata _priceUpdateData
    ) external payable nonReentrant notPaused isAddressWhitelisted {
        if (pendingChainedSpeedMarkets.length == 0) {
            return;
        }
        require(_priceUpdateData.length > 0, "Empty price update data");

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();
        if (_oracleSource == ISpeedMarketsAMM.OracleSource.Pyth) {
            _updatePythPrice(contractsAddresses.pyth, _priceUpdateData);
        }

        ISpeedMarketsAMM iSpeedMarketsAMM = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM);
        uint64 maximumPriceDelay = iSpeedMarketsAMM.maximumPriceDelay();
        uint8 createdSize;

        // process all pending chained speed markets
        for (uint8 i = 0; i < pendingChainedSpeedMarkets.length; i++) {
            PendingChainedSpeedMarket memory pendingChainedSpeedMarket = pendingChainedSpeedMarkets[i];
            bytes32 requestId = keccak256(abi.encode(pendingChainedSpeedMarket));

            if (_isExpired(pendingChainedSpeedMarket.createdAt)) {
                // too late for processing
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogChainedError("maxCreationDelay expired", pendingChainedSpeedMarket, requestId);
                continue;
            }

            (int64 price, uint64 publishTime) = _getPriceAndPublishTime(
                contractsAddresses,
                pendingChainedSpeedMarket.asset,
                _oracleSource,
                _priceUpdateData
            );

            if (_isStalePrice(price, publishTime, maximumPriceDelay)) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogChainedError("Stale price", pendingChainedSpeedMarket, requestId);
                continue;
            }

            if (
                _isPriceSlippageExceeded(
                    price,
                    pendingChainedSpeedMarket.strikePrice,
                    pendingChainedSpeedMarket.strikePriceSlippage
                )
            ) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogChainedError("price exceeds slippage", pendingChainedSpeedMarket, requestId);
                continue;
            }

            ChainedSpeedMarketsAMM.CreateMarketParams memory marketParams = ChainedSpeedMarketsAMM.CreateMarketParams({
                user: pendingChainedSpeedMarket.user,
                asset: pendingChainedSpeedMarket.asset,
                timeFrame: pendingChainedSpeedMarket.timeFrame,
                strikePrice: price,
                oracleSource: _oracleSource,
                directions: pendingChainedSpeedMarket.directions,
                collateral: pendingChainedSpeedMarket.collateral,
                collateralAmount: pendingChainedSpeedMarket.buyinAmount,
                referrer: pendingChainedSpeedMarket.referrer
            });

            try
                IChainedSpeedMarketsAMM(addressManager.getAddress("ChainedSpeedMarketsAMM")).createNewMarket(marketParams)
            returns (address chainedSpeedMarketAddress) {
                requestIdToMarket[requestId] = chainedSpeedMarketAddress;
                createdSize++;
            } catch Error(string memory reason) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogChainedError(reason, pendingChainedSpeedMarket, requestId);
            } catch (bytes memory data) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogChainedErrorData(data, pendingChainedSpeedMarket, requestId);
            }
        }

        uint pendingSize = pendingChainedSpeedMarkets.length;
        delete pendingChainedSpeedMarkets;

        emit CreateSpeedMarkets(pendingSize, createdSize);
    }

    /**
     * @notice Withdraw all balance of an ERC-20 token held by this contract.
     * @param _destination Address that receives the tokens.
     * @param _collateral  ERC-20 token address.
     * @param _amount      ERC-20 token amount.
     */
    function transferAmount(
        address _destination,
        address _collateral,
        uint256 _amount
    ) external onlyOwner {
        IERC20Upgradeable(_collateral).safeTransfer(_destination, _amount);
        emit AmountTransfered(_collateral, _destination, _amount);
    }

    /// ========== INTERNAL FUNCTIONS ==========

    function _isExpired(uint256 _createdAt) internal view returns (bool) {
        return (_createdAt + maxCreationDelay) <= block.timestamp;
    }

    function _isInvalidDelta(
        uint64 _strikeTime,
        uint64 _delta,
        uint64 _minDelta
    ) internal view returns (bool) {
        if (_strikeTime == 0) return _delta < _minDelta;
        if (_strikeTime <= block.timestamp) return true;
        return (_strikeTime - block.timestamp) < _minDelta;
    }

    function _isStalePrice(
        int64 _price,
        uint64 _publishTime,
        uint64 _maximumPriceDelay
    ) internal view returns (bool) {
        return (_publishTime + _maximumPriceDelay) <= block.timestamp || _price <= 0;
    }

    function _isPriceSlippageExceeded(
        int64 _price,
        uint _strikePrice,
        uint _slippage
    ) internal view returns (bool) {
        int64 maxPrice = int64(uint64((_strikePrice * (ONE + _slippage)) / ONE));
        int64 minPrice = int64(uint64((_strikePrice * (ONE - _slippage)) / ONE));
        return _price > maxPrice || _price < minPrice;
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

    function _verifyChainlinkReport(bytes memory _unverifiedReport)
        internal
        returns (ChainlinkStructs.ReportV3 memory verifiedReport)
    {
        IChainlinkVerifierProxy iChainlinkVerifier = IChainlinkVerifierProxy(
            address(addressManager.getAddress("ChainlinkVerifier"))
        );

        IChainlinkFeeManager iChainlinkFeeManager = IChainlinkFeeManager(address(iChainlinkVerifier.s_feeManager()));

        bytes memory parameterPayload;
        if (address(iChainlinkFeeManager) != address(0)) {
            // FeeManager exists — always quote & approve
            address feeToken = iChainlinkFeeManager.i_nativeAddress();

            (, bytes memory reportData) = abi.decode(_unverifiedReport, (bytes32[3], bytes));

            (Common.Asset memory fee, , ) = iChainlinkFeeManager.getFeeAndReward(address(this), reportData, feeToken);

            if (fee.amount > 0) {
                IWeth(feeToken).deposit{value: fee.amount}();
                IERC20Upgradeable(feeToken).approve(address(iChainlinkFeeManager), fee.amount);
            }
            parameterPayload = abi.encode(feeToken);
        } else {
            // No FeeManager deployed on this chain
            parameterPayload = bytes("");
        }

        bytes memory verified = iChainlinkVerifier.verify(_unverifiedReport, parameterPayload);
        verifiedReport = abi.decode(verified, (ChainlinkStructs.ReportV3));
    }

    function _getPriceAndPublishTime(
        IAddressManager.Addresses memory _contractsAddresses,
        bytes32 _asset,
        ISpeedMarketsAMM.OracleSource _oracleSource,
        bytes[] memory _unverifiedReports
    ) internal returns (int64 price, uint64 publishTime) {
        if (_oracleSource == ISpeedMarketsAMM.OracleSource.Chainlink) {
            // Chainlink
            ISpeedMarketsAMM iSpeedMarketsAMM = ISpeedMarketsAMM(_contractsAddresses.speedMarketsAMM);
            bytes32 requiredFeedId = iSpeedMarketsAMM.assetToChainlinkId(_asset);

            bytes memory unverifiedReport;
            for (uint8 i = 0; i < _unverifiedReports.length; i++) {
                (, bytes memory reportData) = abi.decode(_unverifiedReports[i], (bytes32[3], bytes));
                ChainlinkStructs.ReportV3 memory report = abi.decode(reportData, (ChainlinkStructs.ReportV3));
                if (report.feedId == requiredFeedId) {
                    unverifiedReport = _unverifiedReports[i];
                    break;
                }
            }
            if (unverifiedReport.length == 0) {
                price = 0;
                publishTime = 0;
            } else {
                ChainlinkStructs.ReportV3 memory verifiedReport = _verifyChainlinkReport(unverifiedReport);
                price = int64(verifiedReport.price / PRICE_DIVISOR); // safe only for assets on 18 decimals (max decimal price: 92,233,720.36854775)
                publishTime = uint64(verifiedReport.validFromTimestamp);
            }
        } else {
            // Pyth
            PythStructs.Price memory pythPrice = _getPythPrice(_contractsAddresses, _asset);
            price = pythPrice.price;
            publishTime = uint64(pythPrice.publishTime);
        }
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
    event AmountTransfered(address _destination, address _collateral, uint256 _amount);

    event SetAddressManager(address _addressManager);
    event SetMaxCreationDelay(uint64 _maxCreationDelay);
    event AddedIntoWhitelist(address _whitelistAddress, bool _flag);

    event LogError(string _errorMessage, PendingSpeedMarket _pendingSpeedMarket, bytes32 _requestId);
    event LogErrorData(bytes _data, PendingSpeedMarket _pendingSpeedMarket, bytes32 _requestId);

    event LogChainedError(string _errorMessage, PendingChainedSpeedMarket _pendingChainedSpeedMarket, bytes32 _requestId);
    event LogChainedErrorData(bytes _data, PendingChainedSpeedMarket _pendingChainedSpeedMarket, bytes32 _requestId);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

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

    ISpeedMarketsAMM.OracleSource public oracleSource;

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
    /// @param _priceUpdateData oracle priceUpdateData for all supported assets
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
        if (oracleSource == ISpeedMarketsAMM.OracleSource.Pyth) {
            _updatePythPrice(contractsAddresses.pyth, _priceUpdateData);
        }

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

            (int64 price, uint64 publishTime) = _getPriceAndPublishTime(
                contractsAddresses,
                pendingSpeedMarket.asset,
                _priceUpdateData
            );

            bool isStalePrice = (publishTime + maximumPriceDelay) <= block.timestamp || price <= 0;
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
            if (price > maxPrice || price < minPrice) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogError("price exceeds slippage", pendingSpeedMarket);
                continue;
            }

            try
                iSpeedMarketsAMM.createNewMarket(
                    SpeedMarketsAMM.CreateMarketParams(
                        pendingSpeedMarket.user,
                        pendingSpeedMarket.asset,
                        pendingSpeedMarket.strikeTime,
                        pendingSpeedMarket.delta,
                        price,
                        publishTime,
                        pendingSpeedMarket.direction,
                        pendingSpeedMarket.collateral,
                        pendingSpeedMarket.buyinAmount,
                        pendingSpeedMarket.referrer,
                        pendingSpeedMarket.skewImpact
                    )
                )
            returns (address speedMarketAddress) {
                requestIdToMarket[requestId] = speedMarketAddress;
                createdSize++;
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
    /// @param _priceUpdateData oracle priceUpdateData for all supported assets
    function createSpeedMarket(SpeedMarketParams calldata _speedMarketParams, bytes[] calldata _priceUpdateData)
        external
        payable
        nonReentrant
        notPaused
        isAddressWhitelisted
    {
        require(_priceUpdateData.length > 0, "Empty price update data");

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();
        if (oracleSource == ISpeedMarketsAMM.OracleSource.Pyth) {
            _updatePythPrice(contractsAddresses.pyth, _priceUpdateData);
        }

        ISpeedMarketsAMM iSpeedMarketsAMM = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM);

        (int64 price, uint64 publishTime) = _getPriceAndPublishTime(
            contractsAddresses,
            _speedMarketParams.asset,
            _priceUpdateData
        );

        require((publishTime + iSpeedMarketsAMM.maximumPriceDelay()) > block.timestamp && price > 0, "Stale price");

        int64 maxPrice = int64(
            uint64((_speedMarketParams.strikePrice * (ONE + _speedMarketParams.strikePriceSlippage)) / ONE)
        );
        int64 minPrice = int64(
            uint64((_speedMarketParams.strikePrice * (ONE - _speedMarketParams.strikePriceSlippage)) / ONE)
        );
        require(price <= maxPrice && price >= minPrice, "price exceeds slippage");

        iSpeedMarketsAMM.createNewMarket(
            SpeedMarketsAMM.CreateMarketParams(
                msg.sender,
                _speedMarketParams.asset,
                _speedMarketParams.strikeTime,
                _speedMarketParams.delta,
                price,
                publishTime,
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
    /// @param _priceUpdateData oracle priceUpdateData for all supported assets
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
        if (oracleSource == ISpeedMarketsAMM.OracleSource.Pyth) {
            _updatePythPrice(contractsAddresses.pyth, _priceUpdateData);
        }

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

            (int64 price, uint64 publishTime) = _getPriceAndPublishTime(
                contractsAddresses,
                pendingChainedSpeedMarket.asset,
                _priceUpdateData
            );

            bool isStalePrice = (publishTime + maximumPriceDelay) <= block.timestamp || price <= 0;
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
            if (price > maxPrice || price < minPrice) {
                requestIdToMarket[requestId] = DEAD_ADDRESS;
                emit LogChainedError("price exceeds slippage", pendingChainedSpeedMarket);
                continue;
            }

            try
                IChainedSpeedMarketsAMM(addressManager.getAddress("ChainedSpeedMarketsAMM")).createNewMarket(
                    ChainedSpeedMarketsAMM.CreateMarketParams(
                        pendingChainedSpeedMarket.user,
                        pendingChainedSpeedMarket.asset,
                        pendingChainedSpeedMarket.timeFrame,
                        price,
                        pendingChainedSpeedMarket.directions,
                        pendingChainedSpeedMarket.collateral,
                        pendingChainedSpeedMarket.buyinAmount,
                        pendingChainedSpeedMarket.referrer
                    )
                )
            returns (address chainedSpeedMarketAddress) {
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
    /// @param _priceUpdateData oracle priceUpdateData for all supported assets
    function createChainedSpeedMarket(
        ChainedSpeedMarketParams calldata _chainedMarketParams,
        bytes[] calldata _priceUpdateData
    ) external payable nonReentrant notPaused isAddressWhitelisted {
        require(_priceUpdateData.length > 0, "Empty price update data");

        IAddressManager.Addresses memory contractsAddresses = addressManager.getAddresses();
        if (oracleSource == ISpeedMarketsAMM.OracleSource.Pyth) {
            _updatePythPrice(contractsAddresses.pyth, _priceUpdateData);
        }

        ISpeedMarketsAMM iSpeedMarketsAMM = ISpeedMarketsAMM(contractsAddresses.speedMarketsAMM);

        (int64 price, uint64 publishTime) = _getPriceAndPublishTime(
            contractsAddresses,
            _chainedMarketParams.asset,
            _priceUpdateData
        );

        require((publishTime + iSpeedMarketsAMM.maximumPriceDelay()) > block.timestamp && price > 0, "Stale price");

        int64 maxPrice = int64(
            uint64((_chainedMarketParams.strikePrice * (ONE + _chainedMarketParams.strikePriceSlippage)) / ONE)
        );
        int64 minPrice = int64(
            uint64((_chainedMarketParams.strikePrice * (ONE - _chainedMarketParams.strikePriceSlippage)) / ONE)
        );
        require(price <= maxPrice && price >= minPrice, "price exceeds slippage");

        IChainedSpeedMarketsAMM(addressManager.getAddress("ChainedSpeedMarketsAMM")).createNewMarket(
            ChainedSpeedMarketsAMM.CreateMarketParams(
                msg.sender,
                _chainedMarketParams.asset,
                _chainedMarketParams.timeFrame,
                price,
                _chainedMarketParams.directions,
                _chainedMarketParams.collateral,
                _chainedMarketParams.buyinAmount,
                _chainedMarketParams.referrer
            )
        );
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
        bytes[] memory _unverifiedReports
    ) internal returns (int64 price, uint64 publishTime) {
        if (oracleSource == ISpeedMarketsAMM.OracleSource.Chainlink) {
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

    /// @notice Sets the oracle source (Pyth or Chainlink) that will be used for fetching prices.
    /// @param _source The oracle source to use (default Pyth): 0 for Pyth Network or 1 for Chainlink Feeds
    function setOracleSource(ISpeedMarketsAMM.OracleSource _source) external onlyOwner {
        oracleSource = _source;
        emit OracleSourceSet(_source);
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
    event OracleSourceSet(ISpeedMarketsAMM.OracleSource _source);

    event LogError(string _errorMessage, PendingSpeedMarket _pendingSpeedMarket);
    event LogErrorData(bytes _data, PendingSpeedMarket _pendingSpeedMarket);

    event LogChainedError(string _errorMessage, PendingChainedSpeedMarket _pendingChainedSpeedMarket);
    event LogChainedErrorData(bytes _data, PendingChainedSpeedMarket _pendingChainedSpeedMarket);
}

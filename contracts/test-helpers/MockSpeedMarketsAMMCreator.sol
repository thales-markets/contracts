// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFreeBetsHolder {
    function confirmSpeedOrChainedSpeedMarketTrade(
        bytes32 _requestId,
        address _speedMarketAddress,
        address _collateral,
        uint _buyinAmount,
        bool _isChained
    ) external;
}

/// @title Mock speed/chained markets creator for testing freeBetsHolder interactions
contract MockSpeedMarketsAMMCreator {
    uint private constant ONE = 1e18;

    enum Direction {
        Up,
        Down
    }

    struct SpeedMarketParams {
        bytes32 asset;
        uint64 strikeTime;
        uint64 delta;
        uint strikePrice;
        uint strikePriceSlippage;
        Direction direction;
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
        Direction direction;
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
        Direction[] directions;
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
        Direction[] directions;
        address collateral;
        uint buyinAmount;
        address referrer;
        uint256 createdAt;
    }

    uint64 public maxCreationDelay;
    uint256 private requestCounter;

    PendingSpeedMarket[] public pendingSpeedMarkets;
    PendingChainedSpeedMarket[] public pendingChainedSpeedMarkets;

    address public freeBetsHolder;

    mapping(address => bool) public whitelistedAddresses;
    mapping(bytes32 => address) public requestToSender;

    address public owner;

    constructor(address _owner, address _freeBetsHolder) {
        owner = _owner;
        freeBetsHolder = _freeBetsHolder;
        maxCreationDelay = 300; // default 5 minutes
    }

    /// @notice add new speed market to pending - returns dummy requestId
    /// @param _params parameters for adding pending speed market
    function addPendingSpeedMarket(SpeedMarketParams calldata _params) external returns (bytes32 requestId) {
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

        emit AddSpeedMarket(pendingSpeedMarket);

        // Generate dummy requestId
        requestCounter++;
        requestId = keccak256(abi.encodePacked("MOCK_REQUEST_", requestCounter, block.timestamp));
        requestToSender[requestId] = msg.sender;
    }

    /// @notice create all speed markets from pending and call freeBetsHolder
    /// @param _priceUpdateData pyth priceUpdateData (not used in mock)
    function createFromPendingSpeedMarkets(bytes[] calldata _priceUpdateData) external payable isAddressWhitelisted {
        if (pendingSpeedMarkets.length == 0) {
            return;
        }

        uint8 createdSize;
        address mockSpeedMarketAddress = address(
            uint160(uint256(keccak256(abi.encodePacked("MOCK_SPEED_MARKET", block.timestamp))))
        );

        // process all pending speed markets
        for (uint8 i = 0; i < pendingSpeedMarkets.length; i++) {
            PendingSpeedMarket memory pendingSpeedMarket = pendingSpeedMarkets[i];

            if ((pendingSpeedMarket.createdAt + maxCreationDelay) <= block.timestamp) {
                // too late for processing
                continue;
            }

            // Mock successful creation
            if (pendingSpeedMarket.user == freeBetsHolder) {
                bytes32 requestId = keccak256(abi.encode(pendingSpeedMarket));

                // Call freeBetsHolder to confirm the trade
                IFreeBetsHolder(freeBetsHolder).confirmSpeedOrChainedSpeedMarketTrade(
                    requestId,
                    mockSpeedMarketAddress,
                    pendingSpeedMarket.collateral,
                    pendingSpeedMarket.buyinAmount,
                    false
                );
            }
            createdSize++;
        }

        uint pendingSize = pendingSpeedMarkets.length;
        delete pendingSpeedMarkets;

        emit CreateSpeedMarkets(pendingSize, createdSize);
    }

    /// @notice create speed market (mock implementation)
    /// @param _speedMarketParams parameters for creating speed market
    /// @param _priceUpdateData pyth priceUpdateData (not used in mock)
    function createSpeedMarket(SpeedMarketParams calldata _speedMarketParams, bytes[] calldata _priceUpdateData)
        external
        payable
        isAddressWhitelisted
    {
        // Mock implementation - just emit event
        emit MockSpeedMarketCreated(msg.sender, _speedMarketParams.asset, _speedMarketParams.buyinAmount);
    }

    //////////////////chained/////////////////

    /// @notice add new chained speed market to pending - returns dummy requestId
    /// @param _params parameters for adding pending chained speed market
    function addPendingChainedSpeedMarket(ChainedSpeedMarketParams calldata _params) external returns (bytes32 requestId) {
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

        emit AddChainedSpeedMarket(pendingChainedSpeedMarket);

        // Generate dummy requestId
        requestCounter++;
        requestId = keccak256(abi.encodePacked("MOCK_CHAINED_REQUEST_", requestCounter, block.timestamp));
        requestToSender[requestId] = msg.sender;
    }

    /// @notice create all chained speed markets from pending and call freeBetsHolder
    /// @param _priceUpdateData pyth priceUpdateData (not used in mock)
    function createFromPendingChainedSpeedMarkets(bytes[] calldata _priceUpdateData) external payable isAddressWhitelisted {
        if (pendingChainedSpeedMarkets.length == 0) {
            return;
        }

        uint8 createdSize;
        address mockChainedSpeedMarketAddress = address(
            uint160(uint256(keccak256(abi.encodePacked("MOCK_CHAINED_SPEED_MARKET", block.timestamp))))
        );

        // process all pending chained speed markets
        for (uint8 i = 0; i < pendingChainedSpeedMarkets.length; i++) {
            PendingChainedSpeedMarket memory pendingChainedSpeedMarket = pendingChainedSpeedMarkets[i];

            if ((pendingChainedSpeedMarket.createdAt + maxCreationDelay) <= block.timestamp) {
                // too late for processing
                continue;
            }

            // Mock successful creation
            if (pendingChainedSpeedMarket.user == freeBetsHolder) {
                bytes32 requestId = keccak256(abi.encode(pendingChainedSpeedMarket));

                // Call freeBetsHolder to confirm the trade
                IFreeBetsHolder(freeBetsHolder).confirmSpeedOrChainedSpeedMarketTrade(
                    requestId,
                    mockChainedSpeedMarketAddress,
                    pendingChainedSpeedMarket.collateral,
                    pendingChainedSpeedMarket.buyinAmount,
                    true
                );
            }
            createdSize++;
        }

        uint pendingSize = pendingChainedSpeedMarkets.length;
        delete pendingChainedSpeedMarkets;

        emit CreateSpeedMarkets(pendingSize, createdSize);
    }

    /// @notice create chained speed market (mock implementation)
    /// @param _chainedMarketParams parameters for creating chained speed market
    /// @param _priceUpdateData pyth priceUpdateData (not used in mock)
    function createChainedSpeedMarket(
        ChainedSpeedMarketParams calldata _chainedMarketParams,
        bytes[] calldata _priceUpdateData
    ) external payable isAddressWhitelisted {
        // Mock implementation - just emit event
        emit MockChainedSpeedMarketCreated(msg.sender, _chainedMarketParams.asset, _chainedMarketParams.buyinAmount);
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

    /// @notice Set free bets holder address
    /// @param _freeBetsHolder address of the free bets holder contract
    function setFreeBetsHolder(address _freeBetsHolder) external onlyOwner {
        require(_freeBetsHolder != address(0), "Invalid address");
        freeBetsHolder = _freeBetsHolder;
        emit SetFreeBetsHolder(_freeBetsHolder);
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

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier isAddressWhitelisted() {
        require(whitelistedAddresses[msg.sender], "Creator not whitelisted");
        _;
    }

    //////////////////events/////////////////

    event AddSpeedMarket(PendingSpeedMarket _pendingSpeedMarket);
    event AddChainedSpeedMarket(PendingChainedSpeedMarket _pendingChainedSpeedMarket);
    event CreateSpeedMarkets(uint _pendingSize, uint8 _createdSize);

    event SetFreeBetsHolder(address _freeBetsHolder);
    event SetMaxCreationDelay(uint64 _maxCreationDelay);
    event AddedIntoWhitelist(address _whitelistAddress, bool _flag);

    event MockSpeedMarketCreated(address user, bytes32 asset, uint buyinAmount);
    event MockChainedSpeedMarketCreated(address user, bytes32 asset, uint buyinAmount);
}

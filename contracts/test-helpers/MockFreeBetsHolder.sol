// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../utils/libraries/AddressSetLib.sol";
import "../interfaces/IFreeBetsHolder.sol";
import "../SpeedMarkets/SpeedMarketsAMMCreator.sol";
import "../SpeedMarkets/SpeedMarket.sol";

/// @title FreeBetsHolder V2
contract MockFreeBetsHolder is IFreeBetsHolder {
    using AddressSetLib for AddressSetLib.AddressSet;

    struct FreeBet {
        bytes32 requestId;
        address speedMarketAddress;
        address collateral;
        uint buyinAmount;
        bool isChained;
        bool isConfirmed;
        uint256 timestamp;
        bool isResolved;
        bool isWinner;
    }

    struct FreebetAllocation {
        uint256 amount;
        uint256 usedAmount;
        uint256 expiryTime;
        bool isActive;
    }

    struct PendingFreebetRequest {
        address user;
        bytes32 freebetRequestId;
        uint256 amount;
        bool isProcessed;
    }

    // Request ID => FreeBet details
    mapping(bytes32 => FreeBet) public freeBets;

    // User => Freebet Request ID => Freebet allocation
    mapping(address => mapping(bytes32 => FreebetAllocation)) public userFreebets;

    // Market => Request ID
    mapping(address => bytes32) public marketToRequestId;

    // Market => User
    mapping(address => address) public marketToUser;

    // User => array of request IDs
    mapping(address => bytes32[]) public userRequestIds;

    // Pending request ID => Pending freebet request
    mapping(bytes32 => PendingFreebetRequest) public pendingRequests;

    address public speedMarketsAMMCreator;
    address public speedMarketsAMM;
    address public chainedSpeedMarketsAMM;

    bytes32[] public allRequestIds;

    // stores active speed markets per user
    mapping(address => AddressSetLib.AddressSet) internal activeSpeedMarketsPerUser;

    // stores resolved speed markets per user
    mapping(address => AddressSetLib.AddressSet) internal resolvedSpeedMarketsPerUser;

    // stores active chained speed markets per user
    mapping(address => AddressSetLib.AddressSet) internal activeChainedSpeedMarketsPerUser;

    // stores resolved chained speed markets per user
    mapping(address => AddressSetLib.AddressSet) internal resolvedChainedSpeedMarketsPerUser;

    constructor(address _speedMarketsAMMCreator) {
        speedMarketsAMMCreator = _speedMarketsAMMCreator;
    }

    /// @notice Allocate freebets to a user with a specific request ID
    /// @param _user The user address
    /// @param _amount The amount to allocate
    /// @param _requestId The unique request ID for this allocation
    function allocateFreebets(
        address _user,
        uint256 _amount,
        bytes32 _requestId
    ) external {
        require(_user != address(0), "Invalid user");
        require(_amount > 0, "Invalid amount");
        require(_requestId != bytes32(0), "Invalid request ID");

        FreebetAllocation storage allocation = userFreebets[_user][_requestId];
        require(!allocation.isActive || allocation.expiryTime < block.timestamp, "Allocation already active");

        allocation.amount = _amount;
        allocation.usedAmount = 0;
        allocation.expiryTime = block.timestamp + 30 days; // Default 30 day expiry
        allocation.isActive = true;

        // Track request IDs for user
        bool found = false;
        for (uint i = 0; i < userRequestIds[_user].length; i++) {
            if (userRequestIds[_user][i] == _requestId) {
                found = true;
                break;
            }
        }
        if (!found) {
            userRequestIds[_user].push(_requestId);
        }

        emit FreebetAllocated(_user, _requestId, _amount, allocation.expiryTime);
    }

    /// @notice Get freebet balance for a user and request ID
    /// @param _user The user address
    /// @param _requestId The request ID
    /// @return The available freebet balance
    function getFreebetBalance(address _user, bytes32 _requestId) external view returns (uint256) {
        FreebetAllocation memory allocation = userFreebets[_user][_requestId];
        if (!allocation.isActive || allocation.expiryTime < block.timestamp) {
            return 0;
        }
        return allocation.amount - allocation.usedAmount;
    }

    /// @notice Create a speed market using freebets
    /// @param _speedMarketsAMMCreator The creator address
    /// @param _params The market creation parameters
    /// @param _freebetRequestId The freebet request ID to use
    function createSpeedMarketWithFreebets(
        address _speedMarketsAMMCreator,
        SpeedMarketsAMMCreator.SpeedMarketParams memory _params,
        bytes32 _freebetRequestId
    ) external returns (bytes32 creatorRequestId) {
        FreebetAllocation storage allocation = userFreebets[msg.sender][_freebetRequestId];

        require(allocation.isActive, "No active freebet allocation");
        require(allocation.expiryTime >= block.timestamp, "Freebet expired");
        require(allocation.amount - allocation.usedAmount >= _params.buyinAmount, "Insufficient freebet balance");

        allocation.usedAmount += _params.buyinAmount;

        (address chainedAMM, address speedAMM) = SpeedMarketsAMMCreator(_speedMarketsAMMCreator)
            .getChainedAndSpeedMarketsAMMAddresses();

        IERC20Upgradeable(_params.collateral).approve(speedAMM, _params.buyinAmount);

        creatorRequestId = SpeedMarketsAMMCreator(_speedMarketsAMMCreator).addPendingSpeedMarket(_params);

        pendingRequests[creatorRequestId] = PendingFreebetRequest({
            user: msg.sender,
            freebetRequestId: _freebetRequestId,
            amount: _params.buyinAmount,
            isProcessed: false
        });

        emit FreebetUsed(msg.sender, _freebetRequestId, _params.buyinAmount);
        emit PendingFreebetMarketCreated(creatorRequestId, _freebetRequestId, msg.sender);

        return creatorRequestId;
    }

    /// @notice Create a chained speed market using freebets
    /// @param _speedMarketsAMMCreator The creator address
    /// @param _params The market creation parameters
    /// @param _freebetRequestId The freebet request ID to use
    function createChainedSpeedMarketWithFreebets(
        address _speedMarketsAMMCreator,
        SpeedMarketsAMMCreator.ChainedSpeedMarketParams memory _params,
        bytes32 _freebetRequestId
    ) external returns (bytes32 creatorRequestId) {
        FreebetAllocation storage allocation = userFreebets[msg.sender][_freebetRequestId];

        require(allocation.isActive, "No active freebet allocation");
        require(allocation.expiryTime >= block.timestamp, "Freebet expired");
        require(allocation.amount - allocation.usedAmount >= _params.buyinAmount, "Insufficient freebet balance");

        allocation.usedAmount += _params.buyinAmount;

        (address chainedAMM, address speedAMM) = SpeedMarketsAMMCreator(_speedMarketsAMMCreator)
            .getChainedAndSpeedMarketsAMMAddresses();

        IERC20Upgradeable(_params.collateral).approve(chainedAMM, _params.buyinAmount);

        creatorRequestId = SpeedMarketsAMMCreator(_speedMarketsAMMCreator).addPendingChainedSpeedMarket(_params);

        pendingRequests[creatorRequestId] = PendingFreebetRequest({
            user: msg.sender,
            freebetRequestId: _freebetRequestId,
            amount: _params.buyinAmount,
            isProcessed: false
        });

        emit FreebetUsed(msg.sender, _freebetRequestId, _params.buyinAmount);
        emit PendingFreebetMarketCreated(creatorRequestId, _freebetRequestId, msg.sender);

        return creatorRequestId;
    }

    /// @notice Confirm a speed or chained speed market trade
    function confirmSpeedOrChainedSpeedMarketTrade(
        bytes32 _requestId,
        address _speedMarketAddress,
        address _collateral,
        uint _buyinAmount,
        bool _isChained
    ) external override {
        require(msg.sender == speedMarketsAMMCreator, "Only speedMarketsAMMCreator");
        require(_speedMarketAddress != address(0), "Invalid market address");
        require(_buyinAmount > 0, "Invalid buyin amount");

        PendingFreebetRequest storage pendingRequest = pendingRequests[_requestId];
        if (pendingRequest.user != address(0) && !pendingRequest.isProcessed) {
            pendingRequest.isProcessed = true;

            freeBets[_requestId] = FreeBet({
                requestId: _requestId,
                speedMarketAddress: _speedMarketAddress,
                collateral: _collateral,
                buyinAmount: _buyinAmount,
                isChained: _isChained,
                isConfirmed: true,
                timestamp: block.timestamp,
                isResolved: false,
                isWinner: false
            });

            allRequestIds.push(_requestId);

            marketToRequestId[_speedMarketAddress] = pendingRequest.freebetRequestId;
            marketToUser[_speedMarketAddress] = pendingRequest.user;

            if (_isChained) {
                activeChainedSpeedMarketsPerUser[pendingRequest.user].add(_speedMarketAddress);
            } else {
                activeSpeedMarketsPerUser[pendingRequest.user].add(_speedMarketAddress);
            }
        }

        emit SpeedMarketTradeConfirmed(_requestId, _speedMarketAddress, _collateral, _buyinAmount, _isChained);
    }

    /// @notice Confirm that a speed market has been resolved
    function confirmSpeedMarketResolved(
        address _resolvedTicket,
        uint _exercized,
        uint _buyInAmount,
        address _collateral,
        bool _isChained
    ) external override {
        require(msg.sender == speedMarketsAMM || msg.sender == chainedSpeedMarketsAMM, "Caller not allowed");

        bytes32 freebetRequestId = marketToRequestId[_resolvedTicket];
        require(freebetRequestId != bytes32(0), "Unknown market");

        bytes32 creatorRequestId;
        bool found = false;
        for (uint i = 0; i < allRequestIds.length; i++) {
            if (freeBets[allRequestIds[i]].speedMarketAddress == _resolvedTicket) {
                creatorRequestId = allRequestIds[i];
                found = true;
                break;
            }
        }
        require(found, "Market not found in freebets");

        FreeBet storage freeBet = freeBets[creatorRequestId];
        require(freeBet.isConfirmed, "Market not confirmed");
        require(!freeBet.isResolved, "Market already resolved");

        address user = marketToUser[_resolvedTicket];
        require(user != address(0), "Unknown user for market");

        freeBet.isResolved = true;
        freeBet.isWinner = _exercized > 0;

        uint256 payout = _exercized;

        if (payout > 0) {
            IERC20Upgradeable(_collateral).transfer(user, payout);
        }

        emit FreeBetMarketResolved(_resolvedTicket, user, _exercized > 0, payout);
    }

    /// @notice Set the AMM addresses
    function setAMMAddresses(address _speedMarketsAMM, address _chainedSpeedMarketsAMM) external {
        speedMarketsAMM = _speedMarketsAMM;
        chainedSpeedMarketsAMM = _chainedSpeedMarketsAMM;
    }

    /// @notice Set the speed markets AMM creator address
    function setSpeedMarketsAMMCreator(address _speedMarketsAMMCreator) external {
        require(_speedMarketsAMMCreator != address(0), "Invalid address");
        speedMarketsAMMCreator = _speedMarketsAMMCreator;
    }

    /// @notice Get all request IDs for a user
    function getUserRequestIds(address _user) external view returns (bytes32[] memory) {
        return userRequestIds[_user];
    }

    /// @notice Check if a freebet allocation is expired
    function isFreebetExpired(address _user, bytes32 _requestId) external view returns (bool) {
        FreebetAllocation memory allocation = userFreebets[_user][_requestId];
        return !allocation.isActive || allocation.expiryTime < block.timestamp;
    }

    /// @notice Set expiry time for testing
    function setFreebetExpiry(
        address _user,
        bytes32 _requestId,
        uint256 _expiryTime
    ) external {
        userFreebets[_user][_requestId].expiryTime = _expiryTime;
    }

    /// @notice Fund the contract with collateral for testing
    function fundContract(address _token, uint256 _amount) external {
        IERC20Upgradeable(_token).transferFrom(msg.sender, address(this), _amount);
    }

    /// @notice Set market to user mapping for testing
    function setMarketUser(address _market, address _user) external {
        marketToUser[_market] = _user;
    }

    /// @notice gets number of active speed markets per user
    /// @param _user to get number of active speed markets for
    /// @return numOfActiveSpeedMarkets
    function numOfActiveSpeedMarketsPerUser(address _user) external view override returns (uint) {
        return activeSpeedMarketsPerUser[_user].elements.length;
    }

    /// @notice gets number of active chained speed markets per user
    /// @param _user to get number of active chained speed markets for
    /// @return numOfActiveChainedSpeedMarkets
    function numOfActiveChainedSpeedMarketsPerUser(address _user) external view override returns (uint) {
        return activeChainedSpeedMarketsPerUser[_user].elements.length;
    }

    /// @notice gets number of resolved speed markets per user
    /// @param _user to get number of resolved speed markets for
    /// @return numOfResolvedSpeedMarkets
    function numOfResolvedSpeedMarketsPerUser(address _user) external view override returns (uint) {
        return resolvedSpeedMarketsPerUser[_user].elements.length;
    }

    /// @notice gets number of resolved chained speed markets per user
    /// @param _user to get number of resolved chained speed markets for
    /// @return numOfResolvedSpeedMarkets
    function numOfResolvedChainedSpeedMarketsPerUser(address _user) external view override returns (uint) {
        return resolvedChainedSpeedMarketsPerUser[_user].elements.length;
    }

    event FreebetAllocated(address indexed user, bytes32 indexed requestId, uint256 amount, uint256 expiryTime);
    event FreebetUsed(address indexed user, bytes32 indexed requestId, uint256 amount);
    event SpeedMarketTradeConfirmed(
        bytes32 indexed requestId,
        address indexed speedMarketAddress,
        address collateral,
        uint buyinAmount,
        bool isChained
    );
    event FreeBetMarketResolved(address indexed market, address indexed user, bool isWinner, uint256 payout);
    event PendingFreebetMarketCreated(
        bytes32 indexed creatorRequestId,
        bytes32 indexed freebetRequestId,
        address indexed user
    );
}

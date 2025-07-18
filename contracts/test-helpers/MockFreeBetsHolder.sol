// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

/// @title Mock FreeBetsHolder for testing speed markets integration
contract MockFreeBetsHolder {
    struct FreeBet {
        bytes32 requestId;
        address speedMarketAddress;
        address collateral;
        uint buyinAmount;
        bool isChained;
        bool isConfirmed;
        uint256 timestamp;
    }

    mapping(bytes32 => FreeBet) public freeBets;
    mapping(address => uint256) public userFreeBetBalance;
    mapping(address => bytes32) public marketToRequestId;
    mapping(address => address) public marketToUser;

    address public speedMarketsAMMCreator;
    address public speedMarketsAMM;
    address public chainedSpeedMarketsAMM;

    bytes32[] public allRequestIds;

    event FreeBetCreated(bytes32 indexed requestId, address indexed user, uint256 amount);
    event SpeedMarketTradeConfirmed(
        bytes32 indexed requestId,
        address indexed speedMarketAddress,
        address collateral,
        uint buyinAmount,
        bool isChained
    );
    event FreeBetMarketResolved(address indexed market, address indexed user, uint256 earned);

    constructor(address _speedMarketsAMMCreator) {
        speedMarketsAMMCreator = _speedMarketsAMMCreator;
    }

    /// @notice Confirm a speed or chained speed market trade
    /// @param _requestId The request ID from the speed markets creator
    /// @param _speedMarketAddress The address of the created speed market
    /// @param _collateral The collateral token address
    /// @param _buyinAmount The buyin amount
    /// @param _isChained Whether this is a chained speed market
    function confirmSpeedOrChainedSpeedMarketTrade(
        bytes32 _requestId,
        address _speedMarketAddress,
        address _collateral,
        uint _buyinAmount,
        bool _isChained
    ) external {
        require(msg.sender == speedMarketsAMMCreator, "Only speedMarketsAMMCreator");
        require(_speedMarketAddress != address(0), "Invalid market address");
        require(_buyinAmount > 0, "Invalid buyin amount");

        freeBets[_requestId] = FreeBet({
            requestId: _requestId,
            speedMarketAddress: _speedMarketAddress,
            collateral: _collateral,
            buyinAmount: _buyinAmount,
            isChained: _isChained,
            isConfirmed: true,
            timestamp: block.timestamp
        });

        allRequestIds.push(_requestId);

        // Store mapping from market to request ID and user for resolution
        marketToRequestId[_speedMarketAddress] = _requestId;
        // In a real implementation, we would get the user from the request
        // For mock purposes, we'll set it when the market is created

        emit SpeedMarketTradeConfirmed(_requestId, _speedMarketAddress, _collateral, _buyinAmount, _isChained);
    }

    /// @notice Mock function to allocate free bet balance to a user
    /// @param _user The user address
    /// @param _amount The amount to allocate
    function allocateFreeBet(address _user, uint256 _amount) external {
        userFreeBetBalance[_user] += _amount;
        emit FreeBetCreated(keccak256(abi.encodePacked(_user, _amount, block.timestamp)), _user, _amount);
    }

    /// @notice Get free bet details by request ID
    /// @param _requestId The request ID to query
    /// @return The FreeBet struct
    function getFreeBet(bytes32 _requestId) external view returns (FreeBet memory) {
        return freeBets[_requestId];
    }

    /// @notice Get total number of confirmed free bets
    /// @return The total count
    function getTotalFreeBets() external view returns (uint256) {
        return allRequestIds.length;
    }

    /// @notice Get all request IDs
    /// @return Array of all request IDs
    function getAllRequestIds() external view returns (bytes32[] memory) {
        return allRequestIds;
    }

    /// @notice Check if a request ID has been confirmed
    /// @param _requestId The request ID to check
    /// @return Whether the request has been confirmed
    function isRequestConfirmed(bytes32 _requestId) external view returns (bool) {
        return freeBets[_requestId].isConfirmed;
    }

    /// @notice Update the speed markets AMM creator address
    /// @param _speedMarketsAMMCreator The new address
    function setSpeedMarketsAMMCreator(address _speedMarketsAMMCreator) external {
        require(_speedMarketsAMMCreator != address(0), "Invalid address");
        speedMarketsAMMCreator = _speedMarketsAMMCreator;
    }

    /// @notice Set the AMM addresses that can call confirmMarketResolved
    /// @param _speedMarketsAMM The SpeedMarketsAMM address
    /// @param _chainedSpeedMarketsAMM The ChainedSpeedMarketsAMM address
    function setAMMAddresses(address _speedMarketsAMM, address _chainedSpeedMarketsAMM) external {
        require(_speedMarketsAMM != address(0), "Invalid speedMarketsAMM address");
        require(_chainedSpeedMarketsAMM != address(0), "Invalid chainedSpeedMarketsAMM address");
        speedMarketsAMM = _speedMarketsAMM;
        chainedSpeedMarketsAMM = _chainedSpeedMarketsAMM;
    }

    /// @notice Set the user for a market (mock helper function)
    /// @param _market The market address
    /// @param _user The user address
    function setMarketUser(address _market, address _user) external {
        marketToUser[_market] = _user;
    }

    /// @notice Confirm that a speed market has been resolved
    /// @param _resolvedMarket The address of the resolved market
    function confirmMarketResolved(address _resolvedMarket) external {
        require(msg.sender == speedMarketsAMM || msg.sender == chainedSpeedMarketsAMM, "Caller not allowed");

        bytes32 requestId = marketToRequestId[_resolvedMarket];
        require(requestId != bytes32(0), "Unknown market");

        FreeBet memory freeBet = freeBets[requestId];
        require(freeBet.isConfirmed, "Market not confirmed");
        require(freeBet.speedMarketAddress == _resolvedMarket, "Market mismatch");

        address user = marketToUser[_resolvedMarket];
        require(user != address(0), "Unknown user for market");

        // Mock resolution logic - in real implementation this would check if user won
        // For testing, we'll just return the buyin amount as earned
        uint256 earned = freeBet.buyinAmount;

        // Transfer the earned amount to the user
        IERC20Upgradeable(freeBet.collateral).transfer(user, earned);

        emit FreeBetMarketResolved(_resolvedMarket, user, earned);
    }
}

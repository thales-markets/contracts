// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@openzeppelin/contracts-4.4.1/security/Pausable.sol";
import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";

// internal
import "../interfaces/ITherundownConsumer.sol";

contract TherundownConsumerWrapper is ChainlinkClient, Ownable, Pausable {
    using Chainlink for Chainlink.Request;

    ITherundownConsumer public consumer;
    mapping(bytes32 => uint) public sportIdPerRequestId;
    mapping(address => bool) public whitelistedAddresses;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _link,
        address _oracle,
        address _consumer
    ) public {
        setChainlinkToken(_link);
        setChainlinkOracle(_oracle);
        consumer = ITherundownConsumer(_consumer);
    }

    /* ========== CONSUMER REQUEST FUNCTIONS ========== */

    function requestGamesResolveWithFilters(
        bytes32 _specId,
        uint256 _payment,
        string memory _market,
        uint256 _sportId,
        uint256 _date,
        string[] memory _statusIds,
        string[] memory _gameIds
    ) public whenNotPaused isValidRequest(_market, _sportId) isAddressWhitelisted {
        Chainlink.Request memory req;

        if (keccak256(abi.encodePacked(_market)) == keccak256(abi.encodePacked("create"))) {
            req = buildChainlinkRequest(_specId, address(this), this.fulfillGamesCreated.selector);
        } else {
            req = buildChainlinkRequest(_specId, address(this), this.fulfillGamesResolved.selector);
        }

        req.addUint("date", _date);
        req.add("market", _market);
        req.addUint("sportId", _sportId);
        req.addStringArray("statusIds", _statusIds);
        req.addStringArray("gameIds", _gameIds);

        bytes32 requestId = sendChainlinkRequest(req, _payment);
        sportIdPerRequestId[requestId] = _sportId;
    }

    function requestGames(
        bytes32 _specId,
        uint256 _payment,
        string memory _market,
        uint256 _sportId,
        uint256 _date
    ) public whenNotPaused isValidRequest(_market, _sportId) isAddressWhitelisted {
        Chainlink.Request memory req;

        if (keccak256(abi.encodePacked(_market)) == keccak256(abi.encodePacked("create"))) {
            req = buildChainlinkRequest(_specId, address(this), this.fulfillGamesCreated.selector);
        } else {
            req = buildChainlinkRequest(_specId, address(this), this.fulfillGamesResolved.selector);
        }

        req.addUint("date", _date);
        req.add("market", _market);
        req.addUint("sportId", _sportId);

        bytes32 requestId = sendChainlinkRequest(req, _payment);
        sportIdPerRequestId[requestId] = _sportId;
    }

    /* ========== CONSUMER FULFILL FUNCTIONS ========== */

    function fulfillGamesCreated(bytes32 _requestId, bytes[] memory _games) public recordChainlinkFulfillment(_requestId) {
        consumer.fulfillGamesCreated(_requestId, _games, sportIdPerRequestId[_requestId]);
    }

    function fulfillGamesResolved(bytes32 _requestId, bytes[] memory _games) public recordChainlinkFulfillment(_requestId) {
        consumer.fulfillGamesResolved(_requestId, _games, sportIdPerRequestId[_requestId]);
    }

    /* ========== VIEWS ========== */

    function getOracleAddress() public view returns (address) {
        return chainlinkOracleAddress();
    }

    function getTokenAddress() public view returns (address) {
        return chainlinkTokenAddress();
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    function addToWhitelist(address _whitelistAddress) external onlyOwner {
        require(_whitelistAddress != address(0), "Invalid address");
        whitelistedAddresses[_whitelistAddress] = true;
        emit AddedIntoWhitelist(_whitelistAddress);
    }

    function setOracle(address _oracle) external onlyOwner {
        setChainlinkOracle(_oracle);
        emit NewOracleAddress(_oracle);
    }

    function setConsumer(address _consumer) external onlyOwner {
        consumer = ITherundownConsumer(_consumer);
        emit NewConsumer(_consumer);
    }

    function withdrawLink() external onlyOwner {
        LinkTokenInterface linkToken = LinkTokenInterface(chainlinkTokenAddress());
        require(linkToken.transfer(msg.sender, linkToken.balanceOf(address(this))), "Unable to transfer");
    }

    /* ========== MODIFIERS ========== */

    modifier isValidRequest(string memory _market, uint256 _sportId) {
        require(consumer.isSupportedMarketType(_market), "Market is not supported");
        require(consumer.isSupportedSport(_sportId), "SportId is not supported");
        _;
    }

    modifier isAddressWhitelisted() {
        require(whitelistedAddresses[msg.sender], "Address not supported");
        _;
    }

    /* ========== EVENTS ========== */

    event NewOracleAddress(address _oracle);
    event NewConsumer(address _consumer);
    event AddedIntoWhitelist(address _whitelistAddress);
}

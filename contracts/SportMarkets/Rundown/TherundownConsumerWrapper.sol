// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// external
import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@openzeppelin/contracts-4.4.1/security/Pausable.sol";
import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";

// internal
import "../../interfaces/ITherundownConsumer.sol";

/// @title Wrapper contract which calls CL sports data (Link to docs: https://market.link/nodes/TheRundown/integrations)
/// @author gruja
contract TherundownConsumerWrapper is ChainlinkClient, Ownable, Pausable {
    using Chainlink for Chainlink.Request;

    ITherundownConsumer public consumer;
    mapping(bytes32 => uint) public sportIdPerRequestId;
    mapping(bytes32 => uint) public datePerRequest;
    mapping(address => bool) public whitelistedAddresses;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _link,
        address _oracle,
        address _consumer
    ) {
        setChainlinkToken(_link);
        setChainlinkOracle(_oracle);
        consumer = ITherundownConsumer(_consumer);
    }

    /* ========== CONSUMER REQUEST FUNCTIONS ========== */

    /// @notice request of create/resolve games on a specific date with specific sport with optional filters
    /// @param _specId specification id which is provided by CL
    /// @param _payment peyment amount per request which is provided from CL
    /// @param _market string which can be "create" or "resolve"
    /// @param _sportId sports id which is provided from CL (Example: NBA = 4)
    /// @param _date date on which game/games are played
    /// @param _statusIds optional param, grap only for specific statusess
    /// @param _gameIds optional param, grap only for specific games
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
        datePerRequest[requestId] = _date;
    }

    /// @notice request of create/resolve games on a specific date with specific sport without filters
    /// @param _specId specification id which is provided by CL
    /// @param _payment peyment amount per request which is provided from CL
    /// @param _market string which can be "create" or "resolve"
    /// @param _sportId sports id which is provided from CL (Example: NBA = 4)
    /// @param _date date on which game/games are played
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
        datePerRequest[requestId] = _date;
    }


    /// @notice request for odds in games on a specific date with specific sport with filters
    /// @param _specId specification id which is provided by CL
    /// @param _payment peyment amount per request which is provided from CL
    /// @param _sportId sports id which is provided from CL (Example: NBA = 4)
    /// @param _date date on which game/games are played
    /// @param _gameIds optional param, grap only for specific games
    function requestOddsWithFilters(
        bytes32 _specId,
        uint256 _payment,
        uint256 _sportId,
        uint256 _date,
        string[] memory _gameIds
    ) public whenNotPaused isAddressWhitelisted {
        require(consumer.isSupportedSport(_sportId), "SportId is not supported");

        Chainlink.Request memory req = buildChainlinkRequest(_specId, address(this), this.fulfillGamesOdds.selector);

        req.addUint("date", _date);
        req.addUint("sportId", _sportId);

        // optional param.
        if(_gameIds.length > 0){
            req.addStringArray("gameIds", _gameIds);
        }

        bytes32 requestId = sendChainlinkRequest(req, _payment);
        sportIdPerRequestId[requestId] = _sportId;
        datePerRequest[requestId] = _date;
    }

    /* ========== CONSUMER FULFILL FUNCTIONS ========== */

    /// @notice proxy all retrieved data for created games from CL to consumer
    /// @param _requestId request id autogenerated from CL
    /// @param _games array of a games
    function fulfillGamesCreated(bytes32 _requestId, bytes[] memory _games) external recordChainlinkFulfillment(_requestId) {
        consumer.fulfillGamesCreated(_requestId, _games, sportIdPerRequestId[_requestId], datePerRequest[_requestId]);
    }

    /// @notice proxy all retrieved data for resolved games from CL to consumer
    /// @param _requestId request id autogenerated from CL
    /// @param _games array of a games
    function fulfillGamesResolved(bytes32 _requestId, bytes[] memory _games) external recordChainlinkFulfillment(_requestId) {
        consumer.fulfillGamesResolved(_requestId, _games, sportIdPerRequestId[_requestId]);
    }
    
    /// @notice proxy all retrieved data for odds in games from CL to consumer
    /// @param _requestId request id autogenerated from CL
    /// @param _games array of a games
    function fulfillGamesOdds(bytes32 _requestId, bytes[] memory _games) external recordChainlinkFulfillment(_requestId) {
        consumer.fulfillGamesOdds(_requestId, _games, datePerRequest[_requestId]);
    }

    /* ========== VIEWS ========== */

    /// @notice getting oracle address for CL data sport feed
    /// @return address of oracle
    function getOracleAddress() public view returns (address) {
        return chainlinkOracleAddress();
    }

    /// @notice getting LINK token address for payment for requests
    /// @return address of LINK token
    function getTokenAddress() public view returns (address) {
        return chainlinkTokenAddress();
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    /// @notice adding into whitelist address which can call sports data feed
    /// @param _whitelistAddress address that needed to be whitelisted 
    function addToWhitelist(address _whitelistAddress) external onlyOwner {
        require(_whitelistAddress != address(0), "Invalid address");
        whitelistedAddresses[_whitelistAddress] = true;
        emit AddedIntoWhitelist(_whitelistAddress);
    }

    /// @notice setting new oracle address 
    /// @param _oracle address of oracle sports data feed
    function setOracle(address _oracle) external onlyOwner {
        setChainlinkOracle(_oracle);
        emit NewOracleAddress(_oracle);
    }

    /// @notice setting consumer address 
    /// @param _consumer address of a consumer which gets the data from CL requests 
    function setConsumer(address _consumer) external onlyOwner {
        consumer = ITherundownConsumer(_consumer);
        emit NewConsumer(_consumer);
    }

    /// @notice withdraw LINK token which is used for requests
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

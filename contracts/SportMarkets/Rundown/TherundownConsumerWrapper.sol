// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// external
import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@openzeppelin/contracts-4.4.1/security/Pausable.sol";
import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";

// internal
import "../../interfaces/ITherundownConsumer.sol";

/// @title Wrapper contract which calls CL sports data (Link to docs: https://market.link/nodes/TheRundown/integrations)
/// @author gruja
contract TherundownConsumerWrapper is ChainlinkClient, Ownable, Pausable {
    using Chainlink for Chainlink.Request;
    using SafeERC20 for IERC20;

    ITherundownConsumer public consumer;
    mapping(bytes32 => uint) public sportIdPerRequestId;
    mapping(bytes32 => uint) public datePerRequest;
    uint public payment;
    IERC20 public linkToken;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _link,
        address _oracle,
        address _consumer,
        uint _payment
    ) {
        setChainlinkToken(_link);
        setChainlinkOracle(_oracle);
        consumer = ITherundownConsumer(_consumer);
        payment = _payment;
        linkToken = IERC20(_link);
    }

    /* ========== CONSUMER REQUEST FUNCTIONS ========== */

    /// @notice request of create/resolve games on a specific date with specific sport with optional filters
    /// @param _specId specification id which is provided by CL
    /// @param _market string which can be "create" or "resolve"
    /// @param _sportId sports id which is provided from CL (Example: NBA = 4)
    /// @param _date date on which game/games are played
    /// @param _statusIds optional param, grap only for specific statusess
    /// @param _gameIds optional param, grap only for specific games
    function requestGamesResolveWithFilters(
        bytes32 _specId,
        string memory _market,
        uint256 _sportId,
        uint256 _date,
        string[] memory _statusIds,
        string[] memory _gameIds
    ) public whenNotPaused isValidRequest(_market, _sportId) {
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

        _putLink(msg.sender);

        bytes32 requestId = sendChainlinkRequest(req, payment);
        sportIdPerRequestId[requestId] = _sportId;
        datePerRequest[requestId] = _date;
    }

    /// @notice request of create/resolve games on a specific date with specific sport without filters
    /// @param _specId specification id which is provided by CL
    /// @param _market string which can be "create" or "resolve"
    /// @param _sportId sports id which is provided from CL (Example: NBA = 4)
    /// @param _date date on which game/games are played
    function requestGames(
        bytes32 _specId,
        string memory _market,
        uint256 _sportId,
        uint256 _date
    ) public whenNotPaused isValidRequest(_market, _sportId) {
        Chainlink.Request memory req;

        if (keccak256(abi.encodePacked(_market)) == keccak256(abi.encodePacked("create"))) {
            req = buildChainlinkRequest(_specId, address(this), this.fulfillGamesCreated.selector);
        } else {
            req = buildChainlinkRequest(_specId, address(this), this.fulfillGamesResolved.selector);
        }

        req.addUint("date", _date);
        req.add("market", _market);
        req.addUint("sportId", _sportId);

        _putLink(msg.sender);

        bytes32 requestId = sendChainlinkRequest(req, payment);
        sportIdPerRequestId[requestId] = _sportId;
        datePerRequest[requestId] = _date;
    }

    /// @notice request for odds in games on a specific date with specific sport with filters
    /// @param _specId specification id which is provided by CL
    /// @param _sportId sports id which is provided from CL (Example: NBA = 4)
    /// @param _date date on which game/games are played
    /// @param _gameIds optional param, grap only for specific games
    function requestOddsWithFilters(
        bytes32 _specId,
        uint256 _sportId,
        uint256 _date,
        string[] memory _gameIds
    ) public whenNotPaused {
        require(consumer.isSupportedSport(_sportId), "SportId is not supported");

        Chainlink.Request memory req = buildChainlinkRequest(_specId, address(this), this.fulfillGamesOdds.selector);

        req.addUint("date", _date);
        req.addUint("sportId", _sportId);

        // optional param.
        if (_gameIds.length > 0) {
            req.addStringArray("gameIds", _gameIds);
        }

        _putLink(msg.sender);

        bytes32 requestId = sendChainlinkRequest(req, payment);
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
    function fulfillGamesResolved(bytes32 _requestId, bytes[] memory _games)
        external
        recordChainlinkFulfillment(_requestId)
    {
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

    /* ========== INTERNALS ========== */

    /// @notice send link to this contract, check of allownece and balanceOf is checked in safeTransferFrom
    /// @param _sender address which pays LINK
    function _putLink(address _sender) internal {
        linkToken.safeTransferFrom(_sender, address(this), payment);
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    /// @notice setting payment
    /// @param _payment amount of link per request
    function setPayment(uint _payment) external onlyOwner {
        payment = _payment;
        emit NewPaymentAmount(_payment);
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

    /// @notice setting link address
    /// @param _link address of a LINK which request will be paid
    function setLink(address _link) external onlyOwner {
        setChainlinkToken(_link);
        linkToken = IERC20(_link);
        emit NewLinkAddress(_link);
    }

    /* ========== MODIFIERS ========== */

    modifier isValidRequest(string memory _market, uint256 _sportId) {
        require(consumer.isSupportedMarketType(_market), "Market is not supported");
        require(consumer.isSupportedSport(_sportId), "SportId is not supported");
        _;
    }

    /* ========== EVENTS ========== */

    event NewOracleAddress(address _oracle);
    event NewPaymentAmount(uint _payment);
    event NewConsumer(address _consumer);
    event NewLinkAddress(address _link);
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// external
import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@openzeppelin/contracts-4.4.1/security/Pausable.sol";
import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";

// internal
import "../../interfaces/IApexConsumer.sol";

/// @title Wrapper contract which calls CL sports data (Link to docs: https://market.link/nodes/Apex146/integrations)
/// @author vladan
contract ApexConsumerWrapper is ChainlinkClient, Ownable, Pausable {
    using Chainlink for Chainlink.Request;
    using SafeERC20 for IERC20;

    string public constant H2H_BET_TYPE = "outright_head_to_head";
    string public constant H2H_GAME_ID_INFIX = "h2h";

    IApexConsumer public consumer;

    mapping(bytes32 => string) public sportPerRequestId;
    mapping(bytes32 => string) public gameIdPerRequestId;
    mapping(bytes32 => string) public eventIdPerRequestId;
    mapping(bytes32 => string) public qualifyingStatusPerRequestId;
    mapping(bytes32 => string) public betTypePerRequestId;
    mapping(string => string) public sportPerEventId;

    mapping(string => bool) public supportedBetType;
    mapping(string => uint) public betTypeIdPerBetType;

    uint public paymentMetadata;
    uint public paymentMatchup;
    uint public paymentResults;

    string public requestMetadataJobId;
    string public requestMatchupJobId;
    string public requestResultsJobId;

    IERC20 public linkToken;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _link,
        address _oracle,
        address _consumer,
        uint _paymentMetadata,
        uint _paymentMatchup,
        uint _paymentResults,
        string memory _requestMetadataJobId,
        string memory _requestMatchupJobId,
        string memory _requestResultsJobId,
        string[] memory _supportedBetTypes
    ) {
        setChainlinkToken(_link);
        setChainlinkOracle(_oracle);
        consumer = IApexConsumer(_consumer);
        paymentMetadata = _paymentMetadata;
        paymentMatchup = _paymentMatchup;
        paymentResults = _paymentResults;
        requestMetadataJobId = _requestMetadataJobId;
        requestMatchupJobId = _requestMatchupJobId;
        requestResultsJobId = _requestResultsJobId;
        linkToken = IERC20(_link);
        for (uint i; i < _supportedBetTypes.length; i++) {
            supportedBetType[_supportedBetTypes[i]] = true;
            betTypeIdPerBetType[_supportedBetTypes[i]] = i;
        }
    }

    /* ========== CONSUMER REQUEST FUNCTIONS ========== */

    /// @notice Returns the metadata info. Function is requesting metadata for the next race
    /// @param _sport paremeter to distinguish between different sport metadata for event ID
    function requestMetaData(string memory _sport) public whenNotPaused isValidMetaDataRequest(_sport) {
        Chainlink.Request memory req = buildChainlinkRequest(
            _stringToBytes32(requestMetadataJobId),
            address(this),
            this.fulfillMetaData.selector
        );
        req.add("sports", _sport);

        _putLink(msg.sender, paymentMetadata);

        bytes32 requestId = sendChainlinkRequest(req, paymentMetadata);
        sportPerRequestId[requestId] = _sport;
    }

    /// @notice Returns the matchup information
    /// @param _eventId event ID which is provided from CL
    /// @param _betType bet type for specific event ID
    /// @param _gameNumber game number for specific bet type
    /// @param _qualifyingStatus string which can be "pre" or "post" for pre-qualifying or post-qualifying probabilities
    function requestMatchup(
        string memory _eventId,
        string memory _betType,
        string memory _gameNumber,
        string memory _qualifyingStatus
    ) public whenNotPaused isValidBetType(_betType) isValidMatchupRequest(_qualifyingStatus) {
        Chainlink.Request memory req = buildChainlinkRequest(
            _stringToBytes32(requestMatchupJobId),
            address(this),
            this.fulfillMatchup.selector
        );
        req.add("event_id", _eventId);
        req.add("qualifying_status", _qualifyingStatus);
        req.add("bet_type", _createBetType(_betType, _gameNumber));
        req.add("stage_level", "null");

        _putLink(msg.sender, paymentMatchup);

        bytes32 requestId = sendChainlinkRequest(req, paymentMatchup);
        sportPerRequestId[requestId] = sportPerEventId[_eventId];
        eventIdPerRequestId[requestId] = _eventId;
        gameIdPerRequestId[requestId] = _createGameId(_eventId, _betType, _gameNumber);
        qualifyingStatusPerRequestId[requestId] = _qualifyingStatus;
        betTypePerRequestId[requestId] = _betType;
    }

    /// @notice Returns the results information
    /// @param _eventId event ID which is provided from CL
    /// @param _betType bet type for specific event ID
    /// @param _gameNumber game number for specific bet type
    function requestResults(
        string memory _eventId,
        string memory _betType,
        string memory _gameNumber
    ) public whenNotPaused isValidBetType(_betType) {
        Chainlink.Request memory req = buildChainlinkRequest(
            _stringToBytes32(requestResultsJobId),
            address(this),
            this.fulfillResults.selector
        );
        req.add("event_id", _eventId);
        req.add("result_type", "final");
        req.add("bet_type", _createBetType(_betType, _gameNumber));

        _putLink(msg.sender, paymentResults);

        bytes32 requestId = sendChainlinkRequest(req, paymentResults);
        sportPerRequestId[requestId] = sportPerEventId[_eventId];
        gameIdPerRequestId[requestId] = _createGameId(_eventId, _betType, _gameNumber);
    }

    /* ========== CONSUMER FULFILL FUNCTIONS ========== */

    /**
     * @notice Fulfill all race metadata necessary to create sport markets
     * @param _requestId the request ID for fulfillment
     * @param _eventId event ID which is provided from CL
     * @param _betType bet type for provided event ID
     * @param _eventName event name which is provided from CL
     * @param _qualifyingStartTime timestamp on which race qualifying is started
     * @param _raceStartTime timestamp on which race is started
     */
    function fulfillMetaData(
        bytes32 _requestId,
        string memory _eventId,
        string memory _betType,
        string memory _eventName,
        uint256 _qualifyingStartTime,
        uint256 _raceStartTime
    ) external recordChainlinkFulfillment(_requestId) {
        string memory sport = sportPerRequestId[_requestId];
        sportPerEventId[_eventId] = sport;

        consumer.fulfillMetaData(_requestId, _eventId, _betType, _eventName, _qualifyingStartTime, _raceStartTime, sport);
    }

    /**
     * @notice Fulfill all matchup data necessary to create sport markets
     * @param _requestId the request ID for fulfillment
     * @param _betTypeDetail1 Team/Category/Rider A identifier, returned as string
     * @param _betTypeDetail2 Team/Category/Rider B identifier, returned as string
     * @param _probA: Probability for Team/Category/Rider A, returned as uint256
     * @param _probB: Probability for Team/Category/Rider B, returned as uint256
     */
    function fulfillMatchup(
        bytes32 _requestId,
        string memory _betTypeDetail1,
        string memory _betTypeDetail2,
        uint256 _probA,
        uint256 _probB
    ) external recordChainlinkFulfillment(_requestId) {
        bytes32 gameId = _stringToBytes32(gameIdPerRequestId[_requestId]);
        string memory sport = sportPerRequestId[_requestId];
        string memory eventId = eventIdPerRequestId[_requestId];
        bool arePostQualifyingOdds = keccak256(abi.encodePacked(qualifyingStatusPerRequestId[_requestId])) ==
            keccak256(abi.encodePacked("post"));
        uint betTypeId = betTypeIdPerBetType[betTypePerRequestId[_requestId]];
        string memory betTypeDetail2 = keccak256(abi.encodePacked(betTypePerRequestId[_requestId])) ==
            keccak256(abi.encodePacked(H2H_BET_TYPE))
            ? _betTypeDetail2
            : betTypePerRequestId[_requestId];

        consumer.fulfillMatchup(
            _requestId,
            _betTypeDetail1,
            betTypeDetail2,
            _probA,
            _probB,
            gameId,
            sport,
            eventId,
            arePostQualifyingOdds,
            betTypeId
        );
    }

    /**
     * @notice Fulfill all data necessary to resolve sport markets
     * @param _requestId the request ID for fulfillment
     * @param _result win/loss for the matchup.
     * @param _resultDetails ranking/timing data to elaborate on win/loss
     */
    function fulfillResults(
        bytes32 _requestId,
        string memory _result,
        string memory _resultDetails
    ) external recordChainlinkFulfillment(_requestId) {
        bytes32 gameId = _stringToBytes32(gameIdPerRequestId[_requestId]);
        string memory sport = sportPerRequestId[_requestId];
        consumer.fulfillResults(_requestId, _result, _resultDetails, gameId, sport);
    }

    /* ========== VIEWS ========== */

    /// @notice Getting oracle address for CL data sport feed
    /// @return address of oracle
    function getOracleAddress() external view returns (address) {
        return chainlinkOracleAddress();
    }

    /// @notice Getting LINK token address for payment for requests
    /// @return address of LINK token
    function getTokenAddress() external view returns (address) {
        return chainlinkTokenAddress();
    }

    /* ========== INTERNALS ========== */

    function _putLink(address _sender, uint _payment) internal {
        linkToken.safeTransferFrom(_sender, address(this), _payment);
    }

    function _createBetType(string memory _betType, string memory _gameNumber) internal pure returns (string memory) {
        return string(abi.encodePacked(_betType, "_", _gameNumber));
    }

    function _createGameId(
        string memory _eventId,
        string memory _betType,
        string memory _gameNumber
    ) internal pure returns (string memory) {
        string memory gameIdInfix = keccak256(abi.encodePacked(_betType)) == keccak256(abi.encodePacked(H2H_BET_TYPE))
            ? H2H_GAME_ID_INFIX
            : _betType;
        return string(abi.encodePacked(_eventId, "_", gameIdInfix, "_", _gameNumber));
    }

    function _stringToBytes32(string memory source) internal pure returns (bytes32 result) {
        bytes memory tempEmptyStringTest = bytes(source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }
        assembly {
            // solhint-disable-line no-inline-assembly
            result := mload(add(source, 32))
        }
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    /// @notice setting payment for requests
    /// @param _paymentMetadata amount of LINK per request for metadata
    /// @param _paymentMatchup amount of LINK per request for mathcup
    /// @param _paymentResults amount of LINK per request for results
    function setPaymentAmounts(
        uint _paymentMetadata,
        uint _paymentMatchup,
        uint _paymentResults
    ) external onlyOwner {
        require(_paymentMetadata > 0 && _paymentMatchup > 0 && _paymentResults > 0, "Can not be zero");

        paymentMetadata = _paymentMetadata;
        paymentMatchup = _paymentMatchup;
        paymentResults = _paymentResults;

        emit NewPaymentAmounts(_paymentMetadata, _paymentMatchup, _paymentResults);
    }

    /// @notice setting job IDs for requests
    /// @param _requestMetadataJobId request metadata job ID
    /// @param _requestMatchupJobId request matchup job ID
    /// @param _requestResultsJobId request results job ID
    function setRequestsJobIds(
        string memory _requestMetadataJobId,
        string memory _requestMatchupJobId,
        string memory _requestResultsJobId
    ) external onlyOwner {
        requestMetadataJobId = _requestMetadataJobId;
        requestMatchupJobId = _requestMatchupJobId;
        requestResultsJobId = _requestResultsJobId;

        emit NewRequestsJobIds(_requestMetadataJobId, _requestMatchupJobId, _requestResultsJobId);
    }

    /// @notice Setting new oracle address
    /// @param _oracle address of oracle sports data feed
    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid address");
        setChainlinkOracle(_oracle);
        emit NewOracleAddress(_oracle);
    }

    /// @notice Setting consumer address
    /// @param _consumer address of a consumer which gets the data from CL requests
    function setConsumer(address _consumer) external onlyOwner {
        require(_consumer != address(0), "Invalid address");
        consumer = IApexConsumer(_consumer);
        emit NewConsumer(_consumer);
    }

    /// @notice Setting link address
    /// @param _link address of a LINK which request will be paid
    function setLink(address _link) external onlyOwner {
        require(_link != address(0), "Invalid address");
        setChainlinkToken(_link);
        linkToken = IERC20(_link);
        emit NewLinkAddress(_link);
    }

    /// @notice Sets if bet type is suported or not (delete from bet type)
    /// @param _betType bet type which needs to be supported or not
    /// @param _isSupported true/false (supported or not)
    function setSupportedBetType(string memory _betType, bool _isSupported) external onlyOwner {
        require(supportedBetType[_betType] != _isSupported, "Already set");
        supportedBetType[_betType] = _isSupported;
        emit BetTypesChanged(_betType, _isSupported);
    }

    /* ========== MODIFIERS ========== */

    modifier isValidMetaDataRequest(string memory _sport) {
        require(consumer.isSupportedSport(_sport), "Sport is not supported");
        _;
    }

    modifier isValidMatchupRequest(string memory _qualifyingStatus) {
        require(
            keccak256(abi.encodePacked(_qualifyingStatus)) == keccak256(abi.encodePacked("pre")) ||
                keccak256(abi.encodePacked(_qualifyingStatus)) == keccak256(abi.encodePacked("post")),
            "Qualifying status is not supported"
        );
        _;
    }

    modifier isValidBetType(string memory _betType) {
        require(supportedBetType[_betType], "Bet type is not supported");
        _;
    }

    /* ========== EVENTS ========== */

    event NewOracleAddress(address _oracle);
    event NewPaymentAmounts(uint _paymentMetadata, uint _paymentMatchup, uint _paymentResults);
    event NewRequestsJobIds(string _requestMetadataJobId, string _requestMatchupJobId, string _requestResultsJobId);
    event NewConsumer(address _consumer);
    event NewLinkAddress(address _link);
    event BetTypesChanged(string _betType, bool _isSupported);
}

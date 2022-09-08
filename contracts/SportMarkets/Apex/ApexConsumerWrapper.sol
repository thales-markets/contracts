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

    IApexConsumer public consumer;

    mapping(bytes32 => string) public sportPerRequestId;
    mapping(bytes32 => string) public gameIdPerRequestId;
    mapping(string => string) public sportPerEventId;

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
        string memory _requestResultsJobId
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
    }

    /* ========== CONSUMER REQUEST FUNCTIONS ========== */

    function requestMetaData(string memory sport) public whenNotPaused isValidMetaDataRequest(sport) {
        Chainlink.Request memory req = buildChainlinkRequest(
            _stringToBytes32(requestMetadataJobId),
            address(this),
            this.fulfillMetaData.selector
        );
        req.add("sports", sport);

        _putLink(msg.sender, paymentMetadata);

        bytes32 requestId = sendChainlinkRequest(req, paymentMetadata);
        sportPerRequestId[requestId] = sport;
    }

    function requestMatchup(
        string memory _eventID,
        string memory _betType,
        string memory _sport
    ) public whenNotPaused {
        Chainlink.Request memory req = buildChainlinkRequest(
            _stringToBytes32(requestMatchupJobId),
            address(this),
            this.fulfillMatchup.selector
        );
        req.add("event_id", _eventID);
        req.add("qualifying_status", "pre");
        req.add("bet_type", _betType);
        req.add("stage_level", "null");

        _putLink(msg.sender, paymentMatchup);

        bytes32 requestId = sendChainlinkRequest(req, paymentMatchup);
        sportPerRequestId[requestId] = _sport;
        gameIdPerRequestId[requestId] = _createGameId(_eventID, _betType);
    }

    function requestResults(
        string memory _eventID,
        string memory _betType,
        string memory _resultType
    ) public whenNotPaused {
        Chainlink.Request memory req = buildChainlinkRequest(
            _stringToBytes32(requestResultsJobId),
            address(this),
            this.fulfillResults.selector
        );
        req.add("event_id", _eventID);
        req.add("result_type", _resultType);
        req.add("bet_type", _betType);

        _putLink(msg.sender, paymentResults);

        bytes32 requestId = sendChainlinkRequest(req, paymentResults);
        sportPerRequestId[requestId] = sportPerEventId[_eventID];
    }

    /* ========== CONSUMER FULFILL FUNCTIONS ========== */

    /**
     * @notice Consumes the data returned by the node job on a particular request.
     * @param _requestId the request ID for fulfillment
     */
    function fulfillMetaData(
        bytes32 _requestId,
        string memory _event_id,
        string memory _bet_type,
        string memory _event_name,
        uint256 _qualifying_start_time,
        uint256 _race_start_time
    ) external recordChainlinkFulfillment(_requestId) {
        string memory sport = sportPerRequestId[_requestId];
        sportPerEventId[_event_id] = sport;

        consumer.fulfillMetaData(
            _requestId,
            _event_id,
            _bet_type,
            _event_name,
            _qualifying_start_time,
            _race_start_time,
            sport
        );
    }

    /**
     * @notice Consumes the data returned by the node job on a particular request.
     * @param _requestId the request ID for fulfillment
     * @param _betTypeDetail the type of bet being requested.
     * @param _probA: Probability for Team/Category/Rider A, returned as uint256.
     * @param _probB: Probability for Team/Category/Rider B, returned as uint256.
     */
    function fulfillMatchup(
        bytes32 _requestId,
        string memory _betTypeDetail,
        uint256 _probA,
        uint256 _probB
    ) external recordChainlinkFulfillment(_requestId) {
        bytes32 gameId = _stringToBytes32(gameIdPerRequestId[_requestId]);
        string memory sport = sportPerRequestId[_requestId];
        consumer.fulfillMatchup(_requestId, _betTypeDetail, _probA, _probB, gameId, sport);
    }

    /**
     * @notice Consumes the data returned by the node job on a particular request.
     * @param _requestId the request ID for fulfillment
     * @param _result win/loss for the matchup.
     * @param _resultDetails ranking/timing data to elaborate on win/loss
     */
    function fulfillResults(
        bytes32 _requestId,
        string memory _result,
        string memory _resultDetails
    ) external recordChainlinkFulfillment(_requestId) {
        consumer.fulfillResults(_requestId, _result, _resultDetails);
    }

    /* ========== VIEWS ========== */

    /// @notice getting oracle address for CL data sport feed
    /// @return address of oracle
    function getOracleAddress() external view returns (address) {
        return chainlinkOracleAddress();
    }

    /// @notice getting LINK token address for payment for requests
    /// @return address of LINK token
    function getTokenAddress() external view returns (address) {
        return chainlinkTokenAddress();
    }

    /* ========== INTERNALS ========== */

    function _putLink(address _sender, uint _payment) internal {
        linkToken.safeTransferFrom(_sender, address(this), _payment);
    }

    function _createGameId(string memory _eventId, string memory _betType) internal pure returns (string memory) {
        return string(abi.encodePacked(_eventId, "_", _betType));
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
    function setPaymentMetadata(
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

    /// @notice setting new oracle address
    /// @param _oracle address of oracle sports data feed
    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid address");
        setChainlinkOracle(_oracle);
        emit NewOracleAddress(_oracle);
    }

    /// @notice setting consumer address
    /// @param _consumer address of a consumer which gets the data from CL requests
    function setConsumer(address _consumer) external onlyOwner {
        require(_consumer != address(0), "Invalid address");
        consumer = IApexConsumer(_consumer);
        emit NewConsumer(_consumer);
    }

    /// @notice setting link address
    /// @param _link address of a LINK which request will be paid
    function setLink(address _link) external onlyOwner {
        require(_link != address(0), "Invalid address");
        setChainlinkToken(_link);
        linkToken = IERC20(_link);
        emit NewLinkAddress(_link);
    }

    /* ========== MODIFIERS ========== */

    modifier isValidMetaDataRequest(string memory sport) {
        require(
            keccak256(abi.encodePacked(sport)) == keccak256(abi.encodePacked("formula1")) ||
                keccak256(abi.encodePacked(sport)) == keccak256(abi.encodePacked("motogp")),
            "Sport is not supported"
        );
        _;
    }

    /* ========== EVENTS ========== */

    event NewOracleAddress(address _oracle);
    event NewPaymentAmounts(uint _paymentMetadata, uint _paymentMatchup, uint _paymentResults);
    event NewRequestsJobIds(string _requestMetadataJobId, string _requestMatchupJobId, string _requestResultsJobId);
    event NewConsumer(address _consumer);
    event NewLinkAddress(address _link);
}

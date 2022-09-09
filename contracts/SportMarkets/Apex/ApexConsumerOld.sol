// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.8/ConfirmedOwner.sol";

/*
 * **** Data Conversions ****
 *
 * Decimals to integers
 * ---------------------------------------------------
 * Value                           Conversion
 * ---------------------------------------------------
 * probability A                multiplied by 10000
 * probability B                multiplied by 10000
 * probability C                multiplied by 10000
 * probability D                multiplied by 10000
 *
 */

//Event meta data (to get event id): 8ffc516f1f024cf990e2a57ae08e58b3
//● Pre (or Post)-Qualifying Probabilities: 32e909bce3c649ce98a6d4bad8fa0307
//● Results: 4ef5150682ec4c2d8e69a94ded14cf3b
//Oracle Address: 0x28e2A3DAC71fd88d43D0EFcde8e14385c725F032

contract ApexConsumerOld is ChainlinkClient, ConfirmedOwner {
    using Chainlink for Chainlink.Request;

    /* ========== CONSUMER STATE VARIABLES ========== */

    uint256 private constant ORACLE_PAYMENT = (1 * LINK_DIVISIBILITY) / 1e2;
    string public event_id;
    string public bet_type;
    string public event_name;
    uint256 public qualifying_start_time;
    uint256 public race_start_time;

    string public betDetail1;
    string public betDetail2;
    uint256 public probabilityA;
    uint256 public probabilityB;
    uint256 public timestamp;

    string public results;
    string public resultsDetail;

    /* ========== CONSTRUCTOR ========== */

    constructor() ConfirmedOwner(msg.sender) {
        //        setPublicChainlinkToken();
        // use the function for Goerli calls.
        setChainlinkToken(0x326C977E6efc84E512bB9C30f76E30c160eD06FB);
    }

    /* ========== CONSUMER REQUEST FUNCTIONS ========== */

    // no parameters needed, just an automiatc get call
    function requestMetaData(
        address _oracle,
        string memory _jobId,
        string memory sports
    ) public onlyOwner {
        Chainlink.Request memory req = buildChainlinkRequest(
            stringToBytes32(_jobId),
            address(this),
            this.fulfillMetaData.selector
        );
        req.add("sports", sports);
        sendChainlinkRequestTo(_oracle, req, ORACLE_PAYMENT);
    }

    function requestMatchup(
        address _oracle,
        string memory _jobId,
        string memory eventID,
        string memory betType
    ) public onlyOwner {
        Chainlink.Request memory req = buildChainlinkRequest(
            stringToBytes32(_jobId),
            address(this),
            this.fulfillMatchup.selector
        );
        req.add("event_id", eventID); // example data points
        req.add("qualifying_status", "pre");
        req.add("bet_type", betType);
        req.add("stage_level", "null");
        sendChainlinkRequestTo(_oracle, req, ORACLE_PAYMENT);
    }

    function requestResults(
        address _oracle,
        string memory _jobId,
        string memory eventID,
        string memory betType,
        string memory resultType
    ) public onlyOwner {
        Chainlink.Request memory req = buildChainlinkRequest(
            stringToBytes32(_jobId),
            address(this),
            this.fulfillResults.selector
        );
        req.add("event_id", eventID);
        req.add("result_type", resultType);
        req.add("bet_type", betType);
        sendChainlinkRequestTo(_oracle, req, ORACLE_PAYMENT);
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
    ) public recordChainlinkFulfillment(_requestId) {
        emit RequestMetaDataFulfilled(
            _requestId,
            _event_id,
            _bet_type,
            _event_name,
            _qualifying_start_time,
            _race_start_time
        );
        event_id = _event_id;
        bet_type = _bet_type;
        event_name = _event_name;
        qualifying_start_time = _qualifying_start_time;
        race_start_time = _race_start_time;
    }

    /**
     * @notice Consumes the data returned by the node job on a particular request.
     * @param _requestId the request ID for fulfillment
     * @param _betTypeDetail1 Team/Category/Rider A identifier, returned as string.
     * @param _betTypeDetail2 Team/Category/Rider B identifier, returned as string.
     * @param _probA: Probability for Team/Category/Rider A, returned as uint256.
     * @param _probB: Probability for Team/Category/Rider B, returned as uint256.
     * @param _timeStamp: Timestamp this probability was sent, returned as uint256.
     */

    function fulfillMatchup(
        bytes32 _requestId,
        string calldata _betTypeDetail1,
        string calldata _betTypeDetail2,
        uint256 _probA,
        uint256 _probB,
        uint256 _timeStamp
    ) public recordChainlinkFulfillment(_requestId) {
        betDetail1 = _betTypeDetail1;
        betDetail2 = _betTypeDetail2;
        probabilityA = _probA;
        probabilityB = _probB;
        timestamp = _timeStamp;
        emit RequestProbabilitiesFulfilled(_requestId, _betTypeDetail1, _betTypeDetail2, _probA, _probB, _timeStamp);
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
    ) public recordChainlinkFulfillment(_requestId) {
        emit RequestResultsFulfilled(_requestId, _result, _resultDetails);
        results = _result;
        resultsDetail = _resultDetails;
    }

    /* ========== OTHER FUNCTIONS ========== */
    function getOracleAddress() external view returns (address) {
        return chainlinkOracleAddress();
    }

    function setOracle(address _oracle) external {
        setChainlinkOracle(_oracle);
    }

    function getChainlinkToken() public view returns (address) {
        return chainlinkTokenAddress();
    }

    function withdrawLink() public onlyOwner {
        LinkTokenInterface link = LinkTokenInterface(chainlinkTokenAddress());
        require(link.transfer(msg.sender, link.balanceOf(address(this))), "Unable to transfer");
    }

    function setLink(address _link) external onlyOwner {
        require(_link != address(0), "Invalid address");
        setChainlinkToken(_link);
    }

    function cancelRequest(
        bytes32 _requestId,
        uint256 _payment,
        bytes4 _callbackFunctionId,
        uint256 _expiration
    ) public onlyOwner {
        cancelChainlinkRequest(_requestId, _payment, _callbackFunctionId, _expiration);
    }

    function stringToBytes32(string memory source) private pure returns (bytes32 result) {
        bytes memory tempEmptyStringTest = bytes(source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }
        assembly {
            // solhint-disable-line no-inline-assembly
            result := mload(add(source, 32))
        }
    }

    event RequestMetaDataFulfilled(
        bytes32 indexed requestId,
        string event_id,
        string bet_type,
        string event_name,
        uint256 qualifying_start_time,
        uint256 race_start_time
    );

    event RequestProbabilitiesFulfilled(
        bytes32 indexed requestId,
        string betTypeDetail1,
        string betTypeDetail2,
        uint256 probA,
        uint256 probB,
        uint256 timeStamp
    );

    event RequestResultsFulfilled(bytes32 indexed requestId, string result, string resultDetails);
}

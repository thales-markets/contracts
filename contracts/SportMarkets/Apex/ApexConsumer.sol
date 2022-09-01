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

contract ApexConsumer is ChainlinkClient, ConfirmedOwner {
    using Chainlink for Chainlink.Request;

    /* ========== CONSUMER STATE VARIABLES ========== */

    uint256 private constant ORACLE_PAYMENT = 1 * LINK_DIVISIBILITY;
    bytes public event_id;
    bytes public bet_type;
    bytes public event_name;
    bytes public qualifying_start_time;
    bytes public race_start_time;

    bytes public timestamp;

    bytes public betTypeDetail;
    uint256 public probabilityA;
    uint256 public probabilityB;
    uint256 public probabilityC;
    uint256 public probabilityD;

    bytes public results;
    bytes public resultsDetail;

    /* ========== CONSTRUCTOR ========== */

    constructor() ConfirmedOwner(msg.sender) {
        //        setPublicChainlinkToken();
        // use the function for Goerli calls.
        setChainlinkToken(0x326C977E6efc84E512bB9C30f76E30c160eD06FB);
    }

    /* ========== CONSUMER REQUEST FUNCTIONS ========== */

    // no parameters needed, just an automiatc get call
    function requestMetaData(address _oracle, string memory _jobId) public onlyOwner {
        Chainlink.Request memory req = buildChainlinkRequest(
            stringToBytes32(_jobId),
            address(this),
            this.fulfillMetaData.selector
        );
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
        bytes calldata _event_id,
        bytes calldata _bet_type,
        bytes calldata _event_name,
        bytes calldata _qualifying_start_time,
        bytes calldata _race_start_time
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
     * @param _betTypeDetail the type of bet being requested.
     * @param _probA: Probability for Team/Category/Rider A, returned as uint256.
     * @param _probB: Probability for Team/Category/Rider B, returned as uint256.
     * @param _probC: Probability for Team/Category/Rider C, returned as uint256.
     * @param _probD: Probability for Team/Category/Rider D, returned as uint256.
     */

    function fulfillMatchup(
        bytes32 _requestId,
        bytes calldata _betTypeDetail,
        uint256 _probA,
        uint256 _probB,
        uint256 _probC,
        uint256 _probD,
        bytes calldata _timestamp
    ) public recordChainlinkFulfillment(_requestId) {
        betTypeDetail = _betTypeDetail;
        probabilityA = _probA;
        probabilityB = _probB;
        probabilityC = _probC;
        probabilityD = _probD;
        timestamp = _timestamp;
        emit RequestProbabilitiesFulfilled(_requestId, _betTypeDetail, _probA, _probB, _probC, _probD, _timestamp);
    }

    /**
     * @notice Consumes the data returned by the node job on a particular request.
     * @param _requestId the request ID for fulfillment
     * @param _result win/loss for the matchup.
     * @param _resultDetails ranking/timing data to elaborate on win/loss
     */
    function fulfillResults(
        bytes32 _requestId,
        bytes calldata _result,
        bytes calldata _resultDetails
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

    function bytes32ToString(bytes32 _bytes32) public pure returns (string memory) {
        uint8 i = 0;
        while (i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }

    function bytesToString(bytes memory byteCode) public pure returns (string memory stringData) {
        uint256 blank = 0; //blank 32 byte value
        uint256 length = byteCode.length;

        uint cycles = byteCode.length / 0x20;
        uint requiredAlloc = length;

        if (length % 0x20 > 0) //optimise copying the final part of the bytes - to avoid looping with single byte writes
        {
            cycles++;
            requiredAlloc += 0x20; //expand memory to allow end blank, so we don't smack the next stack entry
        }

        stringData = new string(requiredAlloc);

        //copy data in 32 byte blocks
        assembly {
            let cycle := 0

            for {
                let mc := add(stringData, 0x20) //pointer into bytes we're writing to
                let cc := add(byteCode, 0x20) //pointer to where we're reading from
            } lt(cycle, cycles) {
                mc := add(mc, 0x20)
                cc := add(cc, 0x20)
                cycle := add(cycle, 0x01)
            } {
                mstore(mc, mload(cc))
            }
        }

        //finally blank final bytes and shrink size (part of the optimisation to avoid looping adding blank bytes1)
        if (length % 0x20 > 0) {
            uint offsetStart = 0x20 + length;
            assembly {
                let mc := add(stringData, offsetStart)
                mstore(mc, mload(add(blank, 0x20)))
                //now shrink the memory back so the returned object is the correct size
                mstore(stringData, length)
            }
        }
    }

    event RequestMetaDataFulfilled(
        bytes32 indexed requestId,
        bytes event_id,
        bytes bet_type,
        bytes event_name,
        bytes qualifying_start_time,
        bytes race_start_time
    );

    event RequestProbabilitiesFulfilled(
        bytes32 indexed requestId,
        bytes betTypeDetail,
        uint256 probA,
        uint256 probB,
        uint256 probC,
        uint256 probD,
        bytes timestamp
    );

    event RequestResultsFulfilled(bytes32 indexed requestId, bytes result, bytes resultDetails);
}

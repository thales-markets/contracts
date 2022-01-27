pragma solidity ^0.5.16;

import "@chainlink/contracts/src/v0.5/ChainlinkClient.sol";
import "../utils/Owned.sol";

contract SportFeed is ChainlinkClient, Owned {
    using Chainlink for Chainlink.Request;

    address public oracle;
    bytes32 public jobId;
    uint256 public fee;

    bytes32 public result;

    string public resultString;
    string public firstPlace;
    string public secondPlace;
    string public thirdPlace;

    string public endpoint;
    string public season;
    string public eventSport;
    string public gender;

    constructor(
        address _owner,
        address _oracle,
        bytes32 _jobId,
        uint256 _fee,
        string memory _endpoint,
        string memory _season,
        string memory _event,
        string memory _gender
    ) public Owned(_owner) {
        //remove for the test
        setPublicChainlinkToken();
        oracle = _oracle;
        jobId = _jobId;
        fee = _fee;
        endpoint = _endpoint;
        season = _season;
        eventSport = _event;
        gender = _gender;
    }

    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }

    function setJobId(bytes32 _jobId) external onlyOwner {
        jobId = _jobId;
    }

    function setFee(uint256 _fee) external onlyOwner {
        fee = _fee;
    }

    function setSeason(string calldata _season) external onlyOwner {
        season = _season;
    }

    function setEventSport(string calldata _event) external onlyOwner {
        eventSport = _event;
    }

    function setGender(string calldata _gender) external onlyOwner {
        gender = _gender;
    }

    function setEndpoint(string calldata _endpoint) external onlyOwner {
        endpoint = _endpoint;
    }

    //0x5b22555341222c2243484e222c22474252225d00000000000000000000000000
    function setResult(bytes32 _result) external onlyOwner {
        _setResult(_result);
    }

    function isCompetitorAtPlace(string calldata competitor, uint place) external view returns (bool) {
        if (place == 1) {
            return compareStrings(firstPlace, competitor);
        }
        if (place == 2) {
            return compareStrings(secondPlace, competitor);
        }
        if (place == 3) {
            return compareStrings(thirdPlace, competitor);
        }
        return false;
    }

    /**
     * Initial request
     */
    function requestSportsWinner() external {
        Chainlink.Request memory req = buildChainlinkRequest(jobId, address(this), this.fulfillSportsWinner.selector);
        req.add("endpoint", endpoint);
        req.add("season", season);
        req.add("event", eventSport);
        req.add("gender", gender);
        sendChainlinkRequestTo(oracle, req, fee);
    }

    /**
     * Callback function
     */
    function fulfillSportsWinner(bytes32 _requestId, bytes32 _result) external recordChainlinkFulfillment(_requestId) {
        _setResult(_result);
    }

    function bytes32ToString(bytes32 _bytes32) internal pure returns (string memory) {
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

    function substring(
        string memory str,
        uint startIndex,
        uint endIndex
    ) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory tresult = new bytes(endIndex - startIndex);
        for (uint i = startIndex; i < endIndex; i++) {
            tresult[i - startIndex] = strBytes[i];
        }
        return string(tresult);
    }

    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }

    function _setResult(bytes32 _result) internal {
        result = _result;
        resultString = bytes32ToString(_result);
        firstPlace = substring(resultString, 2, 5);
        secondPlace = substring(resultString, 8, 11);
        thirdPlace = substring(resultString, 14, 17);
    }

    // function withdrawLink() external {} - Implement a withdraw function to avoid locking your LINK in the contract
}

pragma solidity ^0.5.16;

import "@chainlink/contracts/src/v0.5/ChainlinkClient.sol";
import "synthetix-2.43.1/contracts/Owned.sol";

contract OlympicsFeed is ChainlinkClient, Owned {
    using Chainlink for Chainlink.Request;

    address private oracle;
    bytes32 private jobId;
    uint256 private fee;

    bytes32 public result;

    constructor(address _owner) public Owned(_owner) {
        setPublicChainlinkToken();
        oracle = 0x56dd6586DB0D08c6Ce7B2f2805af28616E082455;
        jobId = "aa34467c0b074fb0888c9f42c449547f";
        fee = 1 * 10**18; // (Varies by network and job)
    }

    /**
     * Initial request
     */
    function requestOlympicsWinner(string memory season) public {
        Chainlink.Request memory req = buildChainlinkRequest(jobId, address(this), this.fulfillOlympicsWinner.selector);
        req.add("endpoint", "medals");
        req.add("season", season);
        sendChainlinkRequestTo(oracle, req, fee);
    }

    /**
     * Callback function
     */
    function fulfillOlympicsWinner(bytes32 _requestId, bytes32 _result) public recordChainlinkFulfillment(_requestId) {
        result = _result;
    }

    //0x5b22555341222c2243484e222c22474252225d00000000000000000000000000
    function setResult(bytes32 _result) external onlyOwner {
        result = _result;
    }

    function getResultAsString() public returns (string memory) {
        return bytes32ToString(result);
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

    // function withdrawLink() external {} - Implement a withdraw function to avoid locking your LINK in the contract
}

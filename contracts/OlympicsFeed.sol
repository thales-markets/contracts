pragma solidity ^0.6.0;

import "@chainlink/contracts/src/v0.6/ChainlinkClient.sol";

contract OlympicsFeed is ChainlinkClient {
    using Chainlink for Chainlink.Request;

    address private oracle;
    bytes32 private jobId;
    uint256 private fee;

    bytes32 public result;

    constructor() public {
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

    // function withdrawLink() external {} - Implement a withdraw function to avoid locking your LINK in the contract
}

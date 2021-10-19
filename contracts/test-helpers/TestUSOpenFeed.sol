pragma solidity ^0.5.16;

import "@chainlink/contracts/src/v0.5/ChainlinkClient.sol";
import "synthetix-2.50.4-ovm/contracts/Owned.sol";

contract TestUSOpenFeed is ChainlinkClient, Owned {
    using Chainlink for Chainlink.Request;

    address public oracle;
    bytes32 public jobId;
    uint256 public fee;

    uint public result;

    string public season;

    constructor(
        address _owner,
        address _oracle,
        bytes32 _jobId,
        uint256 _fee,
        string memory _season
    ) public Owned(_owner) {
        //remove for the test
        oracle = _oracle;
        jobId = _jobId;
        fee = _fee;
        season = _season;
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

    function setResult(uint _result) external onlyOwner {
        _setResult(_result);
    }

    /**
     * Initial request
     */
    function requestSportsWinner() external {
        Chainlink.Request memory req = buildChainlinkRequest(jobId, address(this), this.fulfillSportsWinner.selector);
        req.add("season", season);
    }

    /**
     * Callback function
     */
    function fulfillSportsWinner(bytes32 _requestId, uint _result) external recordChainlinkFulfillment(_requestId) {
        _setResult(_result);
    }

    function _setResult(uint _result) internal {
        result = _result;
    }

    // function withdrawLink() external {} - Implement a withdraw function to avoid locking your LINK in the contract
}

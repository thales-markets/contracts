pragma solidity ^0.5.16;

import "@chainlink/contracts/src/v0.5/ChainlinkClient.sol";
import "synthetix-2.43.1/contracts/Owned.sol";

contract EthBurnedFeed is ChainlinkClient, Owned {
    using Chainlink for Chainlink.Request;

    address public oracle;
    bytes32 public jobId;
    uint256 public fee;
    uint256 public lastOracleUpdate;

    uint256 public result;

    string public endpoint;

    constructor(
        address _owner,
        address _oracle,
        bytes32 _jobId,
        uint256 _fee,
        string memory _endpoint,
        bool _testMode
    ) public Owned(_owner) {
        if (!_testMode) {
            //remove for the test
            setPublicChainlinkToken();
        }
        oracle = _oracle;
        jobId = _jobId;
        fee = _fee;
        endpoint = _endpoint;
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

    function setEndpoint(string calldata _endpoint) external onlyOwner {
        endpoint = _endpoint;
    }

    //0x5b22555341222c2243484e222c22474252225d00000000000000000000000000
    function setResult(uint256 _result) external onlyOwner {
        _setResult(_result);
    }

    function _setResult(uint256 _result) private {
        result = _result / 1e18;
        lastOracleUpdate = block.timestamp;
    }

    /**
     * Initial request
     */
    function requestResult() external {
        Chainlink.Request memory req = buildChainlinkRequest(jobId, address(this), this.fulfillEthBurned.selector);
        req.add("endpoint", endpoint);
        sendChainlinkRequestTo(oracle, req, fee);
    }

    /**
     * Callback function
     */
    function fulfillEthBurned(bytes32 _requestId, uint256 _result) external recordChainlinkFulfillment(_requestId) {
        _setResult(_result);
    }
}

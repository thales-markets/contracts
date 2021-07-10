pragma solidity ^0.5.16;

import "@chainlink/contracts/src/v0.5/ChainlinkClient.sol";
import "synthetix-2.43.1/contracts/Owned.sol";

contract OlympicsFeed is ChainlinkClient, Owned {
    using Chainlink for Chainlink.Request;

    address private oracle;
    bytes32 private jobId;
    uint256 private fee;

    bytes32 public result;

    string public resultString;
    string public firstPlace;
    string public secondPlace;
    string public thirdPlace;

    constructor(address _owner) public Owned(_owner) {
        //remove for the test
        //setPublicChainlinkToken();
        oracle = 0x56dd6586DB0D08c6Ce7B2f2805af28616E082455;
        jobId = "aa34467c0b074fb0888c9f42c449547f";
        fee = 1 * 10**18; // (Varies by network and job)
    }

    //0x5b22555341222c2243484e222c22474252225d00000000000000000000000000
    function setResult(bytes32 _result) public onlyOwner {
        result = _result;
        resultString = bytes32ToString(_result);
        firstPlace = substring(resultString, 2, 5);
        secondPlace = substring(resultString, 8, 11);
        thirdPlace = substring(resultString, 14, 17);
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
        setResult(_result);
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

    function substring(
        string memory str,
        uint startIndex,
        uint endIndex
    ) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(endIndex - startIndex);
        for (uint i = startIndex; i < endIndex; i++) {
            result[i - startIndex] = strBytes[i];
        }
        return string(result);
    }

    //    function isCountryAtPlace(string memory country, uint place) external view returns (bool) {
    //        if(place==1){
    //            if
    //        }
    //        return !resolved && _matured() && _isFreshPriceUpdateTime(updatedAt);
    //    }

    // function withdrawLink() external {} - Implement a withdraw function to avoid locking your LINK in the contract
}

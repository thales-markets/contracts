pragma solidity >=0.5.16 <0.8.4;

import "@chainlink/contracts/src/v0.5/ChainlinkClient.sol";
import "./USOpenFeed.sol";
import "../interfaces/IOracleInstance.sol";
import "../utils/Owned.sol";

contract USOpenFeedInstance is IOracleInstance, Owned {
    using Chainlink for Chainlink.Request;

    address public sportFeed;
    string public targetName;
    string public targetOutcome;
    string public eventName;

    uint public competitor;

    bool public outcome;
    bool public resolvable = false;

    bool private forcedOutcome;

    constructor(
        address _owner,
        address _sportFeed,
        uint _competitor,
        string memory _targetName,
        string memory _targetOutcome,
        string memory _eventName
    ) public Owned(_owner) {
        sportFeed = _sportFeed;
        competitor = _competitor;
        targetName = _targetName;
        targetOutcome = _targetOutcome;
        eventName = _eventName;
    }

    function getOutcome() external view returns (bool) {
        if (forcedOutcome) {
            return outcome;
        } else {
            USOpenFeed usOpenFeed = USOpenFeed(sportFeed);
            return usOpenFeed.result() == competitor;
        }
    }

    function setOutcome(bool _outcome) public onlyOwner {
        outcome = _outcome;
        forcedOutcome = true;
    }

    function setSportFeed(address _sportFeed) public onlyOwner {
        sportFeed = _sportFeed;
    }

    function clearOutcome() public onlyOwner {
        forcedOutcome = false;
    }

    function setResolvable(bool _resolvable) public onlyOwner {
        resolvable = _resolvable;
    }
}

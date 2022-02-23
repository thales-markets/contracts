// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "./SportFeed.sol";
import "../interfaces/IOracleInstance.sol";
import "../utils/libraries/Int.sol";

contract SportFeedOracleInstance is IOracleInstance, Owned {
    using Chainlink for Chainlink.Request;
    using Int for uint;

    address public sportFeed;
    string public targetName;
    string public targetOutcome;
    string public eventName;

    bool public outcome;
    bool public override resolvable;

    bool private forcedOutcome;

    constructor(
        address _owner,
        address _sportFeed,
        string memory _targetName,
        string memory _targetOutcome,
        string memory _eventName
    ) Owned(_owner) {
        sportFeed = _sportFeed;
        targetName = _targetName;
        targetOutcome = _targetOutcome;
        eventName = _eventName;
    }

    function getOutcome() external view override returns (bool) {
        if (forcedOutcome) {
            return outcome;
        } else {
            SportFeed sportFeedOracle = SportFeed(sportFeed);
            return sportFeedOracle.isCompetitorAtPlace(targetName, Int.parseInt(targetOutcome));
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

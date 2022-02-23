// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "./EthBurnedFeed.sol";
import "../interfaces/IOracleInstance.sol";
import "../utils/Owned.sol";
import "../utils/libraries/Int.sol";

contract EthBurnedOracleInstance is IOracleInstance, Owned {
    using Chainlink for Chainlink.Request;
    using Int for uint;

    address public ethBurnedFeed;
    string public targetName;
    uint256 public targetOutcome;
    string public eventName;

    bool public outcome;
    bool private _resolvable;

    bool private forcedOutcome;

    constructor(
        address _owner,
        address _ethBurnedFeed,
        string memory _targetName,
        uint256 _targetOutcome,
        string memory _eventName
    ) Owned(_owner) {
        ethBurnedFeed = _ethBurnedFeed;
        targetName = _targetName;
        targetOutcome = _targetOutcome;
        eventName = _eventName;
    }

    function getOutcome() external view override returns (bool) {
        if (forcedOutcome) {
            return outcome;
        } else {
            EthBurnedFeed ethBurnedFeedOracle = EthBurnedFeed(ethBurnedFeed);
            return ethBurnedFeedOracle.result() > targetOutcome;
        }
    }

    function setOutcome(bool _outcome) public onlyOwner {
        outcome = _outcome;
        forcedOutcome = true;
    }

    function setEthBurnedFeed(address _ethBurnedFeed) public onlyOwner {
        ethBurnedFeed = _ethBurnedFeed;
    }

    function clearOutcome() public onlyOwner {
        forcedOutcome = false;
    }

    function setResolvable(bool _resolvableToSet) public onlyOwner {
        _resolvable = _resolvableToSet;
    }

    function resolvable() external view override returns (bool) {
        EthBurnedFeed ethBurnedFeedOracle = EthBurnedFeed(ethBurnedFeed);
        return (block.timestamp - ethBurnedFeedOracle.lastOracleUpdate()) < 2 hours;
    }
}

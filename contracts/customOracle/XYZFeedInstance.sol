// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IOracleInstance.sol";
import "./IMerkleDistributor.sol";
import "../utils/Owned.sol";

contract XYZFeedInstance is IOracleInstance, Owned {
    IMerkleDistributor public iMerkleDistributor;
    string public targetName;
    string public targetOutcome;
    string public eventName;

    uint256 public targetCount;

    bool public outcome;
    bool public override resolvable = true;

    bool private forcedOutcome;

    constructor(
        address _owner,
        address _iMerkleDistributor,
        uint256 _targetCount,
        string memory _targetName,
        string memory _targetOutcome,
        string memory _eventName
    ) Owned(_owner) {
        iMerkleDistributor = IMerkleDistributor(_iMerkleDistributor);
        targetCount = _targetCount;
        targetName = _targetName;
        targetOutcome = _targetOutcome;
        eventName = _eventName;
    }

    function getOutcome() external view override returns (bool) {
        if (forcedOutcome) {
            return outcome;
        } else {
            return iMerkleDistributor.claimed() >= targetCount;
        }
    }

    function setOutcome(bool _outcome) public onlyOwner {
        outcome = _outcome;
        forcedOutcome = true;
    }

    function clearOutcome() public onlyOwner {
        forcedOutcome = false;
    }

    function setResolvable(bool _resolvable) public onlyOwner {
        resolvable = _resolvable;
    }
}

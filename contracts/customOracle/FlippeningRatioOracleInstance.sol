// SPDX-License-Identifier: MIT
pragma solidity >=0.5.16 <0.8.4;

import "../interfaces/IOracleInstance.sol";
import "./FlippeningRatioOracle.sol";
import "../utils/Owned.sol";

contract FlippeningRatioOracleInstance is IOracleInstance, Owned {
    FlippeningRatioOracle public flippeningRatio;
    string public targetName;
    uint256 public targetOutcome;
    string public eventName;

    bool public outcome;
    bool public resolvable = true;

    bool private forcedOutcome;

    constructor(
        address _owner,
        address _flippeningRatio,
        string memory _targetName,
        uint256 _targetOutcome,
        string memory _eventName
    ) public Owned(_owner) {
        flippeningRatio = FlippeningRatioOracle(_flippeningRatio);
        targetName = _targetName;
        targetOutcome = _targetOutcome;
        eventName = _eventName;
    }

    function getOutcome() external view returns (bool) {
        if (forcedOutcome) {
            return outcome;
        } else {
            return flippeningRatio.getRatio() >= targetOutcome;
        }
    }

    function setOutcome(bool _outcome) public onlyOwner {
        outcome = _outcome;
        forcedOutcome = true;
    }

    function clearOutcome() public onlyOwner {
        forcedOutcome = false;
    }

    function setFlippeningRatio(address _flippeningRatio) public onlyOwner {
        flippeningRatio = FlippeningRatioOracle(_flippeningRatio);
    }

    function setResolvable(bool _resolvable) public onlyOwner {
        resolvable = _resolvable;
    }
}

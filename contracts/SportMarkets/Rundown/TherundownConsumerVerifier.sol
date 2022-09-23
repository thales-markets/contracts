// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

// interface
import "../../interfaces/ITherundownConsumer.sol";

/// @title Verifier of data which are coming from CL and stored into TherundownConsumer.sol
/// @author gruja
contract TherundownConsumerVerifier is Initializable, ProxyOwned, ProxyPausable {
    uint private constant ONE_PERCENT = 1e16;
    uint private constant ONE = 1e18;

    ITherundownConsumer public consumer;
    mapping(bytes32 => bool) public invalidName;
    mapping(bytes32 => bool) public supportedMarketType;
    uint public defaultOddThreshold;
    mapping(uint => uint) public oddThresholdForSport;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        address _consumer,
        string[] memory _invalidNames,
        string[] memory _supportedMarketTypes,
        uint _defaultOddThreshold
    ) external initializer {
        setOwner(_owner);
        consumer = ITherundownConsumer(_consumer);
        _setInvalidNames(_invalidNames, true);
        _setSupportedMarketTypes(_supportedMarketTypes, true);
        defaultOddThreshold = _defaultOddThreshold;
    }

    /* ========== VIEW FUNCTIONS ========== */

    /// @notice view function which returns names of teams/fighters are invalid
    /// @param _teamA team A in string (Example: Liverpool)
    /// @param _teamB team B in string (Example: Arsenal)
    /// @return bool is names invalid (true -> invalid, false -> valid)
    function isInvalidNames(string memory _teamA, string memory _teamB) external view returns (bool) {
        return
            keccak256(abi.encodePacked(_teamA)) == keccak256(abi.encodePacked(_teamB)) ||
            invalidName[keccak256(abi.encodePacked(_teamA))] ||
            invalidName[keccak256(abi.encodePacked(_teamB))];
    }

    /// @notice view function which returns if names are the same
    /// @param _teamA team A in string (Example: Liverpool)
    /// @param _teamB team B in string (Example: Arsenal)
    /// @return bool is names are the same
    function areTeamsEqual(string memory _teamA, string memory _teamB) external view returns (bool) {
        return keccak256(abi.encodePacked(_teamA)) == keccak256(abi.encodePacked(_teamB));
    }

    /// @notice view function which returns if market type is supported, checks are done in a wrapper contract
    /// @param _market type of market (create or resolve)
    /// @return bool supported or not
    function isSupportedMarketType(string memory _market) external view returns (bool) {
        return supportedMarketType[keccak256(abi.encodePacked(_market))];
    }

    /// @notice view function which returns if odds are inside of the threshold
    /// @param _sportId sport id for which we get threshold
    /// @return bool true if odds are less then threshold false if above
    function areOddsInThreshold(
        uint _sportId,
        uint _currentOdd,
        uint _newOdd
    ) external view returns (bool) {
        uint threshold = oddThresholdForSport[_sportId] == 0 ? defaultOddThreshold : oddThresholdForSport[_sportId];

        // new odd appear or it is equal
        if (_currentOdd == 0 || _currentOdd == _newOdd) {
            return true;
        }

        // if current odd is GT new one
        if (_newOdd > _currentOdd) {
            return !(((ONE * _newOdd) / _currentOdd) > (ONE + (threshold * ONE_PERCENT)));
        }
        return !(ONE - ((_newOdd * ONE) / _currentOdd) > (threshold * ONE_PERCENT));
    }

    /* ========== INTERNALS ========== */

    function _setInvalidNames(string[] memory _invalidNames, bool _isInvalid) internal {
        for (uint256 index = 0; index < _invalidNames.length; index++) {
            // only if current flag is different, if same skip it
            if (invalidName[keccak256(abi.encodePacked(_invalidNames[index]))] != _isInvalid) {
                invalidName[keccak256(abi.encodePacked(_invalidNames[index]))] = _isInvalid;
                emit SetInvalidName(keccak256(abi.encodePacked(_invalidNames[index])), _isInvalid);
            }
        }
    }

    function _setSupportedMarketTypes(string[] memory _supportedMarketTypes, bool _isSupported) internal {
        for (uint256 index = 0; index < _supportedMarketTypes.length; index++) {
            // only if current flag is different, if same skip it
            if (supportedMarketType[keccak256(abi.encodePacked(_supportedMarketTypes[index]))] != _isSupported) {
                supportedMarketType[keccak256(abi.encodePacked(_supportedMarketTypes[index]))] = _isSupported;
                emit SetSupportedMarketType(keccak256(abi.encodePacked(_supportedMarketTypes[index])), _isSupported);
            }
        }
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    /// @notice sets consumer address
    /// @param _consumer consumer address
    function setConsumerAddress(address _consumer) external onlyOwner {
        require(_consumer != address(0), "Invalid address");
        consumer = ITherundownConsumer(_consumer);
        emit NewConsumerAddress(_consumer);
    }

    /// @notice sets invalid names
    /// @param _invalidNames invalid names as array of strings
    /// @param _isInvalid true/false (invalid or not)
    function setInvalidNames(string[] memory _invalidNames, bool _isInvalid) external onlyOwner {
        require(_invalidNames.length > 0, "Invalid input");
        _setInvalidNames(_invalidNames, _isInvalid);
    }

    /// @notice sets supported market types
    /// @param _supportedMarketTypes supported types as array of strings
    /// @param _isSupported true/false (invalid or not)
    function setSupportedMarketTypes(string[] memory _supportedMarketTypes, bool _isSupported) external onlyOwner {
        require(_supportedMarketTypes.length > 0, "Invalid input");
        _setSupportedMarketTypes(_supportedMarketTypes, _isSupported);
    }

    /// @notice setting default odd threshold
    /// @param _defaultOddThreshold default odd threshold
    function setDefaultOddThreshold(uint _defaultOddThreshold) external onlyOwner {
        require(_defaultOddThreshold > 0, "Must be more then ZERO");
        defaultOddThreshold = _defaultOddThreshold;
        emit NewDefaultOddThreshold(_defaultOddThreshold);
    }

    /// @notice setting custom odd threshold for sport
    /// @param _sportId sport id
    /// @param _oddThresholdForSport custom odd threshold which will be by sport
    function setCustomOddThresholdForSport(uint _sportId, uint _oddThresholdForSport) external onlyOwner {
        require(defaultOddThreshold != _oddThresholdForSport, "Same value as default value");
        require(_oddThresholdForSport > 0, "Must be more then ZERO");
        require(consumer.isSupportedSport(_sportId), "SportId is not supported");
        require(oddThresholdForSport[_sportId] != _oddThresholdForSport, "Same value as before");
        oddThresholdForSport[_sportId] = _oddThresholdForSport;
        emit NewCustomOddThresholdForSport(_sportId, _oddThresholdForSport);
    }

    /* ========== EVENTS ========== */
    event NewConsumerAddress(address _consumer);
    event SetInvalidName(bytes32 _invalidName, bool _isInvalid);
    event SetSupportedMarketType(bytes32 _supportedMarketType, bool _isSupported);
    event NewDefaultOddThreshold(uint _defaultOddThreshold);
    event NewCustomOddThresholdForSport(uint _sportId, uint _oddThresholdForSport);
}

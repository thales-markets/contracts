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
    uint public constant CANCELLED = 0;
    uint public constant HOME_WIN = 1;
    uint public constant AWAY_WIN = 2;
    uint public constant RESULT_DRAW = 3;

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
    /// @param _currentOdds current odd on a contract
    /// @param _newOdds new odd on a contract
    /// @param _isTwoPositionalSport is sport two positional
    /// @return bool true if odds are less then threshold false if above
    function areOddsInThreshold(
        uint _sportId,
        uint[] memory _currentOdds,
        uint[] memory _newOdds,
        bool _isTwoPositionalSport
    ) external view returns (bool) {
        return
            areOddInThreshold(_sportId, _currentOdds[0], _newOdds[0]) &&
            areOddInThreshold(_sportId, _currentOdds[1], _newOdds[1]) &&
            (_isTwoPositionalSport || areOddInThreshold(_sportId, _currentOdds[2], _newOdds[2]));
    }

    /// @notice view function which returns if odds are inside of the threshold
    /// @param _sportId sport id for which we get threshold
    /// @param _currentOdd current odd on a contract
    /// @param _newOdd new odd on a contract
    /// @return bool true if odds are less then threshold false if above
    function areOddInThreshold(
        uint _sportId,
        uint _currentOdd,
        uint _newOdd
    ) public view returns (bool) {
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

    /// @notice view function which if odds are valid or not
    /// @param _isTwoPositionalSport if two positional sport dont look at draw odd
    /// @param _homeOdds odd for home win
    /// @param _awayOdds odd for away win
    /// @param _drawOdds odd for draw win
    /// @return bool true - valid, fasle - invalid
    function areOddsValid(
        bool _isTwoPositionalSport,
        int24 _homeOdds,
        int24 _awayOdds,
        int24 _drawOdds
    ) external view returns (bool) {
        return _areOddsValid(_isTwoPositionalSport, _homeOdds, _awayOdds, _drawOdds);
    }

    /// @notice view function which returns if outcome of a game is valid
    /// @param _isTwoPositionalSport if two positional sport  draw now vallid
    /// @param _outcome home - 1, away - 2, draw - 3 (if not two positional), and cancel - 0 are valid outomes
    /// @return bool true - valid, fasle - invalid
    function isValidOutcomeForGame(bool _isTwoPositionalSport, uint _outcome) external view returns (bool) {
        return _isValidOutcomeForGame(_isTwoPositionalSport, _outcome);
    }

    /// @notice view function which returns if outcome is good with a score
    /// @param _outcome home - 1, away - 2, draw - 3 (if not two positional), and cancel - 0 are valid outomes
    /// @param _homeScore home team has scored in points
    /// @param _awayScore away team has scored in points
    /// @return bool true - valid, fasle - invalid
    function isValidOutcomeWithResult(
        uint _outcome,
        uint _homeScore,
        uint _awayScore
    ) external view returns (bool) {
        return _isValidOutcomeWithResult(_outcome, _homeScore, _awayScore);
    }

    /// @notice calculate normalized odds based on american odds
    /// @param _americanOdds american odds in array of 3 [home,away,draw]
    /// @return uint[] array of normalized odds
    function calculateAndNormalizeOdds(int[] memory _americanOdds) external view returns (uint[] memory) {
        return _calculateAndNormalizeOdds(_americanOdds);
    }

    /* ========== INTERNALS ========== */

    function _calculateAndNormalizeOdds(int[] memory _americanOdds) internal pure returns (uint[] memory) {
        uint[] memory normalizedOdds = new uint[](_americanOdds.length);
        uint totalOdds;
        for (uint i = 0; i < _americanOdds.length; i++) {
            uint odd;
            if (_americanOdds[i] == 0) {
                normalizedOdds[i] = 0;
            } else if (_americanOdds[i] > 0) {
                odd = uint(_americanOdds[i]);
                normalizedOdds[i] = ((10000 * 1e18) / (odd + 10000)) * 100;
            } else if (_americanOdds[i] < 0) {
                odd = uint(-_americanOdds[i]);
                normalizedOdds[i] = ((odd * 1e18) / (odd + 10000)) * 100;
            }
            totalOdds += normalizedOdds[i];
        }
        for (uint i = 0; i < normalizedOdds.length; i++) {
            if (totalOdds == 0) {
                normalizedOdds[i] = 0;
            } else {
                normalizedOdds[i] = (1e18 * normalizedOdds[i]) / totalOdds;
            }
        }
        return normalizedOdds;
    }

    function _areOddsValid(
        bool _isTwoPositionalSport,
        int24 _homeOdds,
        int24 _awayOdds,
        int24 _drawOdds
    ) internal view returns (bool) {
        if (_isTwoPositionalSport) {
            return _awayOdds != 0 && _homeOdds != 0;
        } else {
            return _awayOdds != 0 && _homeOdds != 0 && _drawOdds != 0;
        }
    }

    function _isValidOutcomeForGame(bool _isTwoPositionalSport, uint _outcome) internal view returns (bool) {
        if (_isTwoPositionalSport) {
            return _outcome == HOME_WIN || _outcome == AWAY_WIN || _outcome == CANCELLED;
        }
        return _outcome == HOME_WIN || _outcome == AWAY_WIN || _outcome == RESULT_DRAW || _outcome == CANCELLED;
    }

    function _isValidOutcomeWithResult(
        uint _outcome,
        uint _homeScore,
        uint _awayScore
    ) internal pure returns (bool) {
        if (_outcome == CANCELLED) {
            return _awayScore == CANCELLED && _homeScore == CANCELLED;
        } else if (_outcome == HOME_WIN) {
            return _homeScore > _awayScore;
        } else if (_outcome == AWAY_WIN) {
            return _homeScore < _awayScore;
        } else {
            return _homeScore == _awayScore;
        }
    }

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
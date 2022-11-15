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
    uint public defaultOddsThreshold;
    mapping(uint => uint) public oddsThresholdForSport;

    uint256[] public defaultBookmakerIds;
    mapping(uint256 => uint256[]) public sportIdToBookmakerIds;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        address _consumer,
        string[] memory _invalidNames,
        string[] memory _supportedMarketTypes,
        uint _defaultOddsThreshold
    ) external initializer {
        setOwner(_owner);
        consumer = ITherundownConsumer(_consumer);
        _setInvalidNames(_invalidNames, true);
        _setSupportedMarketTypes(_supportedMarketTypes, true);
        defaultOddsThreshold = _defaultOddsThreshold;
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
    /// @param _currentOddsArray current odds on a contract as array
    /// @param _newOddsArray new odds on a contract as array
    /// @param _isTwoPositionalSport is sport two positional
    /// @return bool true if odds are less then threshold false if above
    function areOddsArrayInThreshold(
        uint _sportId,
        uint[] memory _currentOddsArray,
        uint[] memory _newOddsArray,
        bool _isTwoPositionalSport
    ) external view returns (bool) {
        return
            areOddsInThreshold(_sportId, _currentOddsArray[0], _newOddsArray[0]) &&
            areOddsInThreshold(_sportId, _currentOddsArray[1], _newOddsArray[1]) &&
            (_isTwoPositionalSport || areOddsInThreshold(_sportId, _currentOddsArray[2], _newOddsArray[2]));
    }

    /// @notice view function which returns if odds are inside of the threshold
    /// @param _sportId sport id for which we get threshold
    /// @param _currentOdds current single odds on a contract
    /// @param _newOdds new single odds on a contract
    /// @return bool true if odds are less then threshold false if above
    function areOddsInThreshold(
        uint _sportId,
        uint _currentOdds,
        uint _newOdds
    ) public view returns (bool) {
        uint threshold = oddsThresholdForSport[_sportId] == 0 ? defaultOddsThreshold : oddsThresholdForSport[_sportId];

        // new odds appear or it is equal
        if (_currentOdds == 0 || _currentOdds == _newOdds) {
            return true;
        }

        // if current odds is GT new one
        if (_newOdds > _currentOdds) {
            return !(((ONE * _newOdds) / _currentOdds) > (ONE + (threshold * ONE_PERCENT)));
        }
        return !(ONE - ((_newOdds * ONE) / _currentOdds) > (threshold * ONE_PERCENT));
    }

    /// @notice view function which if odds are valid or not
    /// @param _isTwoPositionalSport if two positional sport dont look at draw odds
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
            uint calculationOdds;
            if (_americanOdds[i] == 0) {
                normalizedOdds[i] = 0;
            } else if (_americanOdds[i] > 0) {
                calculationOdds = uint(_americanOdds[i]);
                normalizedOdds[i] = ((10000 * 1e18) / (calculationOdds + 10000)) * 100;
            } else if (_americanOdds[i] < 0) {
                calculationOdds = uint(-_americanOdds[i]);
                normalizedOdds[i] = ((calculationOdds * 1e18) / (calculationOdds + 10000)) * 100;
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

    /// @notice view function which returns odds in a batch of games
    /// @param _gameIds game ids for which games is looking
    /// @return odds odds array
    function getOddsForGames(bytes32[] memory _gameIds) external view returns (int24[] memory odds) {
        odds = new int24[](3 * _gameIds.length);
        for (uint i = 0; i < _gameIds.length; i++) {
            (int24 home, int24 away, int24 draw) = consumer.getOddsForGame(_gameIds[i]);
            odds[i * 3 + 0] = home; // 0 3 6 ...
            odds[i * 3 + 1] = away; // 1 4 7 ...
            odds[i * 3 + 2] = draw; // 2 5 8 ...
        }
    }

    /// @notice getting bookmaker by sports id
    /// @param _sportId id of a sport for fetching
    function getBookmakerIdsBySportId(uint256 _sportId) external view returns (uint256[] memory) {
        return sportIdToBookmakerIds[_sportId].length > 0 ? sportIdToBookmakerIds[_sportId] : defaultBookmakerIds;
    }

    /// @notice return string array from bytes32 array
    /// @param _ids bytes32 array of game ids
    function getStringIDsFromBytesArrayIDs(bytes32[] memory _ids) external view returns (string[] memory _gameIds) {
        if (_ids.length > 0) {
            _gameIds = new string[](_ids.length);
        }
        for (uint i = 0; i < _ids.length; i++) {
            _gameIds[i] = string(abi.encodePacked(_ids[i]));
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

    /// @notice setting default odds threshold
    /// @param _defaultOddsThreshold default odds threshold
    function setDefaultOddsThreshold(uint _defaultOddsThreshold) external onlyOwner {
        require(_defaultOddsThreshold > 0, "Must be more then ZERO");
        defaultOddsThreshold = _defaultOddsThreshold;
        emit NewDefaultOddsThreshold(_defaultOddsThreshold);
    }

    /// @notice setting custom odds threshold for sport
    /// @param _sportId sport id
    /// @param _oddsThresholdForSport custom odds threshold which will be by sport
    function setCustomOddsThresholdForSport(uint _sportId, uint _oddsThresholdForSport) external onlyOwner {
        require(defaultOddsThreshold != _oddsThresholdForSport, "Same value as default value");
        require(_oddsThresholdForSport > 0, "Must be more then ZERO");
        require(consumer.isSupportedSport(_sportId), "SportId is not supported");
        require(oddsThresholdForSport[_sportId] != _oddsThresholdForSport, "Same value as before");
        oddsThresholdForSport[_sportId] = _oddsThresholdForSport;
        emit NewCustomOddsThresholdForSport(_sportId, _oddsThresholdForSport);
    }

    /// @notice setting default bookmakers
    /// @param _defaultBookmakerIds array of bookmaker ids
    function setDefaultBookmakerIds(uint256[] memory _defaultBookmakerIds) external onlyOwner {
        defaultBookmakerIds = _defaultBookmakerIds;
        emit NewDefaultBookmakerIds(_defaultBookmakerIds);
    }

    /// @notice setting bookmaker by sports id
    /// @param _sportId id of a sport
    /// @param _bookmakerIds array of bookmakers
    function setBookmakerIdsBySportId(uint256 _sportId, uint256[] memory _bookmakerIds) external onlyOwner {
        require(consumer.isSupportedSport(_sportId), "SportId is not supported");
        sportIdToBookmakerIds[_sportId] = _bookmakerIds;
        emit NewBookmakerIdsBySportId(_sportId, _bookmakerIds);
    }

    /* ========== EVENTS ========== */
    event NewConsumerAddress(address _consumer);
    event SetInvalidName(bytes32 _invalidName, bool _isInvalid);
    event SetSupportedMarketType(bytes32 _supportedMarketType, bool _isSupported);
    event NewDefaultOddsThreshold(uint _defaultOddsThreshold);
    event NewCustomOddsThresholdForSport(uint _sportId, uint _oddsThresholdForSport);
    event NewBookmakerIdsBySportId(uint256 _sportId, uint256[] _ids);
    event NewDefaultBookmakerIds(uint256[] _ids);
}

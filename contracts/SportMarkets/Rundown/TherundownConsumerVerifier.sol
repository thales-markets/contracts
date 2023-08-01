// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

// interface
import "../../interfaces/ITherundownConsumer.sol";
import "../../interfaces/IGamesOddsObtainer.sol";
import "../../interfaces/ISportPositionalMarketManager.sol";
import "../../interfaces/IGamesPlayerProps.sol";

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
    IGamesOddsObtainer public obtainer;
    ISportPositionalMarketManager public sportsManager;
    mapping(address => bool) public whitelistedAddresses;

    uint public minOddsForCheckingThresholdDefault;
    mapping(uint => uint) public minOddsForCheckingThresholdPerSport;

    IGamesPlayerProps public playerProps;
    uint256[] public defaultPlayerPropsBookmakerIds;
    mapping(uint256 => uint256[]) public sportIdForPlayerPropsToBookmakerIds;

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
    function areTeamsEqual(string memory _teamA, string memory _teamB) external pure returns (bool) {
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
        uint minOdds = minOddsForCheckingThresholdPerSport[_sportId] == 0
            ? minOddsForCheckingThresholdDefault
            : minOddsForCheckingThresholdPerSport[_sportId];

        // Check if both _currentOdds and _newOdds are below X% (example 10%) if minOdds is set
        if (minOdds > 0 && _currentOdds < minOdds * ONE_PERCENT && _newOdds < minOdds * ONE_PERCENT) {
            return true;
        }

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

    function areSpreadOddsValid(
        int16 spreadHome,
        int24 spreadHomeOdds,
        int16 spreadAway,
        int24 spreadAwayOdds
    ) external view returns (bool) {
        return
            spreadHome == spreadAway * -1 &&
            spreadHome != 0 &&
            spreadAway != 0 &&
            spreadHomeOdds != 0 &&
            spreadAwayOdds != 0;
    }

    function areTotalOddsValid(
        uint24 totalOver,
        int24 totalOverOdds,
        uint24 totalUnder,
        int24 totalUnderOdds
    ) external pure returns (bool) {
        return totalOver == totalUnder && totalOver > 0 && totalUnder > 0 && totalOverOdds != 0 && totalUnderOdds != 0;
    }

    function areOddsAndLinesValidForPlayer(
        uint16 _line,
        int24 _overOdds,
        int24 _underOdds
    ) external pure returns (bool) {
        return _line > 0 && _overOdds != 0 && _underOdds != 0;
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
    ) external pure returns (bool) {
        return _isValidOutcomeWithResult(_outcome, _homeScore, _awayScore);
    }

    /// @notice calculate normalized odds based on american odds
    /// @param _americanOdds american odds in array of 3 [home,away,draw]
    /// @return uint[] array of normalized odds
    function calculateAndNormalizeOdds(int[] memory _americanOdds) external pure returns (uint[] memory) {
        return _calculateAndNormalizeOdds(_americanOdds);
    }

    /// @notice view function which returns odds in a batch of games
    /// @param _gameIds game ids for which games is looking
    /// @return odds odds array
    function getOddsForGames(bytes32[] memory _gameIds) public view returns (int24[] memory odds) {
        odds = new int24[](3 * _gameIds.length);
        for (uint i = 0; i < _gameIds.length; i++) {
            (int24 home, int24 away, int24 draw, , , , ) = obtainer.getOddsForGame(_gameIds[i]);
            odds[i * 3 + 0] = home; // 0 3 6 ...
            odds[i * 3 + 1] = away; // 1 4 7 ...
            odds[i * 3 + 2] = draw; // 2 5 8 ...
        }
    }

    /// @notice view function which returns all spread and total properties
    /// @param _gameIds game ids for which games is looking
    function getAllPropertiesForGivenGames(bytes32[] memory _gameIds)
        external
        view
        returns (
            int24[] memory oddsMain,
            int16[] memory linesSpread,
            uint24[] memory linesTotal,
            int24[] memory oddsSpreadTotals
        )
    {
        return (
            getOddsForGames(_gameIds),
            getSpreadLinesForGames(_gameIds),
            getTotalLinesForGames(_gameIds),
            getSpreadTotalsOddsForGames(_gameIds)
        );
    }

    /// @notice view function which returns odds in a batch of games
    /// @param _gameIds game ids for which games is looking
    /// @return lines odds array
    function getSpreadLinesForGames(bytes32[] memory _gameIds) public view returns (int16[] memory lines) {
        lines = new int16[](2 * _gameIds.length);
        for (uint i = 0; i < _gameIds.length; i++) {
            (int16 spreadHome, int16 spreadAway, , ) = obtainer.getLinesForGame(_gameIds[i]);
            lines[i * 2 + 0] = spreadHome; // 0 2 4 ...
            lines[i * 2 + 1] = spreadAway; // 1 3 5 ...
        }
    }

    /// @notice view function which returns odds in a batch of games
    /// @param _gameIds game ids for which games is looking
    /// @return lines odds array
    function getTotalLinesForGames(bytes32[] memory _gameIds) public view returns (uint24[] memory lines) {
        lines = new uint24[](2 * _gameIds.length);
        for (uint i = 0; i < _gameIds.length; i++) {
            (, , uint24 totalOver, uint24 totalUnder) = obtainer.getLinesForGame(_gameIds[i]);
            lines[i * 2 + 0] = totalOver; // 0 2 4 ...
            lines[i * 2 + 1] = totalUnder; // 1 3 5 ...
        }
    }

    /// @notice view function which returns odds and lnes for player props
    /// @param _gameIds game ids for which games is looking
    /// @param _playerIds player ids
    /// @param _optionIds option ids such as points etc
    /// @return odds odds array
    /// @return lines line array
    function getPlayerPropForOption(
        bytes32[] memory _gameIds,
        bytes32[] memory _playerIds,
        uint8[] memory _optionIds
    ) public view returns (int24[] memory odds, uint16[] memory lines) {
        odds = new int24[](2 * _gameIds.length);
        lines = new uint16[](_gameIds.length);
        for (uint i = 0; i < _gameIds.length; i++) {
            (uint16 line, int24 overOdds, int24 underOdds) = playerProps.getPlayerPropForOption(
                _gameIds[i],
                _playerIds[i],
                _optionIds[i]
            );
            lines[i] = line;
            odds[i * 2 + 0] = overOdds; // 0 2 4 ...
            odds[i * 2 + 1] = underOdds; // 1 3 5 ...
        }
    }

    /// @notice view function which returns odds in a batch of games
    /// @param _gameIds game ids for which games is looking
    /// @return odds odds array
    function getSpreadTotalsOddsForGames(bytes32[] memory _gameIds) public view returns (int24[] memory odds) {
        odds = new int24[](4 * _gameIds.length);
        for (uint i = 0; i < _gameIds.length; i++) {
            (, , , int24 spreadHomeOdds, int24 spreadAwayOdds, int24 totalOverOdds, int24 totalUnderOdds) = obtainer
                .getOddsForGame(_gameIds[i]);
            odds[i * 4 + 0] = spreadHomeOdds; // 0 4 8 ...
            odds[i * 4 + 1] = spreadAwayOdds; // 1 5 9 ...
            odds[i * 4 + 2] = totalOverOdds; // 2 6 10 ...
            odds[i * 4 + 3] = totalUnderOdds; // 2 7 11 ...
        }
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
    ) internal pure returns (bool) {
        if (_isTwoPositionalSport) {
            return _awayOdds != 0 && _homeOdds != 0;
        } else {
            return _awayOdds != 0 && _homeOdds != 0 && _drawOdds != 0;
        }
    }

    function _isValidOutcomeForGame(bool _isTwoPositionalSport, uint _outcome) internal pure returns (bool) {
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

    /// @notice view function which returns all props needed for game
    /// @param _sportId sportid
    /// @param _date date for sport
    /// @return _isSportOnADate have sport on date true/false
    /// @return _twoPositional is two positional sport true/false
    /// @return _gameIds game Ids for that date/sport
    function getSportProperties(uint _sportId, uint _date)
        external
        view
        returns (
            bool _isSportOnADate,
            bool _twoPositional,
            bytes32[] memory _gameIds
        )
    {
        return (
            consumer.isSportOnADate(_date, _sportId),
            consumer.isSportTwoPositionsSport(_sportId),
            consumer.getGamesPerDatePerSport(_sportId, _date)
        );
    }

    /// @notice view function which returns all props needed for game
    /// @param _gameIds game id on contract
    /// @return _market address
    /// @return _marketResolved resolved true/false
    /// @return _marketCanceled canceled true/false
    /// @return _invalidOdds invalid odds true/false
    /// @return _isPausedByCanceledStatus is game paused by cancel status true/false
    /// @return _isMarketPaused is market paused
    function getGameProperties(bytes32 _gameIds)
        external
        view
        returns (
            address _market,
            bool _marketResolved,
            bool _marketCanceled,
            bool _invalidOdds,
            bool _isPausedByCanceledStatus,
            bool _isMarketPaused
        )
    {
        address marketAddress = consumer.marketPerGameId(_gameIds);
        return (
            marketAddress,
            consumer.marketResolved(marketAddress),
            consumer.marketCanceled(marketAddress),
            obtainer.invalidOdds(marketAddress),
            consumer.isPausedByCanceledStatus(marketAddress),
            marketAddress != address(0) ? sportsManager.isMarketPaused(marketAddress) : false
        );
    }

    function getAllGameProperties(bytes32[] memory _gameIds)
        external
        view
        returns (
            address[] memory _markets,
            bool[] memory _marketResolved,
            bool[] memory _marketCanceled,
            bool[] memory _invalidOdds,
            bool[] memory _isPausedByCanceledStatus,
            bool[] memory _isMarketPaused,
            uint[] memory _startTime
        )
    {
        uint256 arrayLength = _gameIds.length;
        _markets = new address[](arrayLength);
        _marketResolved = new bool[](arrayLength);
        _marketCanceled = new bool[](arrayLength);
        _invalidOdds = new bool[](arrayLength);
        _isPausedByCanceledStatus = new bool[](arrayLength);
        _isMarketPaused = new bool[](arrayLength);
        _startTime = new uint[](arrayLength);

        for (uint256 i = 0; i < arrayLength; i++) {
            address marketAddress = consumer.marketPerGameId(_gameIds[i]);
            _markets[i] = marketAddress;
            _marketResolved[i] = consumer.marketResolved(marketAddress);
            _marketCanceled[i] = consumer.marketCanceled(marketAddress);
            _invalidOdds[i] = obtainer.invalidOdds(marketAddress);
            _isPausedByCanceledStatus[i] = consumer.isPausedByCanceledStatus(marketAddress);
            _isMarketPaused[i] = marketAddress != address(0) ? sportsManager.isMarketPaused(marketAddress) : false;
            _startTime[i] = consumer.getGameStartTime(_gameIds[i]);
        }

        return (
            _markets,
            _marketResolved,
            _marketCanceled,
            _invalidOdds,
            _isPausedByCanceledStatus,
            _isMarketPaused,
            _startTime
        );
    }

    function areInvalidOdds(bytes32 _gameIds) external view returns (bool _invalidOdds) {
        return obtainer.invalidOdds(consumer.marketPerGameId(_gameIds));
    }

    /// @notice getting bookmaker by sports id
    /// @param _sportId id of a sport for fetching
    function getBookmakerIdsBySportId(uint256 _sportId) external view returns (uint256[] memory) {
        return sportIdToBookmakerIds[_sportId].length > 0 ? sportIdToBookmakerIds[_sportId] : defaultBookmakerIds;
    }

    /// @notice getting bookmaker by sports id for playerProps
    /// @param _sportId id of a sport for fetching
    function getBookmakerIdsBySportIdForPlayerProps(uint256 _sportId) external view returns (uint256[] memory) {
        return
            sportIdForPlayerPropsToBookmakerIds[_sportId].length > 0
                ? sportIdForPlayerPropsToBookmakerIds[_sportId]
                : defaultPlayerPropsBookmakerIds;
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

    /// @notice sets manager address
    /// @param _manager address
    function setSportsManager(address _manager) external onlyOwner {
        require(_manager != address(0), "Invalid address");
        sportsManager = ISportPositionalMarketManager(_manager);
        emit NewSportsManagerAddress(_manager);
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
        require(consumer.supportedSport(_sportId), "SportId is not supported");
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
    function setBookmakerIdsBySportId(uint256 _sportId, uint256[] memory _bookmakerIds) external {
        require(
            msg.sender == owner || whitelistedAddresses[msg.sender],
            "Only owner or whitelisted address may perform this action"
        );
        require(consumer.supportedSport(_sportId), "SportId is not supported");
        sportIdToBookmakerIds[_sportId] = _bookmakerIds;
        emit NewBookmakerIdsBySportId(_sportId, _bookmakerIds);
    }

    /// @notice setting default bookmakers for player props
    /// @param _defaultPlayerPropsBookmakerIds array of bookmaker ids
    function setDefaultBookmakerIdsForPlayerProps(uint256[] memory _defaultPlayerPropsBookmakerIds) external onlyOwner {
        defaultPlayerPropsBookmakerIds = _defaultPlayerPropsBookmakerIds;
        emit NewDefaultBookmakerIdsForPlayerProps(_defaultPlayerPropsBookmakerIds);
    }

    /// @notice setting bookmaker by sports id for playerProps
    /// @param _sportId id of a sport
    /// @param _bookmakerIds array of bookmakers
    function setBookmakerIdsBySportIdForPlayerProps(uint256 _sportId, uint256[] memory _bookmakerIds) external {
        require(msg.sender == owner || whitelistedAddresses[msg.sender], "Only owner or whitelisted address");
        require(
            consumer.supportedSport(_sportId) && playerProps.doesSportSupportPlayerProps(_sportId),
            "SportId is not supported"
        );
        sportIdForPlayerPropsToBookmakerIds[_sportId] = _bookmakerIds;
        emit NewBookmakerIdsBySportIdForPlayerProps(_sportId, _bookmakerIds);
    }

    /// @notice sets the PlayerProps contract address, which only owner can execute
    /// @param _playerProps address of a player props contract
    function setPlayerPropsAddress(address _playerProps) external onlyOwner {
        require(_playerProps != address(0), "Invalid address");
        playerProps = IGamesPlayerProps(_playerProps);
        emit NewPlayerPropsAddress(_playerProps);
    }

    /// @notice sets obtainer
    /// @param _obtainer obtainer address
    function setObtainer(address _obtainer) external onlyOwner {
        obtainer = IGamesOddsObtainer(_obtainer);
        emit NewObtainerAddress(_obtainer);
    }

    /// @notice setWhitelistedAddresses enables whitelist addresses of given array
    /// @param _whitelistedAddresses array of whitelisted addresses
    /// @param _flag adding or removing from whitelist (true: add, false: remove)
    function setWhitelistedAddresses(address[] calldata _whitelistedAddresses, bool _flag) external onlyOwner {
        require(_whitelistedAddresses.length > 0, "Whitelisted addresses cannot be empty");
        for (uint256 index = 0; index < _whitelistedAddresses.length; index++) {
            // only if current flag is different, if same skip it
            if (whitelistedAddresses[_whitelistedAddresses[index]] != _flag) {
                whitelistedAddresses[_whitelistedAddresses[index]] = _flag;
                emit AddedIntoWhitelist(_whitelistedAddresses[index], _flag);
            }
        }
    }

    /// @notice setting min percentage for checking threshold
    /// @param _minOddsForCheckingThresholdDefault min percentage which threshold for odds are checked
    function setMinOddsForCheckingThresholdDefault(uint _minOddsForCheckingThresholdDefault) external onlyOwner {
        minOddsForCheckingThresholdDefault = _minOddsForCheckingThresholdDefault;
        emit NewMinOddsForCheckingThresholdDefault(_minOddsForCheckingThresholdDefault);
    }

    /// @notice setting custom min odds checking for threshold
    /// @param _sportId sport id
    /// @param _minOddsForCheckingThresholdPerSport custom custom min odds checking for threshold
    function setMinOddsForCheckingThresholdPerSport(uint _sportId, uint _minOddsForCheckingThresholdPerSport)
        external
        onlyOwner
    {
        minOddsForCheckingThresholdPerSport[_sportId] = _minOddsForCheckingThresholdPerSport;
        emit NewMinOddsForCheckingThresholdPerSport(_sportId, _minOddsForCheckingThresholdPerSport);
    }

    /* ========== EVENTS ========== */
    event NewConsumerAddress(address _consumer);
    event SetInvalidName(bytes32 _invalidName, bool _isInvalid);
    event SetSupportedMarketType(bytes32 _supportedMarketType, bool _isSupported);
    event NewDefaultOddsThreshold(uint _defaultOddsThreshold);
    event NewCustomOddsThresholdForSport(uint _sportId, uint _oddsThresholdForSport);
    event NewBookmakerIdsBySportId(uint256 _sportId, uint256[] _ids);
    event NewDefaultBookmakerIds(uint256[] _ids);
    event NewObtainerAddress(address _obtainer);
    event NewSportsManagerAddress(address _manager);
    event AddedIntoWhitelist(address _whitelistAddress, bool _flag);
    event NewMinOddsForCheckingThresholdDefault(uint _minOddsChecking);
    event NewMinOddsForCheckingThresholdPerSport(uint256 _sportId, uint _minOddsChecking);
    event NewBookmakerIdsBySportIdForPlayerProps(uint256 _sportId, uint256[] _ids);
    event NewDefaultBookmakerIdsForPlayerProps(uint256[] _ids);
    event NewPlayerPropsAddress(address _playerProps);
}

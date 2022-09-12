// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

// interface
import "../../interfaces/ISportPositionalMarketManager.sol";

/// @title Consumer contract which stores all data from CL data feed (Link to docs:https://market.link/nodes/Apex146/integrations), also creates all sports markets based on that data
/// @author vladan
contract ApexConsumer is Initializable, ProxyOwned, ProxyPausable {
    /* ========== CONSTANTS =========== */

    uint public constant CANCELLED = 0;
    uint public constant HOME_WIN = 1;
    uint public constant AWAY_WIN = 2;

    uint public constant STATUS_CANCELLED = 0;
    uint public constant STATUS_RESOLVED = 1;

    uint public constant NUMBER_OF_POSITIONS = 2;
    uint public constant MIN_TAG_NUMBER = 9100;

    /* ========== CONSUMER STATE VARIABLES ========== */

    struct RaceCreate {
        string raceId;
        uint256 qualifyingStartTime;
        uint256 startTime;
        string eventId;
        string eventName;
        string betType;
    }

    struct GameCreate {
        bytes32 gameId;
        uint256 startTime;
        uint256 homeOdds;
        uint256 awayOdds;
        uint256 drawOdds;
        string homeTeam;
        string awayTeam;
    }

    struct GameResolve {
        bytes32 gameId;
        uint8 homeScore;
        uint8 awayScore;
        uint8 statusId;
    }

    struct GameResults {
        bytes32 gameId;
        string result;
        string resultDetails;
    }

    struct GameOdds {
        bytes32 gameId;
        uint256 homeOdds;
        uint256 awayOdds;
        uint256 drawOdds;
    }

    /* ========== STATE VARIABLES ========== */

    // global params
    address public wrapperAddress;
    mapping(address => bool) public whitelistedAddresses;

    // Maps <GameId, Game>
    mapping(string => RaceCreate) public raceCreated;
    mapping(bytes32 => GameCreate) public gameCreated;
    mapping(bytes32 => GameResolve) public gameResolved;
    mapping(bytes32 => GameResults) public gameResults;
    mapping(bytes32 => GameOdds) public gameOdds;
    mapping(bytes32 => uint) public sportsIdPerGame;
    mapping(string => bool) public raceFulfilledCreated;
    mapping(bytes32 => bool) public gameFulfilledCreated;
    mapping(bytes32 => bool) public gameFulfilledResolved;

    // sports props
    mapping(string => bool) public supportedSport;
    mapping(string => uint) public supportedSportId;

    // market props
    ISportPositionalMarketManager public sportsManager;
    mapping(bytes32 => address) public marketPerGameId;
    mapping(address => bytes32) public gameIdPerMarket;
    mapping(address => bool) public marketCreated;
    mapping(address => bool) public marketResolved;
    mapping(address => bool) public marketCanceled;

    // game
    mapping(address => bool) public invalidOdds;
    mapping(address => bool) public isPausedByCanceledStatus;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        string[] memory _supportedSports,
        address _sportsManager
    ) external initializer {
        setOwner(_owner);
        sportsManager = ISportPositionalMarketManager(_sportsManager);
        whitelistedAddresses[_owner] = true;
        for (uint i; i < _supportedSports.length; i++) {
            supportedSport[_supportedSports[i]] = true;
            supportedSportId[_supportedSports[i]] = i;
        }
    }

    /* ========== CONSUMER FULFILL FUNCTIONS ========== */

    /// @notice Fulfill all race metadata necessary to create sport markets
    /// @param _requestId unique request ID form CL
    /// @param _eventId event ID which is provided from CL
    /// @param _betType bet type for provided event ID
    /// @param _eventName event name which is provided from CL
    /// @param _qualifyingStartTime timestamp on which race qualifying is started
    /// @param _raceStartTime timestamp on which race is started
    /// @param _sport supported sport name which is provided from CL
    function fulfillMetaData(
        bytes32 _requestId,
        string memory _eventId,
        string memory _betType,
        string memory _eventName,
        uint256 _qualifyingStartTime,
        uint256 _raceStartTime,
        string memory _sport
    ) external onlyWrapper {
        //if (_qualifying_start_time > block.timestamp) {
        RaceCreate memory race;

        race.raceId = _eventId;
        race.eventId = _eventId;
        race.eventName = _eventName;
        race.betType = _betType;
        race.qualifyingStartTime = _qualifyingStartTime;
        race.startTime = _raceStartTime;

        _createRaceFulfill(_requestId, race, supportedSportId[_sport]);
        //}
    }

    /// @notice Fulfill all matchup data necessary to create sport markets
    /// @param _requestId unique request ID form CL
    /// @param _betTypeDetail1 Team/Category/Rider A identifier, returned as string
    /// @param _betTypeDetail2 Team/Category/Rider B identifier, returned as string
    /// @param _probA: Probability for Team/Category/Rider A, returned as uint256
    /// @param _probB: Probability for Team/Category/Rider B, returned as uint256
    /// @param _gameId unique game identifier
    /// @param _sport supported sport name which is provided from CL
    function fulfillMatchup(
        bytes32 _requestId,
        string memory _betTypeDetail1,
        string memory _betTypeDetail2,
        uint256 _probA,
        uint256 _probB,
        bytes32 _gameId,
        string memory _sport,
        string memory _eventId
    ) external onlyWrapper {
        if (!gameFulfilledCreated[_gameId] && raceFulfilledCreated[_eventId]) {
            RaceCreate memory race = raceCreated[_eventId];

            //if (race.qualifyingStartTime > block.timestamp) {
            GameCreate memory game;

            game.gameId = _gameId;
            game.homeOdds = _probA;
            game.awayOdds = _probB;
            game.homeTeam = _betTypeDetail1;
            game.awayTeam = _betTypeDetail2;
            game.startTime = race.qualifyingStartTime;

            _createGameFulfill(_requestId, game, supportedSportId[_sport]);
            //}
        }

        GameOdds memory newGameOdds;
        newGameOdds.gameId = _gameId;
        newGameOdds.homeOdds = _probA;
        newGameOdds.awayOdds = _probB;

        _oddsGameFulfill(_requestId, newGameOdds);
    }

    /// @notice Fulfill all data necessary to resolve sport markets
    /// @param _requestId unique request ID form CL
    /// @param _result win/loss for the matchup
    /// @param _resultDetails ranking/timing data to elaborate on win/loss
    /// @param _gameId unique game identifier
    /// @param _sport supported sport name which is provided from CL
    function fulfillResults(
        bytes32 _requestId,
        string memory _result,
        string memory _resultDetails,
        bytes32 _gameId,
        string memory _sport
    ) external onlyWrapper {
        GameResolve memory game;
        if (keccak256(abi.encodePacked(_result)) == keccak256(abi.encodePacked("win/lose"))) {
            game.gameId = _gameId;
            game.homeScore = 1;
            game.awayScore = 0;
            game.statusId = uint8(STATUS_RESOLVED);
            _resolveGameFulfill(_requestId, game, supportedSportId[_sport]);
        } else if (keccak256(abi.encodePacked(_result)) == keccak256(abi.encodePacked("lose/win"))) {
            game.gameId = _gameId;
            game.homeScore = 0;
            game.awayScore = 1;
            game.statusId = uint8(STATUS_RESOLVED);
            _resolveGameFulfill(_requestId, game, supportedSportId[_sport]);
        } else if (keccak256(abi.encodePacked(_result)) == keccak256(abi.encodePacked("null"))) {
            game.gameId = _gameId;
            game.homeScore = 0;
            game.awayScore = 0;
            game.statusId = uint8(STATUS_CANCELLED);
            _resolveGameFulfill(_requestId, game, supportedSportId[_sport]);
        }

        GameResults memory newGameResults;
        newGameResults.gameId = _gameId;
        newGameResults.result = _result;
        newGameResults.resultDetails = _resultDetails;

        _gameResultsFulfill(_requestId, newGameResults, supportedSportId[_sport]);
    }

    /// @notice Creates market for a given game ID
    /// @param _gameId unique game identifier
    function createMarketForGame(bytes32 _gameId) public {
        require(marketPerGameId[_gameId] == address(0), "Market for game already exists");
        require(gameFulfilledCreated[_gameId], "No such game fulfilled, created");
        _createMarket(_gameId);
    }

    /// @notice Resolve market for a given game ID
    /// @param _gameId unique game identifier
    function resolveMarketForGame(bytes32 _gameId) public {
        require(!isGameResolvedOrCanceled(_gameId), "Market resoved or canceled");
        require(gameFulfilledResolved[_gameId], "No such game fulfilled, resolved");
        _resolveMarket(_gameId);
    }

    /// @notice Resolve market for a given game ID
    /// @param _gameId unique game identifier
    /// @param _outcome outcome of the game (1: home win, 2: away win, 0: cancel market)
    /// @param _homeScore score of home team
    /// @param _awayScore score of away team
    function resolveGameManually(
        bytes32 _gameId,
        uint _outcome,
        uint8 _homeScore,
        uint8 _awayScore
    ) external isAddressWhitelisted canGameBeResolved(_gameId, _outcome, _homeScore, _awayScore) {
        _resolveMarketManually(marketPerGameId[_gameId], _outcome, _homeScore, _awayScore);
    }

    /// @notice Resolve market for a given market address
    /// @param _market market address
    /// @param _outcome outcome of a game (1: home win, 2: away win, 0: cancel market)
    /// @param _homeScore score of home team
    /// @param _awayScore score of away team
    function resolveMarketManually(
        address _market,
        uint _outcome,
        uint8 _homeScore,
        uint8 _awayScore
    ) external isAddressWhitelisted canGameBeResolved(gameIdPerMarket[_market], _outcome, _homeScore, _awayScore) {
        _resolveMarketManually(_market, _outcome, _homeScore, _awayScore);
    }

    /// @notice Cancel market for a given market address
    /// @param _market market address
    function cancelMarketManually(address _market)
        external
        isAddressWhitelisted
        canGameBeCanceled(gameIdPerMarket[_market])
    {
        _cancelMarketManually(_market);
    }

    /* ========== VIEW FUNCTIONS ========== */

    /// @notice View function which returns odds
    /// @param _gameId unique game identifier
    /// @return homeOdds moneyline odd in a two decimal places
    /// @return awayOdds moneyline odd in a two decimal places
    /// @return drawOdds moneyline odd in a two decimal places
    function getOddsForGame(bytes32 _gameId)
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        return (gameOdds[_gameId].homeOdds, gameOdds[_gameId].awayOdds, gameOdds[_gameId].drawOdds);
    }

    /// @notice View function which returns game created object based on ID of a game
    /// @param _gameId unique game identifier
    /// @return GameCreate game create object
    function getGameCreatedById(bytes32 _gameId) public view returns (GameCreate memory) {
        return gameCreated[_gameId];
    }

    /// @notice View function which returns game resolved object based on ID of a game
    /// @param _gameId unique game identifier
    /// @return GameResolve game resolve object
    function getGameResolvedById(bytes32 _gameId) public view returns (GameResolve memory) {
        return gameResolved[_gameId];
    }

    /// @notice View function which returns if game is resolved or canceled and ready for market to be resolved or canceled
    /// @param _gameId unique game identifier for which game is looking
    /// @return bool is it ready for resolve or cancel true/false
    function isGameResolvedOrCanceled(bytes32 _gameId) public view returns (bool) {
        return marketResolved[marketPerGameId[_gameId]] || marketCanceled[marketPerGameId[_gameId]];
    }

    /// @notice View function which returns if sport is supported or not
    /// @param _sport sport for which is looking
    /// @return bool is sport supported true/false
    function isSupportedSport(string memory _sport) external view returns (bool) {
        return supportedSport[_sport];
    }

    /// @notice View function which returns normalized odds up to 100 (Example: 50-40-10)
    /// @param _gameId unique game identifier for which game is looking
    /// @return uint[] odds array normalized
    function getNormalizedOdds(bytes32 _gameId) public view returns (uint[] memory) {
        uint[] memory normalizedOdds = new uint[](3);
        normalizedOdds[0] = gameOdds[_gameId].homeOdds;
        normalizedOdds[1] = gameOdds[_gameId].awayOdds;
        normalizedOdds[2] = gameOdds[_gameId].drawOdds;

        for (uint i = 0; i < normalizedOdds.length; i++) {
            normalizedOdds[i] = (1e18 * normalizedOdds[i]) / 1e4;
        }
        return normalizedOdds;
    }

    /// @notice Vew function which returns if game is resolved
    /// @param _gameId unique game identifier for which game is looking
    /// @return bool is game resolved true/false
    function isGameInResolvedStatus(bytes32 _gameId) public view returns (bool) {
        return _isGameStatusResolved(getGameResolvedById(_gameId));
    }

    /// @notice View function which returns outcome of a game based on ID
    /// @param _gameId unique game identifier for which result is looking
    /// @return _result returns 1: home win, 2: away win
    function getResult(bytes32 _gameId) external view returns (uint _result) {
        if (isGameInResolvedStatus(_gameId)) {
            return _calculateOutcome(getGameResolvedById(_gameId));
        }
    }

    /// @notice View function which returns if game is provided by Apex
    /// @param _gameId unique game identifier for which result is looking
    /// @return bool is game provided by Apex
    function isApexGame(bytes32 _gameId) public view returns (bool) {
        return gameFulfilledCreated[_gameId];
    }

    /* ========== INTERNALS ========== */

    function _createRaceFulfill(
        bytes32 _requestId,
        RaceCreate memory _race,
        uint _sportId
    ) internal {
        raceCreated[_race.raceId] = _race;
        raceFulfilledCreated[_race.raceId] = true;

        emit RaceCreated(_requestId, _sportId, _race.raceId, _race);
    }

    function _createGameFulfill(
        bytes32 _requestId,
        GameCreate memory _game,
        uint _sportId
    ) internal {
        gameCreated[_game.gameId] = _game;
        sportsIdPerGame[_game.gameId] = _sportId;
        gameFulfilledCreated[_game.gameId] = true;
        gameOdds[_game.gameId] = GameOdds(_game.gameId, _game.homeOdds, _game.awayOdds, _game.drawOdds);

        emit GameCreated(_requestId, _sportId, _game.gameId, _game, getNormalizedOdds(_game.gameId));
    }

    function _resolveGameFulfill(
        bytes32 _requestId,
        GameResolve memory _game,
        uint _sportId
    ) internal {
        GameCreate memory singleGameCreated = getGameCreatedById(_game.gameId);

        // if status is resolved OR (status is canceled AND start time has passed fulfill game to be resolved)
        if (
            _isGameStatusResolved(_game) || (_isGameStatusCancelled(_game) && singleGameCreated.startTime < block.timestamp)
        ) {
            gameResolved[_game.gameId] = _game;
            gameFulfilledResolved[_game.gameId] = true;

            emit GameResolved(_requestId, _sportId, _game.gameId, _game);
        }
        // if market for the game exists AND status is canceled AND start time has not passed only pause market
        else if (
            marketPerGameId[_game.gameId] != address(0) &&
            _isGameStatusCancelled(_game) &&
            singleGameCreated.startTime >= block.timestamp
        ) {
            isPausedByCanceledStatus[marketPerGameId[_game.gameId]] = true;
            _pauseOrUnpauseMarket(marketPerGameId[_game.gameId], true);
        }
    }

    function _gameResultsFulfill(
        bytes32 _requestId,
        GameResults memory _game,
        uint _sportId
    ) internal {
        gameResults[_game.gameId] = _game;

        emit GameResultsSet(_requestId, _sportId, _game.gameId, _game);
    }

    function _oddsGameFulfill(bytes32 requestId, GameOdds memory _game) internal {
        // if odds are valid store them if not pause market
        if (_areOddsValid(_game)) {
            gameOdds[_game.gameId] = _game;

            // if market created and was paused (paused by invalid odds or paused by canceled status) unpause
            if (marketPerGameId[_game.gameId] != address(0) && sportsManager.isMarketPaused(marketPerGameId[_game.gameId])) {
                if (invalidOdds[marketPerGameId[_game.gameId]] || isPausedByCanceledStatus[marketPerGameId[_game.gameId]]) {
                    invalidOdds[marketPerGameId[_game.gameId]] = false;
                    isPausedByCanceledStatus[marketPerGameId[_game.gameId]] = false;
                    _pauseOrUnpauseMarket(marketPerGameId[_game.gameId], false);
                }
            }

            emit GameOddsAdded(requestId, _game.gameId, _game, getNormalizedOdds(_game.gameId));
        } else {
            if (
                marketPerGameId[_game.gameId] != address(0) && !sportsManager.isMarketPaused(marketPerGameId[_game.gameId])
            ) {
                invalidOdds[marketPerGameId[_game.gameId]] = true;
                _pauseOrUnpauseMarket(marketPerGameId[_game.gameId], true);
            }

            emit InvalidOddsForMarket(requestId, marketPerGameId[_game.gameId], _game.gameId, _game);
        }
    }

    function _createMarket(bytes32 _gameId) internal {
        GameCreate memory game = getGameCreatedById(_gameId);
        uint sportId = sportsIdPerGame[_gameId];
        uint[] memory tags = _calculateTags(sportId);

        // create
        sportsManager.createMarket(
            _gameId,
            _append(game.homeTeam, game.awayTeam), // gameLabel
            block.timestamp + 600,
            //game.startTime, //maturity
            0, //initialMint
            NUMBER_OF_POSITIONS,
            tags //tags
        );

        address marketAddress = sportsManager.getActiveMarketAddress(sportsManager.numActiveMarkets() - 1);
        marketPerGameId[game.gameId] = marketAddress;
        gameIdPerMarket[marketAddress] = game.gameId;
        marketCreated[marketAddress] = true;

        emit CreateSportsMarket(marketAddress, game.gameId, game, tags, getNormalizedOdds(game.gameId));
    }

    function _resolveMarket(bytes32 _gameId) internal {
        GameResolve memory game = getGameResolvedById(_gameId);
        GameCreate memory singleGameCreated = getGameCreatedById(_gameId);

        if (_isGameStatusResolved(game)) {
            if (invalidOdds[marketPerGameId[game.gameId]]) {
                _pauseOrUnpauseMarket(marketPerGameId[game.gameId], false);
            }

            uint _outcome = _calculateOutcome(game);

            sportsManager.resolveMarket(marketPerGameId[game.gameId], _outcome);
            marketResolved[marketPerGameId[game.gameId]] = true;

            emit ResolveSportsMarket(marketPerGameId[game.gameId], game.gameId, _outcome);
            // if status is canceled and start time of a game passed cancel market
        } else if (_isGameStatusResolved(game) && singleGameCreated.startTime < block.timestamp) {
            _cancelMarket(game.gameId);
        }
    }

    function _resolveMarketManually(
        address _market,
        uint _outcome,
        uint8 _homeScore,
        uint8 _awayScore
    ) internal {
        _pauseOrUnpauseMarket(_market, false);
        sportsManager.resolveMarket(_market, _outcome);
        marketResolved[_market] = true;
        gameResolved[gameIdPerMarket[_market]] = GameResolve(
            gameIdPerMarket[_market],
            _homeScore,
            _awayScore,
            uint8(STATUS_RESOLVED)
        );

        emit GameResolved(
            gameIdPerMarket[_market],
            sportsIdPerGame[gameIdPerMarket[_market]],
            gameIdPerMarket[_market],
            gameResolved[gameIdPerMarket[_market]]
        );
        emit ResolveSportsMarket(_market, gameIdPerMarket[_market], _outcome);
    }

    function _cancelMarketManually(address _market) internal {
        _pauseOrUnpauseMarket(_market, false);
        sportsManager.resolveMarket(_market, 0);
        marketCanceled[_market] = true;

        emit CancelSportsMarket(_market, gameIdPerMarket[_market]);
    }

    function _pauseOrUnpauseMarket(address _market, bool _pause) internal {
        if (sportsManager.isMarketPaused(_market) != _pause) {
            sportsManager.setMarketPaused(_market, _pause);
            emit PauseSportsMarket(_market, _pause);
        }
    }

    function _cancelMarket(bytes32 _gameId) internal {
        sportsManager.resolveMarket(marketPerGameId[_gameId], 0);
        marketCanceled[marketPerGameId[_gameId]] = true;

        emit CancelSportsMarket(marketPerGameId[_gameId], _gameId);
    }

    function _append(string memory teamA, string memory teamB) internal pure returns (string memory) {
        return string(abi.encodePacked(teamA, " vs ", teamB));
    }

    function _calculateTags(uint _sportsId) internal pure returns (uint[] memory) {
        uint[] memory result = new uint[](1);
        result[0] = MIN_TAG_NUMBER + _sportsId;
        return result;
    }

    function _isGameReadyToBeResolved(GameResolve memory _game) internal pure returns (bool) {
        return _isGameStatusResolved(_game) || _isGameStatusCancelled(_game);
    }

    function _isGameStatusResolved(GameResolve memory _game) internal pure returns (bool) {
        return _game.statusId == STATUS_RESOLVED;
    }

    function _isGameStatusCancelled(GameResolve memory _game) internal pure returns (bool) {
        return _game.statusId == STATUS_CANCELLED;
    }

    function _calculateOutcome(GameResolve memory _game) internal pure returns (uint) {
        return _game.homeScore > _game.awayScore ? HOME_WIN : AWAY_WIN;
    }

    function _areOddsValid(GameOdds memory _game) internal pure returns (bool) {
        return _game.awayOdds != 0 && _game.homeOdds != 0;
    }

    function _isValidOutcomeForGame(uint _outcome) internal pure returns (bool) {
        return _outcome == HOME_WIN || _outcome == AWAY_WIN || _outcome == CANCELLED;
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

    /* ========== CONTRACT MANAGEMENT ========== */

    /// @notice Sets if sport is suported or not (delete from supported sport)
    /// @param sport sport which needs to be supported or not
    /// @param _isSupported true/false (supported or not)
    function setSupportedSport(string memory sport, bool _isSupported) external onlyOwner {
        require(supportedSport[sport] != _isSupported, "Already set");
        supportedSport[sport] = _isSupported;
        emit SupportedSportsChanged(sport, _isSupported);
    }

    /// @notice Sets wrapper and manager addresses
    /// @param _wrapperAddress wrapper address
    /// @param _sportsManager sport manager address
    function setSportContracts(address _wrapperAddress, address _sportsManager) external onlyOwner {
        require(_wrapperAddress != address(0) || _sportsManager != address(0), "Invalid addreses");

        sportsManager = ISportPositionalMarketManager(_sportsManager);
        wrapperAddress = _wrapperAddress;

        emit NewSportContracts(_wrapperAddress, _sportsManager);
    }

    /// @notice Adding/removing whitelist address depending on a flag
    /// @param _whitelistAddress address that needed to be whitelisted or removed from WL
    /// @param _flag adding or removing from whitelist (true: add, false: remove)
    function addToWhitelist(address _whitelistAddress, bool _flag) external onlyOwner {
        require(_whitelistAddress != address(0), "Invalid address");
        require(whitelistedAddresses[_whitelistAddress] != _flag, "Already set to that flag");
        whitelistedAddresses[_whitelistAddress] = _flag;
        emit AddedIntoWhitelist(_whitelistAddress, _flag);
    }

    /* ========== MODIFIERS ========== */

    modifier onlyWrapper() {
        require(msg.sender == wrapperAddress, "Only wrapper can call this function");
        _;
    }

    modifier isAddressWhitelisted() {
        require(whitelistedAddresses[msg.sender], "Address not supported");
        _;
    }

    modifier canGameBeCanceled(bytes32 _gameId) {
        require(!isGameResolvedOrCanceled(_gameId), "Market resoved or canceled");
        require(marketPerGameId[_gameId] != address(0), "No market created for game");
        _;
    }

    modifier canGameBeResolved(
        bytes32 _gameId,
        uint _outcome,
        uint8 _homeScore,
        uint8 _awayScore
    ) {
        require(!isGameResolvedOrCanceled(_gameId), "Market resoved or canceled");
        require(marketPerGameId[_gameId] != address(0), "No market created for game");
        require(
            _isValidOutcomeForGame(_outcome) && _isValidOutcomeWithResult(_outcome, _homeScore, _awayScore),
            "Bad result or outcome"
        );
        _;
    }

    modifier canGameBePaused(address _market, bool _pause) {
        require(_market != address(0), "No market address");
        require(gameFulfilledCreated[gameIdPerMarket[_market]], "Game not existing");
        require(gameIdPerMarket[_market] != 0, "Market not existing");
        require(!isGameResolvedOrCanceled(gameIdPerMarket[_market]), "Market resoved or canceled");
        require(sportsManager.isMarketPaused(_market) != _pause, "Already paused/unpaused");
        _;
    }

    /* ========== EVENTS ========== */

    event RaceCreated(bytes32 _requestId, uint _sportId, string _id, RaceCreate _race);
    event GameCreated(bytes32 _requestId, uint _sportId, bytes32 _id, GameCreate _game, uint[] _normalizedOdds);
    event GameResolved(bytes32 _requestId, uint _sportId, bytes32 _id, GameResolve _game);
    event GameResultsSet(bytes32 requestId, uint _sportId, bytes32 _id, GameResults _game);

    event GameOddsAdded(bytes32 _requestId, bytes32 _id, GameOdds _game, uint[] _normalizedOdds);
    event InvalidOddsForMarket(bytes32 _requestId, address _marketAddress, bytes32 _id, GameOdds _game);

    event CreateSportsMarket(address _marketAddress, bytes32 _id, GameCreate _game, uint[] _tags, uint[] _normalizedOdds);
    event ResolveSportsMarket(address _marketAddress, bytes32 _id, uint _outcome);

    event PauseSportsMarket(address _marketAddress, bool _pause);
    event CancelSportsMarket(address _marketAddress, bytes32 _id);
    event SupportedSportsChanged(string _sport, bool _isSupported);
    event NewSportContracts(address _wrapperAddress, address _sportsManager);
    event AddedIntoWhitelist(address _whitelistAddress, bool _flag);
}

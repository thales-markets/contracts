// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "./GamesQueue.sol";

// interface
import "../../interfaces/ISportPositionalMarketManager.sol";
import "../../interfaces/ITherundownConsumerVerifier.sol";
import "../../interfaces/IGamesOddsObtainer.sol";

/// @title Consumer contract which stores all data from CL data feed (Link to docs: https://market.link/nodes/TheRundown/integrations), also creates all sports markets based on that data
/// @author gruja
contract TherundownConsumer is Initializable, ProxyOwned, ProxyPausable {
    /* ========== CONSTANTS =========== */

    uint public constant CANCELLED = 0;
    uint public constant HOME_WIN = 1;
    uint public constant AWAY_WIN = 2;
    uint public constant RESULT_DRAW = 3;
    uint public constant MIN_TAG_NUMBER = 9000;

    /* ========== CONSUMER STATE VARIABLES ========== */

    struct GameCreate {
        bytes32 gameId;
        uint256 startTime;
        int24 homeOdds;
        int24 awayOdds;
        int24 drawOdds;
        string homeTeam;
        string awayTeam;
    }

    struct GameResolve {
        bytes32 gameId;
        uint8 homeScore;
        uint8 awayScore;
        uint8 statusId;
        uint40 lastUpdated;
    }

    struct GameOdds {
        bytes32 gameId;
        int24 homeOdds;
        int24 awayOdds;
        int24 drawOdds;
    }

    /* ========== STATE VARIABLES ========== */

    // global params
    address public wrapperAddress;
    mapping(address => bool) public whitelistedAddresses;

    // Maps <RequestId, Result>
    mapping(bytes32 => bytes[]) public requestIdGamesCreated;
    mapping(bytes32 => bytes[]) public requestIdGamesResolved;
    mapping(bytes32 => bytes[]) public requestIdGamesOdds;

    // Maps <GameId, Game>
    mapping(bytes32 => GameCreate) public gameCreated;
    mapping(bytes32 => GameResolve) public gameResolved;
    mapping(bytes32 => GameOdds) public gameOdds; // deprecated see GamesOddsObtainer
    mapping(bytes32 => uint) public sportsIdPerGame;
    mapping(bytes32 => bool) public gameFulfilledCreated;
    mapping(bytes32 => bool) public gameFulfilledResolved;

    // sports props
    mapping(uint => bool) public supportedSport;
    mapping(uint => bool) public twoPositionSport;
    mapping(uint => bool) public supportResolveGameStatuses;
    mapping(uint => bool) public cancelGameStatuses;

    // market props
    ISportPositionalMarketManager public sportsManager;
    mapping(bytes32 => address) public marketPerGameId;
    mapping(address => bytes32) public gameIdPerMarket;
    mapping(address => bool) public marketResolved;
    mapping(address => bool) public marketCanceled;

    // game
    GamesQueue public queues;
    mapping(bytes32 => uint) public oddsLastPulledForGame; // deprecated see GamesOddsObtainer
    mapping(uint => bytes32[]) public gamesPerDate; // deprecated use gamesPerDatePerSport
    mapping(uint => mapping(uint => bool)) public isSportOnADate;
    mapping(address => bool) public invalidOdds; // deprecated see GamesOddsObtainer
    mapping(address => bool) public marketCreated;
    mapping(uint => mapping(uint => bytes32[])) public gamesPerDatePerSport;
    mapping(address => bool) public isPausedByCanceledStatus;
    mapping(address => bool) public canMarketBeUpdated;
    mapping(bytes32 => uint) public gameOnADate;

    ITherundownConsumerVerifier public verifier;
    mapping(bytes32 => GameOdds) public backupOdds; // deprecated see GamesOddsObtainer
    IGamesOddsObtainer public oddsObtainer;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        uint[] memory _supportedSportIds,
        address _sportsManager,
        uint[] memory _twoPositionSports,
        GamesQueue _queues,
        uint[] memory _resolvedStatuses,
        uint[] memory _cancelGameStatuses
    ) external initializer {
        setOwner(_owner);

        for (uint i; i < _supportedSportIds.length; i++) {
            supportedSport[_supportedSportIds[i]] = true;
        }
        for (uint i; i < _twoPositionSports.length; i++) {
            twoPositionSport[_twoPositionSports[i]] = true;
        }
        for (uint i; i < _resolvedStatuses.length; i++) {
            supportResolveGameStatuses[_resolvedStatuses[i]] = true;
        }
        for (uint i; i < _cancelGameStatuses.length; i++) {
            cancelGameStatuses[_cancelGameStatuses[i]] = true;
        }

        sportsManager = ISportPositionalMarketManager(_sportsManager);
        queues = _queues;
        whitelistedAddresses[_owner] = true;
    }

    /* ========== CONSUMER FULFILL FUNCTIONS ========== */

    /// @notice fulfill all data necessary to create sport markets
    /// @param _requestId unique request id form CL
    /// @param _games array of a games that needed to be stored and transfered to markets
    /// @param _sportId sports id which is provided from CL (Example: NBA = 4)
    /// @param _date date on which game/games are played
    function fulfillGamesCreated(
        bytes32 _requestId,
        bytes[] memory _games,
        uint _sportId,
        uint _date
    ) external onlyWrapper {
        requestIdGamesCreated[_requestId] = _games;

        if (_games.length > 0) {
            isSportOnADate[_date][_sportId] = true;
        }

        for (uint i = 0; i < _games.length; i++) {
            GameCreate memory gameForProcessing = abi.decode(_games[i], (GameCreate));
            // new game
            if (
                !queues.existingGamesInCreatedQueue(gameForProcessing.gameId) &&
                !verifier.isInvalidNames(gameForProcessing.homeTeam, gameForProcessing.awayTeam) &&
                gameForProcessing.startTime > block.timestamp
            ) {
                _updateGameOnADate(gameForProcessing.gameId, _date, _sportId);
                _createGameFulfill(_requestId, gameForProcessing, _sportId);
            }
            // old game UFC checking fighters
            else if (queues.existingGamesInCreatedQueue(gameForProcessing.gameId)) {
                GameCreate memory currentGameValues = getGameCreatedById(gameForProcessing.gameId);

                // if name of fighter (away or home) is not the same
                if (
                    (!verifier.areTeamsEqual(gameForProcessing.homeTeam, currentGameValues.homeTeam) ||
                        !verifier.areTeamsEqual(gameForProcessing.awayTeam, currentGameValues.awayTeam)) && _sportId == 7
                ) {
                    // double-check if market exists -> cancel market -> create new for queue
                    if (marketCreated[marketPerGameId[gameForProcessing.gameId]]) {
                        _cancelMarket(gameForProcessing.gameId, 0, false);
                        _updateGameOnADate(gameForProcessing.gameId, _date, _sportId);
                        _createGameFulfill(_requestId, gameForProcessing, _sportId);
                    }
                    // checking time
                } else if (gameForProcessing.startTime != currentGameValues.startTime) {
                    _updateGameOnADate(gameForProcessing.gameId, _date, _sportId);
                    // if NEW start time is in future
                    if (gameForProcessing.startTime > block.timestamp) {
                        // this checks is for new markets
                        if (canMarketBeUpdated[marketPerGameId[gameForProcessing.gameId]]) {
                            sportsManager.updateDatesForMarket(
                                marketPerGameId[gameForProcessing.gameId],
                                gameForProcessing.startTime
                            );
                            gameCreated[gameForProcessing.gameId] = gameForProcessing;
                            queues.updateGameStartDate(gameForProcessing.gameId, gameForProcessing.startTime);
                        }
                    } else {
                        // double-check if market existst
                        if (marketCreated[marketPerGameId[gameForProcessing.gameId]]) {
                            _pauseOrUnpauseMarket(marketPerGameId[gameForProcessing.gameId], true);
                            oddsObtainer.pauseUnpauseChildMarkets(marketPerGameId[gameForProcessing.gameId], true);
                        }
                    }
                }
            }
        }
    }

    /// @notice fulfill all data necessary to resolve sport markets
    /// @param _requestId unique request id form CL
    /// @param _games array of a games that needed to be resolved
    /// @param _sportId sports id which is provided from CL (Example: NBA = 4)
    function fulfillGamesResolved(
        bytes32 _requestId,
        bytes[] memory _games,
        uint _sportId
    ) external onlyWrapper {
        requestIdGamesResolved[_requestId] = _games;
        for (uint i = 0; i < _games.length; i++) {
            GameResolve memory game = abi.decode(_games[i], (GameResolve));
            // if game is not resolved already and there is market for that game
            if (!queues.existingGamesInResolvedQueue(game.gameId) && marketPerGameId[game.gameId] != address(0)) {
                _resolveGameFulfill(_requestId, game, _sportId);
            }
        }
    }

    /// @notice fulfill all data necessary to populate odds of a game
    /// @param _requestId unique request id form CL
    /// @param _games array of a games that needed to update the odds
    function fulfillGamesOdds(bytes32 _requestId, bytes[] memory _games) external onlyWrapper {
        requestIdGamesOdds[_requestId] = _games;
        for (uint i = 0; i < _games.length; i++) {
            IGamesOddsObtainer.GameOdds memory game = abi.decode(_games[i], (IGamesOddsObtainer.GameOdds));
            // game needs to be fulfilled and market needed to be created
            if (gameFulfilledCreated[game.gameId] && marketPerGameId[game.gameId] != address(0)) {
                oddsObtainer.obtainOdds(_requestId, game);
            }
        }
    }

    /// @notice creates market for a given game id
    /// @param _gameId game id
    function createMarketForGame(bytes32 _gameId) public {
        require(
            marketPerGameId[_gameId] == address(0) ||
                (marketCanceled[marketPerGameId[_gameId]] && marketPerGameId[_gameId] != address(0)),
            "ID1"
        );
        require(gameFulfilledCreated[_gameId], "ID2");
        require(queues.gamesCreateQueue(queues.firstCreated()) == _gameId, "ID3");
        _createMarket(_gameId);
    }

    /// @notice creates markets for a given game ids
    /// @param _gameIds game ids as array
    function createAllMarketsForGames(bytes32[] memory _gameIds) external {
        for (uint i; i < _gameIds.length; i++) {
            createMarketForGame(_gameIds[i]);
        }
    }

    /// @notice resolve market for a given game id
    /// @param _gameId game id
    function resolveMarketForGame(bytes32 _gameId) public {
        require(!isGameResolvedOrCanceled(_gameId), "ID4");
        require(gameFulfilledResolved[_gameId], "ID5");
        _resolveMarket(_gameId);
    }

    /// @notice resolve all markets for a given game ids
    /// @param _gameIds game ids as array
    function resolveAllMarketsForGames(bytes32[] memory _gameIds) external {
        for (uint i; i < _gameIds.length; i++) {
            resolveMarketForGame(_gameIds[i]);
        }
    }

    /// @notice resolve market for a given market address
    /// @param _market market address
    /// @param _outcome outcome of a game (1: home win, 2: away win, 3: draw, 0: cancel market)
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

    /// @notice cancel market for a given market address
    /// @param _market market address
    /// @param _useBackupOdds use backup odds before cancel
    function cancelMarketManually(address _market, bool _useBackupOdds)
        external
        isAddressWhitelisted
        canGameBeCanceled(gameIdPerMarket[_market])
    {
        _cancelMarketManually(_market, _useBackupOdds);
    }

    /// @notice setting isPausedByCanceledStatus from obtainer see @GamesOddsObtainer
    /// @param _market market address
    /// @param _flag flag true/false
    function setPausedByCanceledStatus(address _market, bool _flag) external onlyObtainer {
        isPausedByCanceledStatus[_market] = _flag;
    }

    /// @notice pause market from obtainer see @GamesOddsObtainer
    /// @param _market market address
    /// @param _pause flag true/false
    function pauseOrUnpauseMarket(address _market, bool _pause) external onlyObtainer {
        _pauseOrUnpauseMarket(_market, _pause);
    }

    /* ========== VIEW FUNCTIONS ========== */

    /// @notice view function which returns game created object based on id of a game
    /// @param _gameId game id
    /// @return GameCreate game create object
    function getGameCreatedById(bytes32 _gameId) public view returns (GameCreate memory) {
        return gameCreated[_gameId];
    }

    /// @notice view function which returns games on certan date and sportid
    /// @param _sportId date
    /// @param _date date
    /// @return bytes32[] list of games
    function getGamesPerDatePerSport(uint _sportId, uint _date) external view returns (bytes32[] memory) {
        return gamesPerDatePerSport[_sportId][_date];
    }

    /// @notice view function which returns props (sportid and game date)
    /// @param _market market address
    /// @return _sportId sport ids
    /// @return _gameDate game date on which game is playing
    function getGamePropsForOdds(address _market)
        external
        view
        returns (
            uint _sportId,
            uint _gameDate,
            bytes32 _id
        )
    {
        return (sportsIdPerGame[gameIdPerMarket[_market]], gameOnADate[gameIdPerMarket[_market]], gameIdPerMarket[_market]);
    }

    /// @notice view function which returns if game is resolved or canceled and ready for market to be resolved or canceled
    /// @param _gameId game id for which game is looking
    /// @return bool is it ready for resolve or cancel true/false
    function isGameResolvedOrCanceled(bytes32 _gameId) public view returns (bool) {
        return marketResolved[marketPerGameId[_gameId]] || marketCanceled[marketPerGameId[_gameId]];
    }

    /// @notice view function which returns if sport is two positional (no draw, example: NBA)
    /// @param _sportsId sport id for which is looking
    /// @return bool is sport two positional true/false
    function isSportTwoPositionsSport(uint _sportsId) public view returns (bool) {
        return twoPositionSport[_sportsId];
    }

    /// @notice view function which returns if game is resolved
    /// @param _gameId game id for which game is looking
    /// @return bool is game resolved true/false
    function isGameInResolvedStatus(bytes32 _gameId) public view returns (bool) {
        return _isGameStatusResolved(gameResolved[_gameId]);
    }

    /// @notice view function which returns normalized odds up to 100 (Example: 50-40-10)
    /// @param _gameId game id for which game is looking
    /// @return uint[] odds array normalized
    function getNormalizedOdds(bytes32 _gameId) public view returns (uint[] memory) {
        return oddsObtainer.getNormalizedOdds(_gameId);
    }

    /// @notice view function which returns normalized odds up to 100 (Example: 50-40-10)
    /// @param _market market
    /// @return uint[] odds array normalized
    function getNormalizedOddsForMarket(address _market) public view returns (uint[] memory) {
        return marketCreated[_market] ? getNormalizedOdds(gameIdPerMarket[_market]) : getNormalizedChildOdds(_market);
    }

    /// @notice view function which returns normalized odds up to 100 (Example: 50-40-10)
    /// @param _market market
    /// @return uint[] odds array normalized
    function getNormalizedChildOdds(address _market) public view returns (uint[] memory) {
        return oddsObtainer.getNormalizedChildOdds(_market);
    }

    /* ========== INTERNALS ========== */

    function _createGameFulfill(
        bytes32 requestId,
        GameCreate memory _game,
        uint _sportId
    ) internal {
        gameCreated[_game.gameId] = _game;
        sportsIdPerGame[_game.gameId] = _sportId;
        queues.enqueueGamesCreated(_game.gameId, _game.startTime, _sportId);
        gameFulfilledCreated[_game.gameId] = true;
        oddsObtainer.setFirstOdds(_game.gameId, _game.homeOdds, _game.awayOdds, _game.drawOdds);

        emit GameCreated(
            requestId,
            _sportId,
            _game.gameId,
            _game,
            queues.lastCreated(),
            oddsObtainer.getNormalizedOdds(_game.gameId)
        );
    }

    function _resolveGameFulfill(
        bytes32 requestId,
        GameResolve memory _game,
        uint _sportId
    ) internal {
        GameCreate memory singleGameCreated = getGameCreatedById(_game.gameId);

        // if status is resolved OR (status is canceled AND start time has passed fulfill game to be resolved)
        if (
            _isGameStatusResolved(_game) ||
            (cancelGameStatuses[_game.statusId] && singleGameCreated.startTime < block.timestamp)
        ) {
            gameResolved[_game.gameId] = _game;
            queues.enqueueGamesResolved(_game.gameId);
            gameFulfilledResolved[_game.gameId] = true;

            emit GameResolved(requestId, _sportId, _game.gameId, _game, queues.lastResolved());
        }
        // if status is canceled AND start time has not passed only pause market
        else if (cancelGameStatuses[_game.statusId] && singleGameCreated.startTime >= block.timestamp) {
            isPausedByCanceledStatus[marketPerGameId[_game.gameId]] = true;
            _pauseOrUnpauseMarket(marketPerGameId[_game.gameId], true);
            oddsObtainer.pauseUnpauseChildMarkets(marketPerGameId[_game.gameId], true);
        }
    }

    function _createMarket(bytes32 _gameId) internal {
        GameCreate memory game = getGameCreatedById(_gameId);
        // only markets in a future, if not dequeue that creation
        if (game.startTime > block.timestamp) {
            uint[] memory tags = _calculateTags(sportsIdPerGame[_gameId]);

            // create
            sportsManager.createMarket(
                _gameId,
                string(abi.encodePacked(game.homeTeam, " vs ", game.awayTeam)), // gameLabel
                game.startTime, //maturity
                0, //initialMint
                isSportTwoPositionsSport(sportsIdPerGame[_gameId]) ? 2 : 3,
                tags, //tags
                false
            );

            address marketAddress = sportsManager.getActiveMarketAddress(sportsManager.numActiveMarkets() - 1);
            marketPerGameId[game.gameId] = marketAddress;
            gameIdPerMarket[marketAddress] = game.gameId;
            marketCreated[marketAddress] = true;
            canMarketBeUpdated[marketAddress] = true;

            queues.dequeueGamesCreated();

            emit CreateSportsMarket(marketAddress, game.gameId, game, tags, oddsObtainer.getNormalizedOdds(game.gameId));
        } else {
            queues.dequeueGamesCreated();
        }
    }

    function _resolveMarket(bytes32 _gameId) internal {
        GameResolve memory game = gameResolved[_gameId];
        GameCreate memory singleGameCreated = getGameCreatedById(_gameId);
        uint index = queues.unproccessedGamesIndex(_gameId);

        // it can return ZERO index, needs checking
        require(_gameId == queues.unproccessedGames(index), "ID6");

        if (_isGameStatusResolved(game)) {
            if (oddsObtainer.invalidOdds(marketPerGameId[game.gameId])) {
                _pauseOrUnpauseMarket(marketPerGameId[game.gameId], false);
                oddsObtainer.pauseUnpauseChildMarkets(marketPerGameId[game.gameId], false);
            }

            (uint _outcome, uint8 _homeScore, uint8 _awayScore) = _calculateOutcome(game);

            // if result is draw and game is UFC or NFL, cancel market
            if (_outcome == RESULT_DRAW && _isDrawForCancelationBySport(sportsIdPerGame[game.gameId])) {
                _cancelMarket(game.gameId, index, true);
            } else {
                // if market is paused only remove from queue
                if (!sportsManager.isMarketPaused(marketPerGameId[game.gameId])) {
                    _setMarketCancelOrResolved(marketPerGameId[game.gameId], _outcome, _homeScore, _awayScore);
                    _cleanStorageQueue(index);

                    emit ResolveSportsMarket(marketPerGameId[game.gameId], game.gameId, _outcome);
                } else {
                    queues.dequeueGamesResolved();
                }
            }
            // if status is canceled and start time of a game passed cancel market
        } else if (cancelGameStatuses[game.statusId] && singleGameCreated.startTime < block.timestamp) {
            _cancelMarket(game.gameId, index, true);
        }
    }

    function _resolveMarketManually(
        address _market,
        uint _outcome,
        uint8 _homeScore,
        uint8 _awayScore
    ) internal {
        uint index = queues.unproccessedGamesIndex(gameIdPerMarket[_market]);

        // it can return ZERO index, needs checking
        require(gameIdPerMarket[_market] == queues.unproccessedGames(index));

        _pauseOrUnpauseMarket(_market, false);
        oddsObtainer.pauseUnpauseChildMarkets(_market, false);
        _setMarketCancelOrResolved(_market, _outcome, _homeScore, _awayScore);
        queues.removeItemUnproccessedGames(index);
        gameResolved[gameIdPerMarket[_market]] = GameResolve(
            gameIdPerMarket[_market],
            _homeScore,
            _awayScore,
            isSportTwoPositionsSport(sportsIdPerGame[gameIdPerMarket[_market]]) ? 8 : 11,
            0
        );

        emit GameResolved(
            gameIdPerMarket[_market], // no req. from CL (manual resolve) so just put gameID
            sportsIdPerGame[gameIdPerMarket[_market]],
            gameIdPerMarket[_market],
            gameResolved[gameIdPerMarket[_market]],
            0
        );
        emit ResolveSportsMarket(_market, gameIdPerMarket[_market], _outcome);
    }

    function _cancelMarketManually(address _market, bool _useBackupOdds) internal {
        uint index = queues.unproccessedGamesIndex(gameIdPerMarket[_market]);

        // it can return ZERO index, needs checking
        require(gameIdPerMarket[_market] == queues.unproccessedGames(index));

        if (_useBackupOdds) {
            require(oddsObtainer.areOddsValid(gameIdPerMarket[_market], _useBackupOdds));
            oddsObtainer.setBackupOddsAsMainOddsForGame(gameIdPerMarket[_market]);
        }

        _pauseOrUnpauseMarket(_market, false);
        oddsObtainer.pauseUnpauseChildMarkets(_market, false);
        _setMarketCancelOrResolved(_market, CANCELLED, 0, 0);
        queues.removeItemUnproccessedGames(index);

        emit CancelSportsMarket(_market, gameIdPerMarket[_market]);
    }

    function _pauseOrUnpauseMarket(address _market, bool _pause) internal {
        if (sportsManager.isMarketPaused(_market) != _pause) {
            sportsManager.setMarketPaused(_market, _pause);
            emit PauseSportsMarket(_market, _pause);
        }
    }

    function _cancelMarket(
        bytes32 _gameId,
        uint _index,
        bool cleanStorage
    ) internal {
        _setMarketCancelOrResolved(marketPerGameId[_gameId], CANCELLED, 0, 0);
        if (cleanStorage) {
            _cleanStorageQueue(_index);
        }

        emit CancelSportsMarket(marketPerGameId[_gameId], _gameId);
    }

    function _setMarketCancelOrResolved(
        address _market,
        uint _outcome,
        uint8 _homeScore,
        uint8 _awayScore
    ) internal {
        sportsManager.resolveMarket(_market, _outcome);
        oddsObtainer.resolveChildMarkets(_market, _outcome, _homeScore, _awayScore);
        marketCanceled[_market] = _outcome == CANCELLED;
        marketResolved[_market] = _outcome != CANCELLED;
    }

    function _cleanStorageQueue(uint index) internal {
        queues.dequeueGamesResolved();
        queues.removeItemUnproccessedGames(index);
    }

    function _calculateTags(uint _sportsId) internal pure returns (uint[] memory) {
        uint[] memory result = new uint[](1);
        result[0] = MIN_TAG_NUMBER + _sportsId;
        return result;
    }

    function _isDrawForCancelationBySport(uint _sportsId) internal pure returns (bool) {
        // UFC or NFL
        return _sportsId == 7 || _sportsId == 2;
    }

    function _isGameStatusResolved(GameResolve memory _game) internal view returns (bool) {
        return supportResolveGameStatuses[_game.statusId];
    }

    function _calculateOutcome(GameResolve memory _game)
        internal
        pure
        returns (
            uint,
            uint8,
            uint8
        )
    {
        if (_game.homeScore == _game.awayScore) {
            return (RESULT_DRAW, _game.homeScore, _game.awayScore);
        }
        return
            _game.homeScore > _game.awayScore
                ? (HOME_WIN, _game.homeScore, _game.awayScore)
                : (AWAY_WIN, _game.homeScore, _game.awayScore);
    }

    function _updateGameOnADate(
        bytes32 _gameId,
        uint _date,
        uint _sportId
    ) internal {
        if (gameOnADate[_gameId] != _date) {
            gamesPerDatePerSport[_sportId][_date].push(_gameId);
            gameOnADate[_gameId] = _date;
        }
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    /// @notice sets if sport is suported or not (delete from supported sport)
    /// @param _sportId sport id which needs to be supported or not
    /// @param _isSupported true/false (supported or not)
    function setSupportedSport(uint _sportId, bool _isSupported) external onlyOwner {
        require(supportedSport[_sportId] != _isSupported);
        supportedSport[_sportId] = _isSupported;
        emit SupportedSportsChanged(_sportId, _isSupported);
    }

    /// @notice sets resolved status which is supported or not
    /// @param _status status ID which needs to be supported or not
    /// @param _isSupported true/false (supported or not)
    function setSupportedResolvedStatuses(uint _status, bool _isSupported) external onlyOwner {
        require(supportResolveGameStatuses[_status] != _isSupported);
        supportResolveGameStatuses[_status] = _isSupported;
        emit SupportedResolvedStatusChanged(_status, _isSupported);
    }

    /// @notice sets cancel status which is supported or not
    /// @param _status ststus ID which needs to be supported or not
    /// @param _isSupported true/false (supported or not)
    function setSupportedCancelStatuses(uint _status, bool _isSupported) external onlyOwner {
        require(cancelGameStatuses[_status] != _isSupported);
        cancelGameStatuses[_status] = _isSupported;
        emit SupportedCancelStatusChanged(_status, _isSupported);
    }

    /// @notice sets if sport is two positional (Example: NBA)
    /// @param _sportId sport ID which is two positional
    /// @param _isTwoPosition true/false (two positional sport or not)
    function setTwoPositionSport(uint _sportId, bool _isTwoPosition) external onlyOwner {
        require(supportedSport[_sportId] && twoPositionSport[_sportId] != _isTwoPosition);
        twoPositionSport[_sportId] = _isTwoPosition;
        emit TwoPositionSportChanged(_sportId, _isTwoPosition);
    }

    /// @notice sets wrapper, manager, queue  address
    /// @param _wrapperAddress wrapper address
    /// @param _queues queue address
    /// @param _sportsManager sport manager address
    function setSportContracts(
        address _wrapperAddress,
        GamesQueue _queues,
        address _sportsManager,
        address _verifier,
        address _oddsObtainer
    ) external onlyOwner {
        sportsManager = ISportPositionalMarketManager(_sportsManager);
        queues = _queues;
        wrapperAddress = _wrapperAddress;
        verifier = ITherundownConsumerVerifier(_verifier);
        oddsObtainer = IGamesOddsObtainer(_oddsObtainer);

        emit NewSportContracts(_wrapperAddress, _queues, _sportsManager, _verifier, _oddsObtainer);
    }

    /// @notice adding/removing whitelist address depending on a flag
    /// @param _whitelistAddress address that needed to be whitelisted/ ore removed from WL
    /// @param _flag adding or removing from whitelist (true: add, false: remove)
    function addToWhitelist(address _whitelistAddress, bool _flag) external onlyOwner {
        require(_whitelistAddress != address(0) && whitelistedAddresses[_whitelistAddress] != _flag);
        whitelistedAddresses[_whitelistAddress] = _flag;
        emit AddedIntoWhitelist(_whitelistAddress, _flag);
    }

    /* ========== MODIFIERS ========== */

    modifier onlyWrapper() {
        require(msg.sender == wrapperAddress, "ID9");
        _;
    }

    modifier onlyObtainer() {
        require(msg.sender == address(oddsObtainer), "ID16");
        _;
    }

    modifier isAddressWhitelisted() {
        require(whitelistedAddresses[msg.sender], "ID10");
        _;
    }

    modifier canGameBeCanceled(bytes32 _gameId) {
        require(!isGameResolvedOrCanceled(_gameId), "ID11");
        require(marketPerGameId[_gameId] != address(0), "ID12");
        _;
    }

    modifier canGameBeResolved(
        bytes32 _gameId,
        uint _outcome,
        uint8 _homeScore,
        uint8 _awayScore
    ) {
        require(!isGameResolvedOrCanceled(_gameId), "ID13");
        require(marketPerGameId[_gameId] != address(0), "ID14");
        require(
            verifier.isValidOutcomeForGame(isSportTwoPositionsSport(sportsIdPerGame[_gameId]), _outcome) &&
                verifier.isValidOutcomeWithResult(_outcome, _homeScore, _awayScore),
            "ID15"
        );
        _;
    }
    /* ========== EVENTS ========== */

    event GameCreated(
        bytes32 _requestId,
        uint _sportId,
        bytes32 _id,
        GameCreate _game,
        uint _queueIndex,
        uint[] _normalizedOdds
    );
    event GameResolved(bytes32 _requestId, uint _sportId, bytes32 _id, GameResolve _game, uint _queueIndex);
    event GameOddsAdded(bytes32 _requestId, bytes32 _id, GameOdds _game, uint[] _normalizedOdds); // deprecated see GamesOddsObtainer
    event CreateSportsMarket(address _marketAddress, bytes32 _id, GameCreate _game, uint[] _tags, uint[] _normalizedOdds);
    event ResolveSportsMarket(address _marketAddress, bytes32 _id, uint _outcome);
    event PauseSportsMarket(address _marketAddress, bool _pause);
    event CancelSportsMarket(address _marketAddress, bytes32 _id);
    event InvalidOddsForMarket(bytes32 _requestId, address _marketAddress, bytes32 _id, GameOdds _game); // deprecated see GamesOddsObtainer
    event SupportedSportsChanged(uint _sportId, bool _isSupported);
    event SupportedResolvedStatusChanged(uint _status, bool _isSupported);
    event SupportedCancelStatusChanged(uint _status, bool _isSupported);
    event TwoPositionSportChanged(uint _sportId, bool _isTwoPosition);
    event NewSportsMarketManager(address _sportsManager); // deprecated
    event NewWrapperAddress(address _wrapperAddress); // deprecated
    event NewQueueAddress(GamesQueue _queues); // deprecated
    event NewSportContracts(
        address _wrapperAddress,
        GamesQueue _queues,
        address _sportsManager,
        address _verifier,
        address _oddsObtainer
    );
    event AddedIntoWhitelist(address _whitelistAddress, bool _flag);
    event OddsCircuitBreaker(address _marketAddress, bytes32 _id); // deprecated see GamesOddsObtainer
}

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
    mapping(bytes32 => GameOdds) public gameOdds;
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
    mapping(bytes32 => uint) public oddsLastPulledForGame;
    mapping(uint => bytes32[]) public gamesPerDate; // deprecated use gamesPerDatePerSport
    mapping(uint => mapping(uint => bool)) public isSportOnADate;
    mapping(address => bool) public invalidOdds;
    mapping(address => bool) public marketCreated;
    mapping(uint => mapping(uint => bytes32[])) public gamesPerDatePerSport;
    mapping(address => bool) public isPausedByCanceledStatus;
    mapping(address => bool) public canMarketBeUpdated;
    mapping(bytes32 => uint) public gameOnADate;

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
        _populateOnInit(_supportedSportIds, _twoPositionSports, _resolvedStatuses, _cancelGameStatuses);
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
                !isSameTeamOrTBD(gameForProcessing.homeTeam, gameForProcessing.awayTeam) &&
                gameForProcessing.startTime > block.timestamp
            ) {
                _updateGameOnADate(gameForProcessing.gameId, _date, _sportId);
                _createGameFulfill(_requestId, gameForProcessing, _sportId);
            }
            // old game UFC checking fighters
            else if (queues.existingGamesInCreatedQueue(gameForProcessing.gameId) && _sportId == 7) {
                GameCreate memory currentGameValues = getGameCreatedById(gameForProcessing.gameId);

                // if name of fighter (away or home) is not the same
                if (
                    keccak256(abi.encodePacked(gameForProcessing.homeTeam)) !=
                    keccak256(abi.encodePacked(currentGameValues.homeTeam)) ||
                    keccak256(abi.encodePacked(gameForProcessing.awayTeam)) !=
                    keccak256(abi.encodePacked(currentGameValues.awayTeam))
                ) {
                    // double-check if market exists -> cancel market -> create new for queue
                    if (marketCreated[marketPerGameId[gameForProcessing.gameId]]) {
                        _cancelMarket(gameForProcessing.gameId, 0, false);
                        _updateGameOnADate(gameForProcessing.gameId, _date, _sportId);
                        _createGameFulfill(_requestId, gameForProcessing, _sportId);
                    }
                }
            }
            // old game checking data start data
            else if (queues.existingGamesInCreatedQueue(gameForProcessing.gameId)) {
                GameCreate memory currentGameValues = getGameCreatedById(gameForProcessing.gameId);
                // checking time
                if (gameForProcessing.startTime != currentGameValues.startTime) {
                    _updateGameOnADate(gameForProcessing.gameId, _date, _sportId);
                    // if NEW start time is in future
                    if (gameForProcessing.startTime > block.timestamp) {
                        // this checks is for new markets
                        if (canMarketBeUpdated[marketPerGameId[gameForProcessing.gameId]]) {
                            sportsManager.updateDatesForMarket(
                                marketPerGameId[gameForProcessing.gameId],
                                gameForProcessing.startTime
                            );
                        }
                    } else {
                        // double-check if market existst
                        if (marketCreated[marketPerGameId[gameForProcessing.gameId]]) {
                            _pauseOrUnpauseMarket(marketPerGameId[gameForProcessing.gameId], true);
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
    /// @param _date date on which game/games are played
    function fulfillGamesOdds(
        bytes32 _requestId,
        bytes[] memory _games,
        uint _date
    ) external onlyWrapper {
        requestIdGamesOdds[_requestId] = _games;
        for (uint i = 0; i < _games.length; i++) {
            GameOdds memory game = abi.decode(_games[i], (GameOdds));
            // game needs to be fulfilled and market needed to be created
            if (gameFulfilledCreated[game.gameId] && marketPerGameId[game.gameId] != address(0)) {
                _oddsGameFulfill(_requestId, game);
            }
        }
    }

    /// @notice creates market for a given game id
    /// @param _gameId game id
    function createMarketForGame(bytes32 _gameId) public {
        require(
            marketPerGameId[_gameId] == address(0) ||
                (marketCanceled[marketPerGameId[_gameId]] && marketPerGameId[_gameId] != address(0)),
            "Market for game already exists"
        );
        require(gameFulfilledCreated[_gameId], "No such game fulfilled, created");
        require(queues.gamesCreateQueue(queues.firstCreated()) == _gameId, "Must be first in a queue");
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
        require(!isGameResolvedOrCanceled(_gameId), "Market resoved or canceled");
        require(gameFulfilledResolved[_gameId], "No such game Fulfilled, resolved");
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
    function cancelMarketManually(address _market)
        external
        isAddressWhitelisted
        canGameBeCanceled(gameIdPerMarket[_market])
    {
        _cancelMarketManually(_market);
    }

    /* ========== VIEW FUNCTIONS ========== */

    /// @notice view function which returns game created object based on id of a game
    /// @param _gameId game id
    /// @return GameCreate game create object
    function getGameCreatedById(bytes32 _gameId) public view returns (GameCreate memory) {
        return gameCreated[_gameId];
    }

    /// @notice view function which returns odds
    /// @param _gameId game id
    /// @return homeOdds moneyline odd in a two decimal places
    /// @return awayOdds moneyline odd in a two decimal places
    /// @return drawOdds moneyline odd in a two decimal places
    function getOddsForGame(bytes32 _gameId)
        external
        view
        returns (
            int24,
            int24,
            int24
        )
    {
        return (gameOdds[_gameId].homeOdds, gameOdds[_gameId].awayOdds, gameOdds[_gameId].drawOdds);
    }

    /// @notice view function which returns games on certan date and sportid
    /// @param _sportId date
    /// @param _date date
    /// @return bytes32[] list of games
    function getGamesPerDatePerSport(uint _sportId, uint _date) public view returns (bytes32[] memory) {
        return gamesPerDatePerSport[_sportId][_date];
    }

    /// @notice view function which returns game resolved object based on id of a game
    /// @param _gameId game id
    /// @return GameResolve game resolve object
    function getGameResolvedById(bytes32 _gameId) public view returns (GameResolve memory) {
        return gameResolved[_gameId];
    }

    /// @notice view function which returns if market type is supported, checks are done in a wrapper contract
    /// @param _market type of market (create or resolve)
    /// @return bool supported or not
    function isSupportedMarketType(string memory _market) external view returns (bool) {
        return
            keccak256(abi.encodePacked(_market)) == keccak256(abi.encodePacked("create")) ||
            keccak256(abi.encodePacked(_market)) == keccak256(abi.encodePacked("resolve"));
    }

    /// @notice view function which returns if game is ready to be created and teams are defined or not
    /// @param _teamA team A in string (Example: Liverpool Liverpool)
    /// @param _teamB team B in string (Example: Arsenal Arsenal)
    /// @return bool is it ready for creation true/false
    function isSameTeamOrTBD(string memory _teamA, string memory _teamB) public view returns (bool) {
        return
            keccak256(abi.encodePacked(_teamA)) == keccak256(abi.encodePacked(_teamB)) ||
            keccak256(abi.encodePacked(_teamA)) == keccak256(abi.encodePacked("TBD TBD")) ||
            keccak256(abi.encodePacked(_teamB)) == keccak256(abi.encodePacked("TBD TBD"));
    }

    /// @notice view function which returns if game is resolved or canceled and ready for market to be resolved or canceled
    /// @param _gameId game id for which game is looking
    /// @return bool is it ready for resolve or cancel true/false
    function isGameResolvedOrCanceled(bytes32 _gameId) public view returns (bool) {
        return marketResolved[marketPerGameId[_gameId]] || marketCanceled[marketPerGameId[_gameId]];
    }

    /// @notice view function which returns if sport is supported or not
    /// @param _sportId sport id for which is looking
    /// @return bool is sport supported true/false
    function isSupportedSport(uint _sportId) external view returns (bool) {
        return supportedSport[_sportId];
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
        return _isGameStatusResolved(getGameResolvedById(_gameId));
    }

    /// @notice view function which returns normalized odds up to 100 (Example: 50-40-10)
    /// @param _gameId game id for which game is looking
    /// @return uint[] odds array normalized
    function getNormalizedOdds(bytes32 _gameId) public view returns (uint[] memory) {
        int[] memory odds = new int[](3);
        odds[0] = gameOdds[_gameId].homeOdds;
        odds[1] = gameOdds[_gameId].awayOdds;
        odds[2] = gameOdds[_gameId].drawOdds;
        return _calculateAndNormalizeOdds(odds);
    }

    /// @notice view function which returns normalized odd based on moneyline odd (Example: -15000)
    /// @param _americanOdd moneyline odd (Example of a param: -15000, +35000, etc.), this param is with two decimal places (-15000 is -150 in moneyline world)
    /// @return odd normalized to a 100
    function calculateNormalizedOddFromAmerican(int _americanOdd) external pure returns (uint odd) {
        if (_americanOdd > 0) {
            odd = uint(_americanOdd);
            odd = ((10000 * 1e18) / (odd + 10000)) * 100;
        } else if (_americanOdd < 0) {
            odd = uint(-_americanOdd);
            odd = ((odd * 1e18) / (odd + 10000)) * 100;
        }
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
        gameOdds[_game.gameId] = GameOdds(_game.gameId, _game.homeOdds, _game.awayOdds, _game.drawOdds);
        oddsLastPulledForGame[_game.gameId] = block.timestamp;

        emit GameCreated(requestId, _sportId, _game.gameId, _game, queues.lastCreated(), getNormalizedOdds(_game.gameId));
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
        }
    }

    function _oddsGameFulfill(bytes32 requestId, GameOdds memory _game) internal {
        // if odds are valid store them if not pause market
        if (_areOddsValid(_game)) {
            gameOdds[_game.gameId] = _game;
            oddsLastPulledForGame[_game.gameId] = block.timestamp;

            // if was paused and paused by invalid odds unpause
            if (sportsManager.isMarketPaused(marketPerGameId[_game.gameId])) {
                if (invalidOdds[marketPerGameId[_game.gameId]] || isPausedByCanceledStatus[marketPerGameId[_game.gameId]]) {
                    invalidOdds[marketPerGameId[_game.gameId]] = false;
                    isPausedByCanceledStatus[marketPerGameId[_game.gameId]] = false;
                    _pauseOrUnpauseMarket(marketPerGameId[_game.gameId], false);
                }
            }

            emit GameOddsAdded(requestId, _game.gameId, _game, getNormalizedOdds(_game.gameId));
        } else {
            if (!sportsManager.isMarketPaused(marketPerGameId[_game.gameId])) {
                invalidOdds[marketPerGameId[_game.gameId]] = true;
                _pauseOrUnpauseMarket(marketPerGameId[_game.gameId], true);
            }

            emit InvalidOddsForMarket(requestId, marketPerGameId[_game.gameId], _game.gameId, _game);
        }
    }

    function _populateOnInit(
        uint[] memory _supportedSportIds,
        uint[] memory _twoPositionSports,
        uint[] memory _supportedStatuses,
        uint[] memory _cancelStatuses
    ) internal {
        for (uint i; i < _supportedSportIds.length; i++) {
            supportedSport[_supportedSportIds[i]] = true;
        }
        for (uint i; i < _twoPositionSports.length; i++) {
            twoPositionSport[_twoPositionSports[i]] = true;
        }
        for (uint i; i < _supportedStatuses.length; i++) {
            supportResolveGameStatuses[_supportedStatuses[i]] = true;
        }
        for (uint i; i < _cancelStatuses.length; i++) {
            cancelGameStatuses[_cancelStatuses[i]] = true;
        }
    }

    function _createMarket(bytes32 _gameId) internal {
        GameCreate memory game = getGameCreatedById(_gameId);
        uint sportId = sportsIdPerGame[_gameId];
        uint numberOfPositions = _calculateNumberOfPositionsBasedOnSport(sportId);
        uint[] memory tags = _calculateTags(sportId);

        // create
        sportsManager.createMarket(
            _gameId,
            _append(game.homeTeam, game.awayTeam), // gameLabel
            game.startTime, //maturity
            0, //initialMint
            numberOfPositions,
            tags //tags
        );

        address marketAddress = sportsManager.getActiveMarketAddress(sportsManager.numActiveMarkets() - 1);
        marketPerGameId[game.gameId] = marketAddress;
        gameIdPerMarket[marketAddress] = game.gameId;
        marketCreated[marketAddress] = true;
        canMarketBeUpdated[marketAddress] = true;

        queues.dequeueGamesCreated();

        emit CreateSportsMarket(marketAddress, game.gameId, game, tags, getNormalizedOdds(game.gameId));
    }

    function _resolveMarket(bytes32 _gameId) internal {
        GameResolve memory game = getGameResolvedById(_gameId);
        GameCreate memory singleGameCreated = getGameCreatedById(_gameId);
        uint index = queues.unproccessedGamesIndex(_gameId);

        // it can return ZERO index, needs checking
        require(_gameId == queues.unproccessedGames(index), "Invalid Game ID");

        if (_isGameStatusResolved(game)) {
            if (invalidOdds[marketPerGameId[game.gameId]]) {
                _pauseOrUnpauseMarket(marketPerGameId[game.gameId], false);
            }

            uint _outcome = _calculateOutcome(game);

            // if result is draw and game is UFC or NFL, cancel market
            if (_outcome == RESULT_DRAW && _isDrawForCancelationBySport(sportsIdPerGame[game.gameId])) {
                _cancelMarket(game.gameId, index, true);
            } else {
                // if market is paused only remove from queue
                if (!sportsManager.isMarketPaused(marketPerGameId[game.gameId])) {
                    sportsManager.resolveMarket(marketPerGameId[game.gameId], _outcome);
                    marketResolved[marketPerGameId[game.gameId]] = true;

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
        require(gameIdPerMarket[_market] == queues.unproccessedGames(index), "Invalid Game ID");

        _pauseOrUnpauseMarket(_market, false);
        sportsManager.resolveMarket(_market, _outcome);
        marketResolved[_market] = true;
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

    function _cancelMarketManually(address _market) internal {
        uint index = queues.unproccessedGamesIndex(gameIdPerMarket[_market]);

        // it can return ZERO index, needs checking
        require(gameIdPerMarket[_market] == queues.unproccessedGames(index), "Invalid Game ID");

        _pauseOrUnpauseMarket(_market, false);
        sportsManager.resolveMarket(_market, 0);
        marketCanceled[_market] = true;
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
        sportsManager.resolveMarket(marketPerGameId[_gameId], 0);
        marketCanceled[marketPerGameId[_gameId]] = true;

        if (cleanStorage) {
            _cleanStorageQueue(_index);
        }

        emit CancelSportsMarket(marketPerGameId[_gameId], _gameId);
    }

    function _cleanStorageQueue(uint index) internal {
        queues.dequeueGamesResolved();
        queues.removeItemUnproccessedGames(index);
    }

    function _append(string memory teamA, string memory teamB) internal pure returns (string memory) {
        return string(abi.encodePacked(teamA, " vs ", teamB));
    }

    function _calculateNumberOfPositionsBasedOnSport(uint _sportsId) internal returns (uint) {
        return isSportTwoPositionsSport(_sportsId) ? 2 : 3;
    }

    function _calculateTags(uint _sportsId) internal returns (uint[] memory) {
        uint[] memory result = new uint[](1);
        result[0] = MIN_TAG_NUMBER + _sportsId;
        return result;
    }

    function _isDrawForCancelationBySport(uint _sportsId) internal view returns (bool) {
        // UFC or NFL
        return _sportsId == 7 || _sportsId == 2;
    }

    function _isGameStatusResolved(GameResolve memory _game) internal view returns (bool) {
        return supportResolveGameStatuses[_game.statusId];
    }

    function _calculateOutcome(GameResolve memory _game) internal pure returns (uint) {
        if (_game.homeScore == _game.awayScore) {
            return RESULT_DRAW;
        }
        return _game.homeScore > _game.awayScore ? HOME_WIN : AWAY_WIN;
    }

    function _areOddsValid(GameOdds memory _game) internal view returns (bool) {
        if (isSportTwoPositionsSport(sportsIdPerGame[_game.gameId])) {
            return _game.awayOdds != 0 && _game.homeOdds != 0;
        } else {
            return _game.awayOdds != 0 && _game.homeOdds != 0 && _game.drawOdds != 0;
        }
    }

    function _isValidOutcomeForGame(bytes32 _gameId, uint _outcome) internal view returns (bool) {
        if (isSportTwoPositionsSport(sportsIdPerGame[_gameId])) {
            return _outcome == HOME_WIN || _outcome == AWAY_WIN || _outcome == CANCELLED;
        }
        return _outcome == HOME_WIN || _outcome == AWAY_WIN || _outcome == RESULT_DRAW || _outcome == CANCELLED;
    }

    function _isValidOutcomeWithResult(
        uint _outcome,
        uint _homeScore,
        uint _awayScore
    ) internal view returns (bool) {
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
        require(supportedSport[_sportId] != _isSupported, "Already set");
        supportedSport[_sportId] = _isSupported;
        emit SupportedSportsChanged(_sportId, _isSupported);
    }

    /// @notice sets resolved status which is supported or not
    /// @param _status status ID which needs to be supported or not
    /// @param _isSupported true/false (supported or not)
    function setSupportedResolvedStatuses(uint _status, bool _isSupported) external onlyOwner {
        require(supportResolveGameStatuses[_status] != _isSupported, "Already set");
        supportResolveGameStatuses[_status] = _isSupported;
        emit SupportedResolvedStatusChanged(_status, _isSupported);
    }

    /// @notice sets cancel status which is supported or not
    /// @param _status ststus ID which needs to be supported or not
    /// @param _isSupported true/false (supported or not)
    function setSupportedCancelStatuses(uint _status, bool _isSupported) external onlyOwner {
        require(cancelGameStatuses[_status] != _isSupported, "Already set");
        cancelGameStatuses[_status] = _isSupported;
        emit SupportedCancelStatusChanged(_status, _isSupported);
    }

    /// @notice sets if sport is two positional (Example: NBA)
    /// @param _sportId sport ID which is two positional
    /// @param _isTwoPosition true/false (two positional sport or not)
    function setTwoPositionSport(uint _sportId, bool _isTwoPosition) external onlyOwner {
        require(supportedSport[_sportId] && twoPositionSport[_sportId] != _isTwoPosition, "Invalid input");
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
        address _sportsManager
    ) external onlyOwner {
        require(
            _wrapperAddress != address(0) || address(_queues) != address(0) || _sportsManager != address(0),
            "Invalid addreses"
        );

        sportsManager = ISportPositionalMarketManager(_sportsManager);
        queues = _queues;
        wrapperAddress = _wrapperAddress;

        emit NewSportContracts(_wrapperAddress, _queues, _sportsManager);
    }

    /// @notice adding/removing whitelist address depending on a flag
    /// @param _whitelistAddress address that needed to be whitelisted/ ore removed from WL
    /// @param _flag adding or removing from whitelist (true: add, false: remove)
    function addToWhitelist(address _whitelistAddress, bool _flag) external onlyOwner {
        require(_whitelistAddress != address(0) && whitelistedAddresses[_whitelistAddress] != _flag, "Invalid");
        whitelistedAddresses[_whitelistAddress] = _flag;
        emit AddedIntoWhitelist(_whitelistAddress, _flag);
    }

    /* ========== MODIFIERS ========== */

    modifier onlyWrapper() {
        require(msg.sender == wrapperAddress, "Only wrapper");
        _;
    }

    modifier isAddressWhitelisted() {
        require(whitelistedAddresses[msg.sender], "Invalid caller");
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
            _isValidOutcomeForGame(_gameId, _outcome) && _isValidOutcomeWithResult(_outcome, _homeScore, _awayScore),
            "Bad result or outcome"
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
    event GameOddsAdded(bytes32 _requestId, bytes32 _id, GameOdds _game, uint[] _normalizedOdds);
    event CreateSportsMarket(address _marketAddress, bytes32 _id, GameCreate _game, uint[] _tags, uint[] _normalizedOdds);
    event ResolveSportsMarket(address _marketAddress, bytes32 _id, uint _outcome);
    event PauseSportsMarket(address _marketAddress, bool _pause);
    event CancelSportsMarket(address _marketAddress, bytes32 _id);
    event InvalidOddsForMarket(bytes32 _requestId, address _marketAddress, bytes32 _id, GameOdds _game);
    event SupportedSportsChanged(uint _sportId, bool _isSupported);
    event SupportedResolvedStatusChanged(uint _status, bool _isSupported);
    event SupportedCancelStatusChanged(uint _status, bool _isSupported);
    event TwoPositionSportChanged(uint _sportId, bool _isTwoPosition);
    event NewSportsMarketManager(address _sportsManager); // deprecated
    event NewWrapperAddress(address _wrapperAddress); // deprecated
    event NewQueueAddress(GamesQueue _queues); // deprecated
    event NewSportContracts(address _wrapperAddress, GamesQueue _queues, address _sportsManager);
    event AddedIntoWhitelist(address _whitelistAddress, bool _flag);
}

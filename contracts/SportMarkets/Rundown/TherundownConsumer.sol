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

/** 
    Link to docs: https://market.link/nodes/TheRundown/integrations
 */
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
    }

    struct GameOdds {
        bytes32 gameId;
        int24 homeOdds;
        int24 awayOdds;
        int24 drawOdds;
    }

    /* ========== STATE VARIABLES ========== */

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
    mapping(uint => bool) public suportResolveGameStatuses;
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

    // global params
    address public wrapperAddress;
    mapping(address => bool) public whitelistedAddresses;

    mapping(bytes32 => bytes32) public gemeIdPerRequestId;

    //TODO delete only for report
    mapping(bytes32 => uint) public countIfOddsChangeForGame; // delete

    mapping(uint => bool) public havingGamesPerDate;
    
    //TODO delete only for report
    mapping(uint => bool) public havingSportOnADate;  // delete

    mapping(uint => bytes32[]) public gamesPerDate;
    mapping(uint => uint) public oddsLastPulledForDate;
    mapping(uint =>  mapping(uint => bool)) public isSportOnADate;

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
        _populateSports(_supportedSportIds);
        _populateTwoPositionSports(_twoPositionSports);
        _populateSupportedStatuses(_resolvedStatuses);
        _populateCancelGameStatuses(_cancelGameStatuses);
        sportsManager = ISportPositionalMarketManager(_sportsManager);
        queues = _queues;
        whitelistedAddresses[_owner] = true;
    }

    /* ========== CONSUMER FULFILL FUNCTIONS ========== */

    function fulfillGamesCreated(
        bytes32 _requestId,
        bytes[] memory _games,
        uint _sportId,
        uint _date
    ) external onlyWrapper {
        requestIdGamesCreated[_requestId] = _games;

        if(_games.length > 0){
            havingGamesPerDate[_date] = true;
            isSportOnADate[_date][_sportId] = true;
            oddsLastPulledForDate[_date] = block.timestamp;
        }

        for (uint i = 0; i < _games.length; i++) {
            GameCreate memory game = abi.decode(_games[i], (GameCreate));
            if (!queues.existingGamesInCreatedQueue(game.gameId) && !isSameTeamOrTBD(game.homeTeam, game.awayTeam)) {
                gamesPerDate[_date].push(game.gameId);
                _createGameFulfill(_requestId, game, _sportId);
            }
        }
    }

    function fulfillGamesResolved(
        bytes32 _requestId,
        bytes[] memory _games,
        uint _sportId
    ) external onlyWrapper {
        requestIdGamesResolved[_requestId] = _games;
        for (uint i = 0; i < _games.length; i++) {
            GameResolve memory game = abi.decode(_games[i], (GameResolve));
            if (!queues.existingGamesInResolvedQueue(game.gameId)) {
                _resolveGameFulfill(_requestId, game, _sportId);
            }
        }
    }

    function fulfillGamesOdds(bytes32 _requestId, bytes[] memory _games, uint _date) external onlyWrapper {
        requestIdGamesOdds[_requestId] = _games;
        oddsLastPulledForDate[_date] = block.timestamp;
        for (uint i = 0; i < _games.length; i++) {
            GameOdds memory game = abi.decode(_games[i], (GameOdds));
            _oddsGameFulfill(_requestId, game);
        }
    }

    function createMarketForGame(bytes32 _gameId) external {
        require(marketPerGameId[_gameId] == address(0), "Market for game already exists");
        require(gameFulfilledCreated[_gameId], "No such game fulfilled, created");
        require(queues.gamesCreateQueue(queues.firstCreated()) == _gameId, "Must be first in a queue");
        _createMarket(_gameId);
    }

    function resolveMarketForGame(bytes32 _gameId) external {
        require(!isGameResolvedOrCanceled(_gameId), "Market resoved or canceled");
        require(gameFulfilledResolved[_gameId], "No such game Fulfilled, resolved");
        _resolveMarket(_gameId);
    }

    function resolveGameManually(bytes32 _gameId, uint _outcome) external isAddressWhitelisted {
        require(!isGameResolvedOrCanceled(_gameId), "Market resoved or canceled");
        require(marketPerGameId[_gameId] != address(0), "No market created for game");

        if (isSportTwoPositionsSport(sportsIdPerGame[_gameId])) {
            require(_outcome == HOME_WIN || _outcome == AWAY_WIN || _outcome == CANCELLED, "Bad outcome for two position game");
        } else {
            require(
                _outcome == HOME_WIN || _outcome == AWAY_WIN || _outcome == RESULT_DRAW || _outcome == CANCELLED,
                "Bad outcome for three position game"
            );
        }

        _resolveMarketManually(marketPerGameId[_gameId], _outcome);
    }

    function resolveMarketManually(address _market, uint _outcome) external isAddressWhitelisted {
        require(!isGameResolvedOrCanceled(gameIdPerMarket[_market]), "Market resoved or canceled");
        require(gameIdPerMarket[_market] != 0, "No market created for game");

        if (isSportTwoPositionsSport(sportsIdPerGame[gameIdPerMarket[_market]])) {
            require(_outcome == HOME_WIN || _outcome == AWAY_WIN || _outcome == CANCELLED, "Bad outcome for two position game");
        } else {
            require(
                _outcome == HOME_WIN || _outcome == AWAY_WIN || _outcome == RESULT_DRAW || _outcome == CANCELLED,
                "Bad outcome for three position game"
            );
        }

        _resolveMarketManually(_market, _outcome);
    }

    function cancelGameManually(bytes32 _gameId) external isAddressWhitelisted {
        require(!isGameResolvedOrCanceled(_gameId), "Market resoved or canceled");
        require(marketPerGameId[_gameId] != address(0), "No market created for game");

        _cancelMarketManually(marketPerGameId[_gameId]);
    }

    function cancelMarketManually(address _market) external isAddressWhitelisted {
        require(!isGameResolvedOrCanceled(gameIdPerMarket[_market]), "Market resoved or canceled");
        require(gameIdPerMarket[_market] != 0, "No market created for game");

        _cancelMarketManually(_market);
    }

    /* ========== VIEW FUNCTIONS ========== */

    function getGameCreatedByRequestId(bytes32 _requestId, uint256 _idx) public view returns (GameCreate memory) {
        GameCreate memory game = abi.decode(requestIdGamesCreated[_requestId][_idx], (GameCreate));
        return game;
    }

    function getGameResolvedByRequestId(bytes32 _requestId, uint256 _idx) public view returns (GameResolve memory) {
        GameResolve memory game = abi.decode(requestIdGamesResolved[_requestId][_idx], (GameResolve));
        return game;
    }

    function getGameCreatedById(bytes32 _gameId) public view returns (GameCreate memory) {
        return gameCreated[_gameId];
    }

    function getGameTime(bytes32 _gameId) public view returns (uint256) {
        return gameCreated[_gameId].startTime;
    }

    function getOddsHomeTeam(bytes32 _gameId) public view returns (int24) {
        return gameOdds[_gameId].homeOdds;
    }

    function getOddsAwayTeam(bytes32 _gameId) public view returns (int24) {
        return gameOdds[_gameId].awayOdds;
    }

    function getOddsDraw(bytes32 _gameId) public view returns (int24) {
        return gameOdds[_gameId].drawOdds;
    }

    function getGameResolvedById(bytes32 _gameId) public view returns (GameResolve memory) {
        return gameResolved[_gameId];
    }

    function isSupportedMarketType(string memory _market) external view returns (bool) {
        return
            keccak256(abi.encodePacked(_market)) == keccak256(abi.encodePacked("create")) ||
            keccak256(abi.encodePacked(_market)) == keccak256(abi.encodePacked("resolve"));
    }

    function isSameTeamOrTBD(string memory _teamA, string memory _teamB) public view returns (bool) {
        return
            keccak256(abi.encodePacked(_teamA)) == keccak256(abi.encodePacked(_teamB)) ||
            keccak256(abi.encodePacked(_teamA)) == keccak256(abi.encodePacked("TBD TBD")) ||
            keccak256(abi.encodePacked(_teamB)) == keccak256(abi.encodePacked("TBD TBD"));
    }

    function isGameResolvedOrCanceled(bytes32 _gameId) public view returns (bool) {
        return marketResolved[marketPerGameId[_gameId]] || marketCanceled[marketPerGameId[_gameId]];
    }

    function isSupportedSport(uint _sportId) external view returns (bool) {
        return supportedSport[_sportId];
    }

    function isSportTwoPositionsSport(uint _sportsId) public view returns (bool) {
        return twoPositionSport[_sportsId];
    }

    function isGameInResolvedStatus(bytes32 _gameId) public view returns (bool) {
        return _isGameStatusResolved(getGameResolvedById(_gameId));
    }

    function getNormalizedOdds(bytes32 _gameId) public view returns (uint[] memory) {
        int[] memory odds = new int[](3);
        odds[0] = gameOdds[_gameId].homeOdds;
        odds[1] = gameOdds[_gameId].awayOdds;
        odds[2] = gameOdds[_gameId].drawOdds;
        return _calculateAndNormalizeOdds(odds);
    }

    function calculateNormalizedOddFromAmerican(int _americanOdd) external pure returns(uint) {
            uint odd;
            if (_americanOdd == 0) {
                odd = 0;
            } else if (_americanOdd > 0) {
                odd = uint(_americanOdd); 
                odd = ((10000 * 1e18) / (odd + 10000)) * 100;
            } else if (_americanOdd < 0) {
                odd = uint(-_americanOdd); 
                odd = ((odd * 1e18) / (odd + 10000)) * 100;
            }
            return odd;
    }

    function getResult(bytes32 _gameId) external view returns (uint) {
        if (isGameInResolvedStatus(_gameId)) {
            return _calculateOutcome(getGameResolvedById(_gameId));
        } else {
            return 0;
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
        gemeIdPerRequestId[_game.gameId] = requestId;

        emit GameCreated(requestId, _sportId, _game.gameId, _game, queues.lastCreated(), getNormalizedOdds(_game.gameId));
    }

    function _resolveGameFulfill(
        bytes32 requestId,
        GameResolve memory _game,
        uint _sportId
    ) internal {
        if (_isGameReadyToBeResolved(_game)) {
            gameResolved[_game.gameId] = _game;
            queues.enqueueGamesResolved(_game.gameId);
            gameFulfilledResolved[_game.gameId] = true;

            emit GameResolved(requestId, _sportId, _game.gameId, _game, queues.lastResolved());
        }
    }

    function _oddsGameFulfill(bytes32 requestId, GameOdds memory _game) internal {
        gameOdds[_game.gameId] = _game;
        oddsLastPulledForGame[_game.gameId] = block.timestamp;
        emit GameOddsAdded(requestId, _game.gameId, _game, getNormalizedOdds(_game.gameId));
    }

    function _populateSports(uint[] memory _supportedSportIds) internal {
        for (uint i; i < _supportedSportIds.length; i++) {
            supportedSport[_supportedSportIds[i]] = true;
        }
    }

    function _populateTwoPositionSports(uint[] memory _twoPositionSports) internal {
        for (uint i; i < _twoPositionSports.length; i++) {
            twoPositionSport[_twoPositionSports[i]] = true;
        }
    }

    function _populateSupportedStatuses(uint[] memory _supportedStatuses) internal {
        for (uint i; i < _supportedStatuses.length; i++) {
            suportResolveGameStatuses[_supportedStatuses[i]] = true;
        }
    }

    function _populateCancelGameStatuses(uint[] memory _cancelStatuses) internal {
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
        oddsLastPulledForGame[game.gameId] = block.timestamp;

        queues.dequeueGamesCreated();

        emit CreateSportsMarket(marketAddress, game.gameId, game, tags, getNormalizedOdds(game.gameId));
    }

    function _resolveMarket(bytes32 _gameId) internal {
        GameResolve memory game = getGameResolvedById(_gameId);
        uint index = queues.unproccessedGamesIndex(_gameId);

        // it can return ZERO index, needs checking
        require(_gameId == queues.unproccessedGames(index), "Invalid Game ID");

        if (_isGameStatusResolved(game)) {
            uint _outcome = _calculateOutcome(game);

            sportsManager.resolveMarket(marketPerGameId[game.gameId], _outcome);
            marketResolved[marketPerGameId[game.gameId]] = true;

            _cleanStorageQueue(index);

            emit ResolveSportsMarket(marketPerGameId[game.gameId], game.gameId, _outcome);
        } else if (_isGameStatusCanceled(game)) {
            sportsManager.resolveMarket(marketPerGameId[game.gameId], 0);
            marketCanceled[marketPerGameId[game.gameId]] = true;

            _cleanStorageQueue(index);

            emit CancelSportsMarket(marketPerGameId[game.gameId], game.gameId);
        }
    }

    function _resolveMarketManually(address _market, uint _outcome) internal {
        uint index = queues.unproccessedGamesIndex(gameIdPerMarket[_market]);

        // it can return ZERO index, needs checking
        require(gameIdPerMarket[_market] == queues.unproccessedGames(index), "Invalid Game ID");

        sportsManager.resolveMarket(_market, _outcome);
        marketResolved[_market] = true;
        queues.removeItemUnproccessedGames(index);

        emit ResolveSportsMarket(_market, gameIdPerMarket[_market], _outcome);
    }

    function _cancelMarketManually(address _market) internal {
        uint index = queues.unproccessedGamesIndex(gameIdPerMarket[_market]);

        // it can return ZERO index, needs checking
        require(gameIdPerMarket[_market] == queues.unproccessedGames(index), "Invalid Game ID");

        sportsManager.resolveMarket(_market, 0);
        marketCanceled[_market] = true;
        queues.removeItemUnproccessedGames(index);

        emit CancelSportsMarket(_market, gameIdPerMarket[_market]);
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

    function _isGameReadyToBeResolved(GameResolve memory _game) internal view returns (bool) {
        return _isGameStatusResolved(_game) || _isGameStatusCanceled(_game);
    }

    function _isGameStatusResolved(GameResolve memory _game) internal view returns (bool) {
        return suportResolveGameStatuses[_game.statusId];
    }

    function _isGameStatusCanceled(GameResolve memory _game) internal view returns (bool) {
        return cancelGameStatuses[_game.statusId];
    }

    function _calculateOutcome(GameResolve memory _game) internal pure returns (uint) {
        if (_game.homeScore == _game.awayScore) {
            return RESULT_DRAW;
        }
        return _game.homeScore > _game.awayScore ? HOME_WIN : AWAY_WIN;
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
            normalizedOdds[i] = (1e18 * normalizedOdds[i]) / totalOdds;
        }
        return normalizedOdds;
    }

    /* ========== GAMES MANAGEMENT ========== */

    function removeFromCreatedQueue() external onlyOwner {
        queues.dequeueGamesCreated();
    }

    function removeFromResolvedQueue() external onlyOwner {
        queues.dequeueGamesResolved();
    }

    function removeFromUnprocessedGamesArray(uint _index) external onlyOwner {
        queues.removeItemUnproccessedGames(_index);
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    function setSupportedSport(uint _sportId, bool _isSuported) external onlyOwner {
        supportedSport[_sportId] = _isSuported;
        emit SupportedSportsChanged(_sportId, _isSuported);
    }

    function setSupportedResolvedStatuses(uint _status, bool _isSuported) external onlyOwner {
        suportResolveGameStatuses[_status] = _isSuported;
        emit SupportedResolvedStatusChanged(_status, _isSuported);
    }

    function setSupportedCancelStatuses(uint _status, bool _isSuported) external onlyOwner {
        cancelGameStatuses[_status] = _isSuported;
        emit SupportedCancelStatusChanged(_status, _isSuported);
    }

    function setwoPositionSport(uint _sportId, bool _isTwoPosition) external onlyOwner {
        twoPositionSport[_sportId] = _isTwoPosition;
        emit TwoPositionSportChanged(_sportId, _isTwoPosition);
    }

    function setSportsManager(address _sportsManager) external onlyOwner {
        sportsManager = ISportPositionalMarketManager(_sportsManager);
        emit NewSportsMarketManager(_sportsManager);
    }

    function setWrapperAddress(address _wrapperAddress) external onlyOwner {
        require(_wrapperAddress != address(0), "Invalid address");
        wrapperAddress = _wrapperAddress;
        emit NewWrapperAddress(_wrapperAddress);
    }

    function setQueueAddress(GamesQueue _queues) external onlyOwner {
        queues = _queues;
        emit NewQueueAddress(_queues);
    }

    function addToWhitelist(address _whitelistAddress) external onlyOwner {
        require(_whitelistAddress != address(0), "Invalid address");
        whitelistedAddresses[_whitelistAddress] = true;
        emit AddedIntoWhitelist(_whitelistAddress);
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

    /* ========== EVENTS ========== */

    event GameCreated(bytes32 _requestId, uint _sportId, bytes32 _id, GameCreate _game, uint _queueIndex, uint[] _normalizedOdds);
    event GameResolved(bytes32 _requestId, uint _sportId, bytes32 _id, GameResolve _game, uint _queueIndex);
    event GameOddsAdded(bytes32 _requestId, bytes32 _id, GameOdds _game, uint[] _normalizedOdds);
    event CreateSportsMarket(address _marketAddress, bytes32 _id, GameCreate _game, uint[] _tags, uint[] _normalizedOdds);
    event ResolveSportsMarket(address _marketAddress, bytes32 _id, uint _outcome);
    event CancelSportsMarket(address _marketAddress, bytes32 _id);
    event SupportedSportsChanged(uint _sportId, bool _isSupported);
    event SupportedResolvedStatusChanged(uint _status, bool _isSupported);
    event SupportedCancelStatusChanged(uint _status, bool _isSupported);
    event TwoPositionSportChanged(uint _sportId, bool _isTwoPosition);
    event NewSportsMarketManager(address _sportsManager);
    event NewWrapperAddress(address _wrapperAddress);
    event NewQueueAddress(GamesQueue _queues);
    event AddedIntoWhitelist(address _whitelistAddress);
}

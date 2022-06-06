// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "./GamesQueue.sol";

// interface
import "../interfaces/IExoticPositionalMarketManager.sol";

/** 
    Link to docs: https://market.link/nodes/098c3c5e-811d-4b8a-b2e3-d1806909c7d7/integrations
 */
contract TherundownConsumer is Initializable, ProxyOwned, ProxyPausable {
    /* ========== LIBRARIES ========== */

    using SafeERC20Upgradeable for IERC20Upgradeable;

    /* ========== CONSTANTS =========== */

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

    /* ========== STATE VARIABLES ========== */

    // Maps <RequestId, Result>
    mapping(bytes32 => bytes[]) public requestIdGamesCreated;
    mapping(bytes32 => bytes[]) public requestIdGamesResolved;

    // Maps <GameId, Game>
    mapping(bytes32 => GameCreate) public gameCreated;
    mapping(bytes32 => GameResolve) public gameResolved;
    mapping(bytes32 => uint) public sportsIdPerGame;
    mapping(bytes32 => bool) public gameFulfilledCreated;
    mapping(bytes32 => bool) public gameFulfilledResolved;

    // sports props
    mapping(uint => bool) public supportedSport;
    mapping(uint => bool) public twoPositionSport;

    // market props
    IExoticPositionalMarketManager public exoticManager;
    mapping(bytes32 => address) public marketPerGameId;
    mapping(address => bytes32) public gameIdPerMarket;
    mapping(address => bool) public marketResolved;
    mapping(address => bool) public marketCanceled;
    uint public fixedTicketPrice;
    bool public withdrawalAllowed;
    uint public fixedsUSD;

    // wrapper
    address public wrapperAddress;

    GamesQueue public queues;

    mapping(address => bool) public whitelistedAddresses;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        uint[] memory _supportedSportIds,
        address _exoticManager,
        uint[] memory _twoPositionSports,
        uint _fixedTicketPrice,
        bool _withdrawalAllowed,
        uint _fixedsUSD,
        GamesQueue _queues
    ) external initializer {
        setOwner(_owner);
        _populateSports(_supportedSportIds);
        _populateTwoPositionSports(_twoPositionSports);
        exoticManager = IExoticPositionalMarketManager(_exoticManager);
        fixedTicketPrice = _fixedTicketPrice;
        withdrawalAllowed = _withdrawalAllowed;
        queues = _queues;
        fixedsUSD = _fixedsUSD;
        //approve
        IERC20Upgradeable(exoticManager.paymentToken()).approve(
            exoticManager.thalesBonds(),
            0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
        );
    }

    /* ========== CONSUMER FULFILL FUNCTIONS ========== */

    function fulfillGamesCreated(
        bytes32 _requestId,
        bytes[] memory _games,
        uint _sportId
    ) external onlyWrapper {
        requestIdGamesCreated[_requestId] = _games;
        for (uint i = 0; i < _games.length; i++) {
            GameCreate memory game = abi.decode(_games[i], (GameCreate));
            if (!queues.existingGamesInCreatedQueue(game.gameId) && !isSameTeamOrTBD(game.homeTeam, game.awayTeam)) {
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
            require(_outcome == HOME_WIN || _outcome == AWAY_WIN, "Bad outcome for two position game");
        } else {
            require(
                _outcome == HOME_WIN || _outcome == AWAY_WIN || _outcome == RESULT_DRAW,
                "Bad outcome for three position game"
            );
        }

        _resolveMarketManually(marketPerGameId[_gameId], _outcome);
    }

    function resolveMarketManually(address _market, uint _outcome) external isAddressWhitelisted {
        require(!isGameResolvedOrCanceled(gameIdPerMarket[_market]), "Market resoved or canceled");
        require(gameIdPerMarket[_market] != 0, "No market created for game");

        if (isSportTwoPositionsSport(sportsIdPerGame[gameIdPerMarket[_market]])) {
            require(_outcome == HOME_WIN || _outcome == AWAY_WIN, "Bad outcome for two position game");
        } else {
            require(
                _outcome == HOME_WIN || _outcome == AWAY_WIN || _outcome == RESULT_DRAW,
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
        return gameCreated[_gameId].homeOdds;
    }

    function getOddsAwayTeam(bytes32 _gameId) public view returns (int24) {
        return gameCreated[_gameId].awayOdds;
    }

    function getOddsDraw(bytes32 _gameId) public view returns (int24) {
        return gameCreated[_gameId].drawOdds;
    }

    function getGameResolvedById(bytes32 _gameId) public view returns (GameResolve memory) {
        return gameResolved[_gameId];
    }

    function isSupportedMarketType(string memory _market) external pure returns (bool) {
        return
            keccak256(abi.encodePacked(_market)) == keccak256(abi.encodePacked("create")) ||
            keccak256(abi.encodePacked(_market)) == keccak256(abi.encodePacked("resolve"));
    }

    function isSameTeamOrTBD(string memory _teamA, string memory _teamB) public pure returns (bool) {
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

        emit GameCreted(requestId, _sportId, _game.gameId, _game, queues.lastCreated());
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

    function _createMarket(bytes32 _gameId) internal {
        GameCreate memory game = getGameCreatedById(_gameId);
        uint sportId = sportsIdPerGame[_gameId];
        uint numberOfPositions = _calculateNumberOfPositionsBasedOnSport(sportId);

        // create
        exoticManager.createCLMarket(
            _append(game.homeTeam, game.awayTeam),
            "chainlink_sports_data",
            game.startTime,
            fixedTicketPrice,
            withdrawalAllowed,
            _calculateTags(sportId),
            numberOfPositions,
            _positionsOfCreator(game, numberOfPositions),
            _createPhrases(game.homeTeam, game.awayTeam, numberOfPositions)
        );

        address marketAddress = exoticManager.getActiveMarketAddress(exoticManager.numberOfActiveMarkets() - 1);
        marketPerGameId[game.gameId] = marketAddress;
        gameIdPerMarket[marketAddress] = game.gameId;

        queues.dequeueGamesCreated();

        emit CreateSportsMarket(marketAddress, game.gameId, game);
    }

    function _resolveMarket(bytes32 _gameId) internal {
        GameResolve memory game = getGameResolvedById(_gameId);
        uint index = queues.unproccessedGamesIndex(_gameId);

        // it can return ZERO index, needs checking
        require(_gameId == queues.unproccessedGames(index), "Invalid Game ID");

        if (_isGameStatusResolved(game)) {
            uint _outcome = _callulateOutcome(game);

            exoticManager.resolveMarket(marketPerGameId[game.gameId], _outcome);
            marketResolved[marketPerGameId[game.gameId]] = true;

            _cleanStorageQueue(index);

            emit ResolveSportsMarket(marketPerGameId[game.gameId], game.gameId, _outcome);
        } else if (_isGameStatusCanceled(game)) {
            exoticManager.cancelMarket(marketPerGameId[game.gameId]);
            marketCanceled[marketPerGameId[game.gameId]] = true;

            _cleanStorageQueue(index);

            emit CancelSportsMarket(marketPerGameId[game.gameId], game.gameId);
        }
    }

    function _resolveMarketManually(address _market, uint _outcome) internal {
        uint index = queues.unproccessedGamesIndex(gameIdPerMarket[_market]);

        // it can return ZERO index, needs checking
        require(gameIdPerMarket[_market] == queues.unproccessedGames(index), "Invalid Game ID");

        exoticManager.resolveMarket(_market, _outcome);
        marketResolved[_market] = true;
        queues.removeItemUnproccessedGames(index);

        emit ResolveSportsMarket(_market, gameIdPerMarket[_market], _outcome);
    }

    function _cancelMarketManually(address _market) internal {
        uint index = queues.unproccessedGamesIndex(gameIdPerMarket[_market]);

        // it can return ZERO index, needs checking
        require(gameIdPerMarket[_market] == queues.unproccessedGames(index), "Invalid Game ID");

        exoticManager.cancelMarket(_market);
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

    function _createPhrases(
        string memory teamA,
        string memory teamB,
        uint _numberOfPositions
    ) internal pure returns (string[] memory) {
        string[] memory result = new string[](_numberOfPositions);

        result[0] = teamA;
        result[1] = teamB;
        if (_numberOfPositions > 2) {
            result[2] = "It will be a draw";
        }

        return result;
    }

    function _positionsOfCreator(GameCreate memory _game, uint _numberOfPositions) internal view returns (uint[] memory) {
        uint[] memory position = new uint[](_numberOfPositions);
        int[] memory usOdds = new int[](_numberOfPositions);

        usOdds[0] = _game.homeOdds;
        usOdds[1] = _game.awayOdds;

        if (_numberOfPositions > 2) {
            usOdds[2] = _game.drawOdds;
        }

        uint[] memory normalizeOdds = _calculateAndNormalizeOdds(usOdds);

        for (uint i = 0; i < normalizeOdds.length; i++) {
            position[i] = (normalizeOdds[i] * fixedsUSD) / 1e16;
        }

        return position;
    }

    function _calculateNumberOfPositionsBasedOnSport(uint _sportsId) internal view returns (uint) {
        return isSportTwoPositionsSport(_sportsId) ? 2 : 3;
    }

    function _calculateTags(uint _sportsId) internal pure returns (uint[] memory) {
        uint[] memory result = new uint[](1);
        result[0] = MIN_TAG_NUMBER + _sportsId;
        return result;
    }

    function _isGameReadyToBeResolved(GameResolve memory _game) internal pure returns (bool) {
        return _isGameStatusResolved(_game) || _isGameStatusCanceled(_game);
    }

    function _isGameStatusResolved(GameResolve memory _game) internal pure returns (bool) {
        // TODO
        // 8 : STATUS_FINAL - NBA
        // 11 : STATUS_FULL_TIME - Champions league 90 min
        // penalties, extra time ???
        return _game.statusId == 8 || _game.statusId == 11;
    }

    function _isGameStatusCanceled(GameResolve memory _game) internal pure returns (bool) {
        // 1 : STATUS_CANCELED
        // 2 : STATUS_DELAYED
        return _game.statusId == 1 || _game.statusId == 2;
    }

    function _callulateOutcome(GameResolve memory _game) internal pure returns (uint) {
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
            if (_americanOdds[i] >= 0) {
                odd = uint(_americanOdds[i]) / 100; // two decimal places from CL
                normalizedOdds[i] = ((100 * 1e16) / (odd + 100)) * 100;
            } else if (_americanOdds[i] < 0) {
                odd = uint(-_americanOdds[i]) / 100; // two decimal places from CL
                normalizedOdds[i] = ((odd * 1e16) / (odd + 100)) * 100;
            }
            totalOdds += normalizedOdds[i];
        }
        for (uint i = 0; i < normalizedOdds.length; i++) {
            normalizedOdds[i] = (1e16 * normalizedOdds[i]) / totalOdds;
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

    function setwoPositionSport(uint _sportId, bool _isTwoPosition) external onlyOwner {
        twoPositionSport[_sportId] = _isTwoPosition;
        emit TwoPositionSportChanged(_sportId, _isTwoPosition);
    }

    function setExoticManager(address _exoticManager) external onlyOwner {
        exoticManager = IExoticPositionalMarketManager(_exoticManager);
        emit NewExoticPositionalMarketManager(_exoticManager);
    }

    function setFixedTicketPrice(uint _fixedTicketPrice) external onlyOwner {
        fixedTicketPrice = _fixedTicketPrice;
        emit NewFixedTicketPrice(_fixedTicketPrice);
    }

    function setWithdrawalAllowed(bool _withdrawalAllowed) external onlyOwner {
        withdrawalAllowed = _withdrawalAllowed;
        emit NewWithdrawalAllowed(_withdrawalAllowed);
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

    function setFixedsUSD(uint _fixedsUSD) external onlyOwner {
        fixedsUSD = _fixedsUSD;
        emit NewFixedsUSD(_fixedsUSD);
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

    event GameCreted(bytes32 _requestId, uint _sportId, bytes32 _id, GameCreate _game, uint _queueIndex);
    event GameResolved(bytes32 _requestId, uint _sportId, bytes32 _id, GameResolve _game, uint _queueIndex);
    event CreateSportsMarket(address _marketAddress, bytes32 _id, GameCreate _game);
    event ResolveSportsMarket(address _marketAddress, bytes32 _id, uint _outcome);
    event CancelSportsMarket(address _marketAddress, bytes32 _id);
    event SupportedSportsChanged(uint _sportId, bool _isSupported);
    event TwoPositionSportChanged(uint _sportId, bool _isTwoPosition);
    event NewFixedTicketPrice(uint _fixedTicketPrice);
    event NewWithdrawalAllowed(bool _withdrawalAllowed);
    event NewExoticPositionalMarketManager(address _exoticManager);
    event NewWrapperAddress(address _wrapperAddress);
    event NewQueueAddress(GamesQueue _queues);
    event NewFixedsUSD(uint _fixedsUSD);
    event AddedIntoWhitelist(address _whitelistAddress);
}

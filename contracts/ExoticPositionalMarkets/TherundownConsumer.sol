// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

// interface
import "../interfaces/IExoticPositionalMarketManager.sol";

/** 
    Link to docs: https://market.link/nodes/098c3c5e-811d-4b8a-b2e3-d1806909c7d7/integrations
 */

contract TherundownConsumer is Initializable, ProxyOwned, ProxyPausable {
    /* ========== LIBRARIES ========== */

    using SafeERC20Upgradeable for IERC20Upgradeable;

    /* ========== CONSTANTS =========== */

    uint public constant RESULT_DRAW = 0;
    uint public constant HOME_WIN = 1;
    uint public constant AWAY_WIN = 2;
    uint public constant MIN_TAG_NUMBER = 9000;

    /* ========== CONSUMER STATE VARIABLES ========== */

    struct GameCreate {
        bytes32 gameId;
        uint256 startTime;
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

    // sports props
    mapping(uint => bool) public supportedSport;
    uint[] public twoPositionSports;

    // market props
    IExoticPositionalMarketManager public exoticManager;
    mapping(bytes32 => string[]) public phrasePerGameId;
    mapping(bytes32 => uint[]) public tagsPerGameId;
    mapping(bytes32 => address) public marketPerGameId;
    mapping(address => bool) public marketResolved;
    uint public fixedTicketPrice;
    bool public withdrawalAllowed;

    // wrapper
    address public wrapperAddress;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        uint[] memory _supportedSportIds,
        address _exoticManager,
        uint[] memory _twoPositionSports,
        uint _fixedTicketPrice,
        bool _withdrawalAllowed
    ) public initializer {
        setOwner(_owner);
        _populateSports(_supportedSportIds);
        twoPositionSports = _twoPositionSports;
        exoticManager = IExoticPositionalMarketManager(_exoticManager);
        fixedTicketPrice = _fixedTicketPrice;
        withdrawalAllowed = _withdrawalAllowed;
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

            // if already created market
            if (marketPerGameId[game.gameId] == address(0)) {
                _createMarket(game, _sportId);
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
        
            // if already resolved
            if (!marketResolved[marketPerGameId[game.gameId]]) {
                _resolveMarket(abi.decode(_games[i], (GameResolve)), _sportId);
            }
        }
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

    function getGameResolvedById(bytes32 _gameId) public view returns (GameResolve memory) {
        return gameResolved[_gameId];
    }

    function isSupportedMarket(string memory _market) external view returns (bool) {
        return
            keccak256(abi.encodePacked(_market)) == keccak256(abi.encodePacked("create")) ||
            keccak256(abi.encodePacked(_market)) == keccak256(abi.encodePacked("resolve"));
    }

    function isSupportedSport(uint _sportId) external view returns (bool) {
        return supportedSport[_sportId];
    }

    function isSportTwoPositionsSport(uint _sportsId) public view returns (bool) {
        for (uint256 i = 0; i < twoPositionSports.length; i++) {
            if (twoPositionSports[i] == _sportsId) {
                return true;
            }
        }
        return false;
    }

    function isGameInResolvedStatus(bytes32 _gameId) public view returns (bool) {
        return _isGameStatusResolved(getGameResolvedById(_gameId));
    }

    /* ========== INTERNALS ========== */

    function _populateSports(uint[] memory _supportedSportIds) internal {
        for (uint i; i < _supportedSportIds.length; i++) {
            supportedSport[_supportedSportIds[i]] = true;
        }
    }

    function _createMarket(GameCreate memory _game, uint _sportId) internal {
        gameCreated[_game.gameId] = _game;

        uint numberOfPositions = _calculateNumberOfPositionsBasedOnSport(_sportId);

        _calculateTags(_game.gameId, _sportId);
        _createPhrases(_game.gameId, _game.homeTeam, _game.awayTeam, numberOfPositions);

        // create
        exoticManager.createCLMarket(
            _append(_game.homeTeam, _game.awayTeam),
            "chainlink_sports_data",
            _game.startTime,
            fixedTicketPrice,
            withdrawalAllowed,
            tagsPerGameId[_game.gameId],
            numberOfPositions,
            phrasePerGameId[_game.gameId]
        );

        address marketAddress = exoticManager.getActiveMarketAddress(exoticManager.numOfActiveMarkets() - 1);
        marketPerGameId[_game.gameId] = marketAddress;

        emit GameCreted(marketAddress, _game.gameId, _game);
    }

    function _resolveMarket(GameResolve memory _game, uint _sportId) internal {
        gameResolved[_game.gameId] = _game;

        if (_isGameStatusResolved(_game)) {
            
            exoticManager.resolveMarket(marketPerGameId[_game.gameId], _callulateOutcome(_game));
            marketResolved[marketPerGameId[_game.gameId]] = true;

            emit GameResolved(marketPerGameId[_game.gameId], _game.gameId, _game);
        } // TODO else what if EXAMPLE: 1 : STATUS_CANCELED
    }

    function _append(string memory teamA, string memory teamB) internal pure returns (string memory) {
        return string(abi.encodePacked(teamA, " vs ", teamB));
    }

    function _createPhrases(
        bytes32 _gameId,
        string memory teamA,
        string memory teamB,
        uint _numberOfPositions
    ) internal {
        phrasePerGameId[_gameId].push(teamA);
        phrasePerGameId[_gameId].push(teamB);
        if (_numberOfPositions > 2) {
            phrasePerGameId[_gameId].push("It will be a draw");
        }
    }

    function _calculateNumberOfPositionsBasedOnSport(uint _sportsId) internal returns (uint) {
        return isSportTwoPositionsSport(_sportsId) ? 2 : 3;
    }

    function _calculateTags(bytes32 _gameId, uint _sportsId) internal {
        tagsPerGameId[_gameId].push(MIN_TAG_NUMBER + _sportsId);
    }

    function _isGameStatusResolved(GameResolve memory _game) internal pure returns (bool) {
        // TODO all resolved statuses if needed
        // 8 : STATUS_FINAL - NBA
        // 11 : STATUS_FULL_TIME - Champions league 90 min
        // penalties, extra time, over time ???
        return _game.statusId == 8 || _game.statusId == 11;
    }

    function _callulateOutcome(GameResolve memory _game) internal pure returns (uint) {
        if (_game.homeScore == _game.awayScore) {
            return RESULT_DRAW;
        }
        return _game.homeScore > _game.awayScore ? HOME_WIN : AWAY_WIN;
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    function addSupportedSport(uint _sportId) public onlyOwner {
        require(!supportedSport[_sportId], "Supported sport exists");
        supportedSport[_sportId] = true;
        emit SupportedSportsAdded(_sportId);
    }

    function removeSupportedSport(uint _sportId) public onlyOwner {
        require(supportedSport[_sportId], "Supported sport must exists");
        supportedSport[_sportId] = false;
        emit SupportedSportsRemoved(_sportId);
    }

    function setExoticManager(address _exoticManager) public onlyOwner {
        exoticManager = IExoticPositionalMarketManager(_exoticManager);
        emit NewExoticPositionalMarketManager(_exoticManager);
    }

    function setFixedTicketPrice(uint _fixedTicketPrice) public onlyOwner {
        fixedTicketPrice = _fixedTicketPrice;
        emit NewFixedTicketPrice(_fixedTicketPrice);
    }

    function setWithdrawalAllowed(bool _withdrawalAllowed) public onlyOwner {
        withdrawalAllowed = _withdrawalAllowed;
        emit NewWithdrawalAllowed(_withdrawalAllowed);
    }

    function setWrapperAddress(address _wrapperAddress) public onlyOwner {
        require(_wrapperAddress != address(0), "Invalid address");
        wrapperAddress = _wrapperAddress;
        emit NewWrapperAddress(_wrapperAddress);
    }

    /* ========== MODIFIERS ========== */

    modifier onlyWrapper() {
        require(msg.sender == wrapperAddress, "Only wrapper can call this function");
        _;
    }

    /* ========== EVENTS ========== */

    event GameCreted(address _marketAddress, bytes32 _id, GameCreate _game);
    event GameResolved(address _marketAddress, bytes32 _id, GameResolve _game);
    event SupportedSportsAdded(uint _sportId);
    event SupportedSportsRemoved(uint _sportId);
    event NewFixedTicketPrice(uint _fixedTicketPrice);
    event NewWithdrawalAllowed(bool _withdrawalAllowed);
    event NewExoticPositionalMarketManager(address _exoticManager);
    event NewWrapperAddress(address _wrapperAddress);
}

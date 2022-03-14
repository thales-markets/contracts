// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

/** 
    Link to docs: https://market.link/nodes/098c3c5e-811d-4b8a-b2e3-d1806909c7d7/integrations
 */

contract TherundownConsumer is Initializable, ProxyOwned, ProxyPausable {
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

    /* ========== CONSTRUCTOR ========== */

    function initialize(address _owner, uint[] memory _supportedSportIds) public initializer {
        setOwner(_owner);
        _populateSports(_supportedSportIds);
    }

    // Maps <RequestId, Result>
    mapping(bytes32 => bytes[]) public requestIdGamesCreated;
    mapping(bytes32 => bytes[]) public requestIdGamesResolved;

    // Maps <GameId, Game>
    mapping(bytes32 => GameCreate) public gameCreated;
    mapping(bytes32 => GameResolve) public gameResolved;

    mapping(uint => bool) public supportedSport;

    /* ========== CONSUMER FULFILL FUNCTIONS ========== */

    function fulfillGamesCreated(bytes32 _requestId, bytes[] memory _games) external {
        requestIdGamesCreated[_requestId] = _games;

        GameCreate memory game;

        for (uint i = 0; i < _games.length; i++) {
            game = abi.decode(requestIdGamesCreated[_requestId][i], (GameCreate));

            gameCreated[game.gameId] = game;

            emit GameCreted(game.gameId, game);
        }
    }

    function fulfillGamesResolved(bytes32 _requestId, bytes[] memory _games) external {
        requestIdGamesResolved[_requestId] = _games;

        GameResolve memory game;

        for (uint i = 0; i < _games.length; i++) {
            game = abi.decode(requestIdGamesResolved[_requestId][i], (GameResolve));

            gameResolved[game.gameId] = game;

            emit GameResolved(game.gameId, game);
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

    /* ========== INTERNALS ========== */

    function _populateSports(uint[] memory _supportedSportIds) internal {
        for (uint i; i < _supportedSportIds.length; i++) {
            supportedSport[_supportedSportIds[i]] = true;
        }
    }

    function _createMarket(bytes32 _gameId) internal {
        GameCreate memory game = getGameCreatedById(_gameId);

        // TODO call to ExoticPositionalMarketManager.createExoticMarket();
    }

    function _resolveMarket(bytes32 _gameId) internal {
        GameResolve memory game = getGameResolvedById(_gameId);

        // TODO call to ExoticPositionalMarketManager.resolveMarket()
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    function addSupportedSport(uint _sportId) public onlyOwner {
        require(!supportedSport[_sportId], "Supported sport exists");
        supportedSport[_sportId] = true;
        emit SupportedSportsAdded(_sportId);
    }

    /* ========== MODIFIERS ========== */

    /* ========== EVENTS ========== */

    event GameCreted(bytes32 __id, GameCreate _game);
    event GameResolved(bytes32 __id, GameResolve _game);
    event SupportedSportsAdded(uint _sportId);
}

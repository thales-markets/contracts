// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-4.4.1/utils/Strings.sol";

// internal
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

// interface
import "../../interfaces/ISportPositionalMarketManager.sol";
import "../../interfaces/ITherundownConsumerVerifier.sol";
import "../../interfaces/ITherundownConsumer.sol";
import "../../interfaces/IGamesOddsObtainer.sol";

/// @title Contract, which works on odds obtain
/// @author gruja
contract GamesOddsObtainer is Initializable, ProxyOwned, ProxyPausable {
    /* ========== CONSTANTS =========== */
    uint public constant MIN_TAG_NUMBER = 9000;
    uint public constant TAG_NUMBER_SPREAD = 10001;
    uint public constant TAG_NUMBER_TOTAL = 10002;
    uint public constant CANCELLED = 0;
    uint public constant HOME_WIN = 1;
    uint public constant AWAY_WIN = 2;

    /* ========== CONSUMER STATE VARIABLES ========== */

    ITherundownConsumer public consumer;
    ITherundownConsumerVerifier public verifier;
    ISportPositionalMarketManager public sportsManager;

    // game properties
    mapping(bytes32 => IGamesOddsObtainer.GameOdds) public gameOdds;
    mapping(bytes32 => IGamesOddsObtainer.GameOdds) public backupOdds;
    mapping(address => bool) public invalidOdds;
    mapping(bytes32 => uint) public oddsLastPulledForGame;
    mapping(address => bytes32) public gameIdPerChildMarket;
    mapping(uint => bool) public doesSportSupportSpreadAndTotal;

    // market props
    mapping(address => mapping(uint => address)) public mainMarketChildMarketIndex;
    mapping(address => uint) public numberOfChildMarkets;
    mapping(address => mapping(int16 => address)) public mainMarketSpreadChildMarket;
    mapping(address => mapping(uint24 => address)) public mainMarketTotalChildMarket;
    mapping(address => address) public childMarketMainMarket;
    mapping(address => int16) public childMarketSread;
    mapping(address => uint24) public childMarketTotal;
    mapping(address => address) public currentActiveTotalChildMarket;
    mapping(address => address) public currentActiveSpreadChildMarket;
    mapping(address => bool) public isSpreadChildMarket;
    mapping(address => bool) public childMarketCreated;
    mapping(address => bool) public normalizedOddsForMarketFulfilled;
    mapping(address => uint[]) public normalizedOddsForMarket;
    address public oddsReceiver;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        address _consumer,
        address _verifier,
        address _sportsManager,
        uint[] memory _supportedSportIds
    ) external initializer {
        setOwner(_owner);
        consumer = ITherundownConsumer(_consumer);
        verifier = ITherundownConsumerVerifier(_verifier);
        sportsManager = ISportPositionalMarketManager(_sportsManager);

        for (uint i; i < _supportedSportIds.length; i++) {
            doesSportSupportSpreadAndTotal[_supportedSportIds[i]] = true;
        }
    }

    /* ========== OBTAINER MAIN FUNCTIONS ========== */

    /// @notice main function for odds obtaining
    /// @param requestId chainlnink request ID
    /// @param _game game odds struct see @ IGamesOddsObtainer.GameOdds
    function obtainOdds(
        bytes32 requestId,
        IGamesOddsObtainer.GameOdds memory _game,
        uint _sportId
    ) external canUpdateOdds {
        if (_areOddsValid(_game)) {
            uint[] memory currentNormalizedOdd = getNormalizedOdds(_game.gameId);
            IGamesOddsObtainer.GameOdds memory currentOddsBeforeSave = gameOdds[_game.gameId];
            gameOdds[_game.gameId] = _game;
            oddsLastPulledForGame[_game.gameId] = block.timestamp;

            address _main = consumer.marketPerGameId(_game.gameId);
            _setNormalizedOdds(_main, _game.gameId, true);
            if (doesSportSupportSpreadAndTotal[_sportId]) {
                _obtainTotalAndSpreadOdds(_game, _main);
            }

            // if was paused and paused by invalid odds unpause
            if (sportsManager.isMarketPaused(_main)) {
                if (invalidOdds[_main] || consumer.isPausedByCanceledStatus(_main)) {
                    invalidOdds[_main] = false;
                    consumer.setPausedByCanceledStatus(_main, false);
                    if (
                        !verifier.areOddsArrayInThreshold(
                            _sportId,
                            currentNormalizedOdd,
                            normalizedOddsForMarket[_main],
                            consumer.isSportTwoPositionsSport(_sportId)
                        )
                    ) {
                        backupOdds[_game.gameId] = currentOddsBeforeSave;
                        emit OddsCircuitBreaker(_main, _game.gameId);
                    } else {
                        _pauseOrUnpauseMarkets(_game, _main, false, true);
                    }
                }
            } else if (
                //if market is not paused but odd are not in threshold, pause parket
                !sportsManager.isMarketPaused(_main) &&
                !verifier.areOddsArrayInThreshold(
                    _sportId,
                    currentNormalizedOdd,
                    normalizedOddsForMarket[_main],
                    consumer.isSportTwoPositionsSport(_sportId)
                )
            ) {
                _pauseOrUnpauseMarkets(_game, _main, true, true);
                _pauseOrUnpausePlayerProps(_main, true, false, true);
                backupOdds[_game.gameId] = currentOddsBeforeSave;
                emit OddsCircuitBreaker(_main, _game.gameId);
            }
            emit GameOddsAdded(requestId, _game.gameId, _game, normalizedOddsForMarket[_main]);
        } else {
            address _main = consumer.marketPerGameId(_game.gameId);
            if (!sportsManager.isMarketPaused(_main)) {
                invalidOdds[_main] = true;
                _pauseOrUnpauseMarkets(_game, _main, true, true);
                _pauseOrUnpausePlayerProps(_main, true, true, false);
            }

            emit InvalidOddsForMarket(requestId, _main, _game.gameId, _game);
        }
    }

    /// @notice set first odds on creation
    /// @param _gameId game id
    /// @param _homeOdds home odds for a game
    /// @param _awayOdds away odds for a game
    /// @param _drawOdds draw odds for a game
    function setFirstOdds(
        bytes32 _gameId,
        int24 _homeOdds,
        int24 _awayOdds,
        int24 _drawOdds
    ) external onlyConsumer {
        gameOdds[_gameId] = IGamesOddsObtainer.GameOdds(_gameId, _homeOdds, _awayOdds, _drawOdds, 0, 0, 0, 0, 0, 0, 0, 0);
        oddsLastPulledForGame[_gameId] = block.timestamp;
    }

    /// @notice set first odds on creation market
    /// @param _gameId game id
    /// @param _market market
    function setFirstNormalizedOdds(bytes32 _gameId, address _market) external onlyConsumer {
        _setNormalizedOdds(_market, _gameId, true);
    }

    /// @notice set backup odds to be main odds
    /// @param _gameId game id which is using backup odds
    function setBackupOddsAsMainOddsForGame(bytes32 _gameId) external onlyConsumer {
        gameOdds[_gameId] = backupOdds[_gameId];
        address _main = consumer.marketPerGameId(_gameId);
        _setNormalizedOdds(_main, _gameId, true);
        emit GameOddsAdded(
            _gameId, // // no req. from CL (manual cancel) so just put gameID
            _gameId,
            gameOdds[_gameId],
            normalizedOddsForMarket[_main]
        );
    }

    /// @notice pause/unpause all child markets
    /// @param _main parent market for which we are pause/unpause child markets
    /// @param _flag pause -> true, unpause -> false
    function pauseUnpauseChildMarkets(address _main, bool _flag) external onlyConsumer {
        // number of childs more then 0
        for (uint i = 0; i < numberOfChildMarkets[_main]; i++) {
            consumer.pauseOrUnpauseMarket(mainMarketChildMarketIndex[_main][i], _flag);
        }
    }

    /// @notice pause/unpause current active child markets
    /// @param _gameId game id for spread and totals checking
    /// @param _main parent market for which we are pause/unpause child markets
    /// @param _flag pause -> true, unpause -> false
    function pauseUnpauseCurrentActiveChildMarket(
        bytes32 _gameId,
        address _main,
        bool _flag
    ) external onlyConsumer {
        _pauseOrUnpauseMarkets(gameOdds[_gameId], _main, _flag, true);
    }

    function setChildMarketGameId(bytes32 gameId, address market) external onlyManager {
        consumer.setGameIdPerChildMarket(gameId, market);
    }

    /// @notice resolve all child markets
    /// @param _main parent market for which we are resolving
    /// @param _outcome poitions thet is winning (homw, away, cancel)
    /// @param _homeScore points that home team score
    /// @param _awayScore points that away team score
    function resolveChildMarkets(
        address _main,
        uint _outcome,
        uint8 _homeScore,
        uint8 _awayScore
    ) external onlyConsumer {
        for (uint i = 0; i < numberOfChildMarkets[_main]; i++) {
            address child = mainMarketChildMarketIndex[_main][i];
            if (_outcome == CANCELLED) {
                sportsManager.resolveMarket(child, _outcome);
            } else if (isSpreadChildMarket[child]) {
                _resolveMarketSpread(child, uint16(_homeScore), uint16(_awayScore));
            } else {
                _resolveMarketTotal(child, uint24(_homeScore), uint24(_awayScore));
            }
        }
    }

    /* ========== VIEW FUNCTIONS ========== */

    /// @notice view function which returns normalized odds up to 100 (Example: 50-40-10)
    /// @param _gameId game id for which game is looking
    /// @return uint[] odds array normalized
    function getNormalizedOdds(bytes32 _gameId) public view returns (uint[] memory) {
        address market = consumer.marketPerGameId(_gameId);
        return
            normalizedOddsForMarketFulfilled[market]
                ? normalizedOddsForMarket[market]
                : getNormalizedOddsFromGameOddsStruct(_gameId);
    }

    /// @notice view function which returns normalized odds (spread or total) up to 100 (Example: 55-45)
    /// @param _market market
    /// @return uint[] odds array normalized
    function getNormalizedChildOdds(address _market) public view returns (uint[] memory) {
        return
            normalizedOddsForMarketFulfilled[_market]
                ? normalizedOddsForMarket[_market]
                : getNormalizedChildOddsFromGameOddsStruct(_market);
    }

    /// @notice view function which returns normalized odds up to 100 (Example: 50-50)
    /// @param _market market
    /// @return uint[] odds array normalized
    function getNormalizedOddsForMarket(address _market) public view returns (uint[] memory) {
        return getNormalizedChildOdds(_market);
    }

    /// @param _gameId game id for which game is looking
    /// @return uint[] odds array normalized
    function getNormalizedOddsFromGameOddsStruct(bytes32 _gameId) public view returns (uint[] memory) {
        int[] memory odds = new int[](3);
        odds[0] = gameOdds[_gameId].homeOdds;
        odds[1] = gameOdds[_gameId].awayOdds;
        odds[2] = gameOdds[_gameId].drawOdds;
        return verifier.calculateAndNormalizeOdds(odds);
    }

    /// @notice view function which returns normalized odds (spread or total) up to 100 (Example: 55-45)
    /// @param _market market
    /// @return uint[] odds array normalized
    function getNormalizedChildOddsFromGameOddsStruct(address _market) public view returns (uint[] memory) {
        bytes32 gameId = gameIdPerChildMarket[_market];
        int[] memory odds = new int[](2);
        odds[0] = isSpreadChildMarket[_market] ? gameOdds[gameId].spreadHomeOdds : gameOdds[gameId].totalOverOdds;
        odds[1] = isSpreadChildMarket[_market] ? gameOdds[gameId].spreadAwayOdds : gameOdds[gameId].totalUnderOdds;
        return verifier.calculateAndNormalizeOdds(odds);
    }

    /// @notice function which retrievers all markert addresses for given parent market
    /// @param _parent parent market
    /// @return address[] child addresses
    function getAllChildMarketsFromParent(address _parent) external view returns (address[] memory) {
        address[] memory allMarkets = new address[](numberOfChildMarkets[_parent]);
        for (uint i = 0; i < numberOfChildMarkets[_parent]; i++) {
            allMarkets[i] = mainMarketChildMarketIndex[_parent][i];
        }
        return allMarkets;
    }

    /// @notice function which retrievers all markert addresses for given parent market
    /// @param _parent parent market
    /// @return totalsMarket totals child address
    /// @return spreadsMarket spread child address
    function getActiveChildMarketsFromParent(address _parent)
        external
        view
        returns (address totalsMarket, address spreadsMarket)
    {
        totalsMarket = currentActiveTotalChildMarket[_parent];
        spreadsMarket = currentActiveSpreadChildMarket[_parent];
    }

    /// @notice are odds valid or not
    /// @param _gameId game id for which game is looking
    /// @param _useBackup see if looking at backupOdds
    /// @return bool true/false (valid or not)
    function areOddsValid(bytes32 _gameId, bool _useBackup) external view returns (bool) {
        return _useBackup ? _areOddsValid(backupOdds[_gameId]) : _areOddsValid(gameOdds[_gameId]);
    }

    /// @notice view function which returns odds
    /// @param _gameId game id
    /// @return spreadHome points difference between home and away
    /// @return spreadAway  points difference between home and away
    /// @return totalOver  points total in a game over limit
    /// @return totalUnder  points total in game under limit
    function getLinesForGame(bytes32 _gameId)
        public
        view
        returns (
            int16,
            int16,
            uint24,
            uint24
        )
    {
        return (
            gameOdds[_gameId].spreadHome,
            gameOdds[_gameId].spreadAway,
            gameOdds[_gameId].totalOver,
            gameOdds[_gameId].totalUnder
        );
    }

    /// @notice view function which returns odds
    /// @param _gameId game id
    /// @return homeOdds moneyline odd in a two decimal places
    /// @return awayOdds moneyline odd in a two decimal places
    /// @return drawOdds moneyline odd in a two decimal places
    /// @return spreadHomeOdds moneyline odd in a two decimal places
    /// @return spreadAwayOdds moneyline odd in a two decimal places
    /// @return totalOverOdds moneyline odd in a two decimal places
    /// @return totalUnderOdds moneyline odd in a two decimal places
    function getOddsForGame(bytes32 _gameId)
        public
        view
        returns (
            int24,
            int24,
            int24,
            int24,
            int24,
            int24,
            int24
        )
    {
        return (
            gameOdds[_gameId].homeOdds,
            gameOdds[_gameId].awayOdds,
            gameOdds[_gameId].drawOdds,
            gameOdds[_gameId].spreadHomeOdds,
            gameOdds[_gameId].spreadAwayOdds,
            gameOdds[_gameId].totalOverOdds,
            gameOdds[_gameId].totalUnderOdds
        );
    }

    /* ========== INTERNALS ========== */

    function _areOddsValid(IGamesOddsObtainer.GameOdds memory _game) internal view returns (bool) {
        return
            verifier.areOddsValid(
                consumer.isSportTwoPositionsSport(consumer.sportsIdPerGame(_game.gameId)),
                _game.homeOdds,
                _game.awayOdds,
                _game.drawOdds
            );
    }

    function _obtainTotalAndSpreadOdds(IGamesOddsObtainer.GameOdds memory _game, address _main) internal {
        if (_areTotalOddsValid(_game)) {
            _obtainSpreadTotal(_game, _main, false);
            emit GamedOddsAddedChild(
                _game.gameId,
                currentActiveTotalChildMarket[_main],
                _game,
                getNormalizedChildOdds(currentActiveTotalChildMarket[_main]),
                TAG_NUMBER_TOTAL
            );
        } else {
            _pauseTotalSpreadMarkets(_game, false);
        }
        if (_areSpreadOddsValid(_game)) {
            _obtainSpreadTotal(_game, _main, true);
            emit GamedOddsAddedChild(
                _game.gameId,
                currentActiveSpreadChildMarket[_main],
                _game,
                getNormalizedChildOdds(currentActiveSpreadChildMarket[_main]),
                TAG_NUMBER_SPREAD
            );
        } else {
            _pauseTotalSpreadMarkets(_game, true);
        }
    }

    function _areTotalOddsValid(IGamesOddsObtainer.GameOdds memory _game) internal view returns (bool) {
        return verifier.areTotalOddsValid(_game.totalOver, _game.totalOverOdds, _game.totalUnder, _game.totalUnderOdds);
    }

    function _areSpreadOddsValid(IGamesOddsObtainer.GameOdds memory _game) internal view returns (bool) {
        return verifier.areSpreadOddsValid(_game.spreadHome, _game.spreadHomeOdds, _game.spreadAway, _game.spreadAwayOdds);
    }

    function _obtainSpreadTotal(
        IGamesOddsObtainer.GameOdds memory _game,
        address _main,
        bool _isSpread
    ) internal {
        bool isNewMarket = numberOfChildMarkets[_main] == 0;

        address currentActiveChildMarket = _isSpread
            ? currentActiveSpreadChildMarket[_main]
            : currentActiveTotalChildMarket[_main];

        address currentMarket = _isSpread
            ? mainMarketSpreadChildMarket[_main][_game.spreadHome]
            : mainMarketTotalChildMarket[_main][_game.totalOver];

        if (isNewMarket || currentMarket == address(0)) {
            address newMarket = _createMarketSpreadTotalMarket(
                _game.gameId,
                _main,
                _isSpread,
                _game.spreadHome,
                _game.totalOver
            );

            _setCurrentChildMarkets(_main, newMarket, _isSpread);

            if (currentActiveChildMarket != address(0)) {
                consumer.pauseOrUnpauseMarket(currentActiveChildMarket, true);
            }
            _setNormalizedOdds(newMarket, _game.gameId, false);
        } else if (currentMarket != currentActiveChildMarket) {
            consumer.pauseOrUnpauseMarket(currentMarket, false);
            consumer.pauseOrUnpauseMarket(currentActiveChildMarket, true);
            _setCurrentChildMarkets(_main, currentMarket, _isSpread);
            _setNormalizedOdds(currentMarket, _game.gameId, false);
        } else {
            consumer.pauseOrUnpauseMarket(currentActiveChildMarket, false);
            _setNormalizedOdds(currentActiveChildMarket, _game.gameId, false);
        }
    }

    function _pauseOrUnpausePlayerProps(
        address _market,
        bool _pause,
        bool _invalidOdds,
        bool _circuitBreaker
    ) internal {
        consumer.pauseOrUnpauseMarketForPlayerProps(_market, _pause, _invalidOdds, _circuitBreaker);
    }

    function _setNormalizedOdds(
        address _market,
        bytes32 _gameId,
        bool _isParent
    ) internal {
        normalizedOddsForMarket[_market] = _isParent
            ? getNormalizedOddsFromGameOddsStruct(_gameId)
            : getNormalizedChildOddsFromGameOddsStruct(_market);
        normalizedOddsForMarketFulfilled[_market] = true;
    }

    function _createMarketSpreadTotalMarket(
        bytes32 _gameId,
        address _mainMarket,
        bool _isSpread,
        int16 _spreadHome,
        uint24 _totalOver
    ) internal returns (address _childMarket) {
        // create
        uint[] memory tags = _calculateTags(consumer.sportsIdPerGame(_gameId), _isSpread);
        sportsManager.createMarket(
            _gameId,
            _append(_gameId, _isSpread, _spreadHome, _totalOver), // gameLabel
            consumer.getGameCreatedById(_gameId).startTime, //maturity
            0, //initialMint
            2, // always two positions for spread/total
            tags, //tags
            true, // is child
            _mainMarket
        );

        _childMarket = sportsManager.getActiveMarketAddress(sportsManager.numActiveMarkets() - 1);

        // adding child markets
        _setChildMarkets(_gameId, _mainMarket, _childMarket, _isSpread, _spreadHome, _totalOver, tags[1]);
    }

    function _calculateTags(uint _sportsId, bool _isSpread) internal pure returns (uint[] memory) {
        uint[] memory result = new uint[](2);
        result[0] = MIN_TAG_NUMBER + _sportsId;
        result[1] = _isSpread ? TAG_NUMBER_SPREAD : TAG_NUMBER_TOTAL;
        return result;
    }

    function _append(
        bytes32 _gameId,
        bool _isSpread,
        int16 _spreadHome,
        uint24 _totalOver
    ) internal view returns (string memory) {
        string memory teamVsTeam = string(
            abi.encodePacked(
                consumer.getGameCreatedById(_gameId).homeTeam,
                " vs ",
                consumer.getGameCreatedById(_gameId).awayTeam
            )
        );
        if (_isSpread) {
            return string(abi.encodePacked(teamVsTeam, "(", _parseSpread(_spreadHome), ")"));
        } else {
            return string(abi.encodePacked(teamVsTeam, " - ", Strings.toString(_totalOver)));
        }
    }

    function _parseSpread(int16 _spreadHome) internal pure returns (string memory) {
        return
            _spreadHome > 0
                ? Strings.toString(uint16(_spreadHome))
                : string(abi.encodePacked("-", Strings.toString(uint16(_spreadHome * (-1)))));
    }

    function _pauseOrUnpauseMarkets(
        IGamesOddsObtainer.GameOdds memory _game,
        address _main,
        bool _flag,
        bool _unpauseMain
    ) internal {
        if (_unpauseMain) {
            consumer.pauseOrUnpauseMarket(_main, _flag);
        }

        if (numberOfChildMarkets[_main] > 0) {
            if (_flag) {
                for (uint i = 0; i < numberOfChildMarkets[_main]; i++) {
                    consumer.pauseOrUnpauseMarket(mainMarketChildMarketIndex[_main][i], _flag);
                }
            } else {
                if (_areTotalOddsValid(_game)) {
                    address totalChildMarket = mainMarketTotalChildMarket[_main][_game.totalOver];
                    if (totalChildMarket == address(0)) {
                        address newMarket = _createMarketSpreadTotalMarket(
                            _game.gameId,
                            _main,
                            false,
                            _game.spreadHome,
                            _game.totalOver
                        );
                        _setCurrentChildMarkets(_main, newMarket, false);
                    } else {
                        consumer.pauseOrUnpauseMarket(totalChildMarket, _flag);
                        _setCurrentChildMarkets(_main, totalChildMarket, false);
                    }
                }
                if (_areSpreadOddsValid(_game)) {
                    address spreadChildMarket = mainMarketSpreadChildMarket[_main][_game.spreadHome];
                    if (spreadChildMarket == address(0)) {
                        address newMarket = _createMarketSpreadTotalMarket(
                            _game.gameId,
                            _main,
                            true,
                            _game.spreadHome,
                            _game.totalOver
                        );
                        _setCurrentChildMarkets(_main, newMarket, true);
                    } else {
                        consumer.pauseOrUnpauseMarket(spreadChildMarket, _flag);
                        _setCurrentChildMarkets(_main, spreadChildMarket, true);
                    }
                }
            }
        }
    }

    function _pauseTotalSpreadMarkets(IGamesOddsObtainer.GameOdds memory _game, bool _isSpread) internal {
        address _main = consumer.marketPerGameId(_game.gameId);
        // in number of childs more then 0
        if (numberOfChildMarkets[_main] > 0) {
            for (uint i = 0; i < numberOfChildMarkets[_main]; i++) {
                address _child = mainMarketChildMarketIndex[_main][i];
                if (isSpreadChildMarket[_child] == _isSpread) {
                    consumer.pauseOrUnpauseMarket(_child, true);
                }
            }
        }
    }

    function _setCurrentChildMarkets(
        address _main,
        address _child,
        bool _isSpread
    ) internal {
        if (_isSpread) {
            currentActiveSpreadChildMarket[_main] = _child;
        } else {
            currentActiveTotalChildMarket[_main] = _child;
        }
    }

    function _setChildMarkets(
        bytes32 _gameId,
        address _main,
        address _child,
        bool _isSpread,
        int16 _spreadHome,
        uint24 _totalOver,
        uint _type
    ) internal {
        consumer.setGameIdPerChildMarket(_gameId, _child);
        gameIdPerChildMarket[_child] = _gameId;
        childMarketCreated[_child] = true;
        // adding child markets
        childMarketMainMarket[_child] = _main;
        mainMarketChildMarketIndex[_main][numberOfChildMarkets[_main]] = _child;
        numberOfChildMarkets[_main] = numberOfChildMarkets[_main] + 1;
        if (_isSpread) {
            mainMarketSpreadChildMarket[_main][_spreadHome] = _child;
            childMarketSread[_child] = _spreadHome;
            currentActiveSpreadChildMarket[_main] = _child;
            isSpreadChildMarket[_child] = true;
            emit CreateChildSpreadSportsMarket(_main, _child, _gameId, _spreadHome, getNormalizedChildOdds(_child), _type);
        } else {
            mainMarketTotalChildMarket[_main][_totalOver] = _child;
            childMarketTotal[_child] = _totalOver;
            currentActiveTotalChildMarket[_main] = _child;
            emit CreateChildTotalSportsMarket(_main, _child, _gameId, _totalOver, getNormalizedChildOdds(_child), _type);
        }
    }

    function _resolveMarketTotal(
        address _child,
        uint24 _homeScore,
        uint24 _awayScore
    ) internal {
        uint24 totalLine = childMarketTotal[_child];

        uint outcome = (_homeScore + _awayScore) * 100 > totalLine ? HOME_WIN : (_homeScore + _awayScore) * 100 < totalLine
            ? AWAY_WIN
            : CANCELLED;

        sportsManager.resolveMarket(_child, outcome);
        emit ResolveChildMarket(_child, outcome, childMarketMainMarket[_child], _homeScore, _awayScore);
    }

    function _resolveMarketSpread(
        address _child,
        uint16 _homeScore,
        uint16 _awayScore
    ) internal {
        int16 homeScoreWithSpread = int16(_homeScore) * 100 + childMarketSread[_child];
        int16 newAwayScore = int16(_awayScore) * 100;

        uint outcome = homeScoreWithSpread > newAwayScore ? HOME_WIN : homeScoreWithSpread < newAwayScore
            ? AWAY_WIN
            : CANCELLED;
        sportsManager.resolveMarket(_child, outcome);
        emit ResolveChildMarket(_child, outcome, childMarketMainMarket[_child], uint24(_homeScore), uint24(_awayScore));
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    /// @notice sets consumer, verifier, manager address
    /// @param _consumer consumer address
    /// @param _verifier verifier address
    /// @param _sportsManager sport manager address
    function setContracts(
        address _consumer,
        address _verifier,
        address _sportsManager,
        address _receiver
    ) external onlyOwner {
        consumer = ITherundownConsumer(_consumer);
        verifier = ITherundownConsumerVerifier(_verifier);
        sportsManager = ISportPositionalMarketManager(_sportsManager);
        oddsReceiver = _receiver;

        emit NewContractAddresses(_consumer, _verifier, _sportsManager, _receiver);
    }

    /// @notice sets if sport is suported or not (delete from supported sport)
    /// @param _sportId sport id which needs to be supported or not
    /// @param _isSupported true/false (supported or not)
    function setSupportedSportForTotalAndSpread(uint _sportId, bool _isSupported) external onlyOwner {
        doesSportSupportSpreadAndTotal[_sportId] = _isSupported;
        emit SupportedSportForTotalAndSpreadAdded(_sportId, _isSupported);
    }

    /* ========== MODIFIERS ========== */

    modifier canUpdateOdds() {
        require(msg.sender == address(consumer) || msg.sender == oddsReceiver, "Invalid sender");
        _;
    }

    modifier onlyConsumer() {
        require(msg.sender == address(consumer), "Only consumer");
        _;
    }

    modifier onlyManager() {
        require(msg.sender == address(sportsManager), "Only manager");
        _;
    }

    /* ========== EVENTS ========== */

    event GameOddsAdded(bytes32 _requestId, bytes32 _id, IGamesOddsObtainer.GameOdds _game, uint[] _normalizedOdds);
    event GamedOddsAddedChild(
        bytes32 _id,
        address _market,
        IGamesOddsObtainer.GameOdds _game,
        uint[] _normalizedChildOdds,
        uint _type
    );
    event InvalidOddsForMarket(bytes32 _requestId, address _marketAddress, bytes32 _id, IGamesOddsObtainer.GameOdds _game);
    event OddsCircuitBreaker(address _marketAddress, bytes32 _id);
    event NewContractAddresses(address _consumer, address _verifier, address _sportsManager, address _receiver);
    event CreateChildSpreadSportsMarket(
        address _main,
        address _child,
        bytes32 _id,
        int16 _spread,
        uint[] _normalizedOdds,
        uint _type
    );
    event CreateChildTotalSportsMarket(
        address _main,
        address _child,
        bytes32 _id,
        uint24 _total,
        uint[] _normalizedOdds,
        uint _type
    );
    event SupportedSportForTotalAndSpreadAdded(uint _sportId, bool _isSupported);
    event ResolveChildMarket(address _child, uint _outcome, address _main, uint24 _homeScore, uint24 _awayScore);
}

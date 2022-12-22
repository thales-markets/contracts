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
    ) external onlyConsumer {
        if (_areOddsValid(_game)) {
            uint[] memory currentNormalizedOdd = getNormalizedOdds(_game.gameId);
            IGamesOddsObtainer.GameOdds memory currentOddsBeforeSave = gameOdds[_game.gameId];
            gameOdds[_game.gameId] = _game;
            oddsLastPulledForGame[_game.gameId] = block.timestamp;

            address _main = consumer.marketPerGameId(_game.gameId);

            if (doesSportSupportSpreadAndTotal[_sportId]) {
                _obtainTotalAndSpreadOdds(_game, _main);
            }

            // if was paused and paused by invalid odds unpause
            if (sportsManager.isMarketPaused(_main)) {
                if (invalidOdds[_main] || consumer.isPausedByCanceledStatus(_main)) {
                    invalidOdds[_main] = false;
                    consumer.setPausedByCanceledStatus(_main, false);
                    _pauseAllMarkets(_game, _main, false, true);
                }
            } else if (
                //if market is not paused but odd are not in threshold, pause parket
                !sportsManager.isMarketPaused(_main) &&
                !verifier.areOddsArrayInThreshold(
                    _sportId,
                    currentNormalizedOdd,
                    getNormalizedOdds(_game.gameId),
                    consumer.isSportTwoPositionsSport(_sportId)
                )
            ) {
                _pauseAllMarkets(_game, _main, true, true);
                backupOdds[_game.gameId] = currentOddsBeforeSave;
                emit OddsCircuitBreaker(_main, _game.gameId);
            }
            emit GameOddsAdded(requestId, _game.gameId, _game, getNormalizedOdds(_game.gameId));
        } else {
            address _main = consumer.marketPerGameId(_game.gameId);
            if (!sportsManager.isMarketPaused(_main)) {
                invalidOdds[_main] = true;
                _pauseAllMarkets(_game, _main, true, true);
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

    /// @notice set backup odds to be main odds
    /// @param _gameId game id which is using backup odds
    function setBackupOddsAsMainOddsForGame(bytes32 _gameId) external onlyConsumer {
        gameOdds[_gameId] = backupOdds[_gameId];
        emit GameOddsAdded(
            _gameId, // // no req. from CL (manual cancel) so just put gameID
            _gameId,
            gameOdds[_gameId],
            getNormalizedOdds(_gameId)
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
        if (_outcome == CANCELLED) {
            for (uint i = 0; i < numberOfChildMarkets[_main]; i++) {
                address child = mainMarketChildMarketIndex[_main][i];
                sportsManager.resolveMarket(child, _outcome);
            }
        } else {
            for (uint i = 0; i < numberOfChildMarkets[_main]; i++) {
                address child = mainMarketChildMarketIndex[_main][i];
                if (isSpreadChildMarket[child]) {
                    _resolveMarketSpread(child, uint16(_homeScore), uint16(_awayScore));
                } else {
                    _resolveMarketTotal(child, uint24(_homeScore), uint24(_awayScore));
                }
            }
        }
    }

    /* ========== VIEW FUNCTIONS ========== */

    /// @notice view function which returns normalized odds up to 100 (Example: 50-40-10)
    /// @param _gameId game id for which game is looking
    /// @return uint[] odds array normalized
    function getNormalizedOdds(bytes32 _gameId) public view returns (uint[] memory) {
        int[] memory odds = new int[](3);
        odds[0] = gameOdds[_gameId].homeOdds;
        odds[1] = gameOdds[_gameId].awayOdds;
        odds[2] = gameOdds[_gameId].drawOdds;
        return verifier.calculateAndNormalizeOdds(odds);
    }

    /// @notice view function which returns normalized odds (spread or total) up to 100 (Example: 55-45)
    /// @param _market market
    /// @return uint[] odds array normalized
    function getNormalizedChildOdds(address _market) public view returns (uint[] memory) {
        bytes32 gameId = gameIdPerChildMarket[_market];
        int[] memory odds = new int[](2);
        odds[0] = isSpreadChildMarket[_market] ? gameOdds[gameId].spreadHomeOdds : gameOdds[gameId].totalOverOdds;
        odds[1] = isSpreadChildMarket[_market] ? gameOdds[gameId].spreadAwayOdds : gameOdds[gameId].totalUnderOdds;
        return verifier.calculateAndNormalizeOdds(odds);
    }

    /// @notice view function which returns normalized odds up to 100 (Example: 50-50)
    /// @param _market market
    /// @return uint[] odds array normalized
    function getNormalizedOddsForMarket(address _market) public view returns (uint[] memory) {
        return getNormalizedChildOdds(_market);
    }

    /// @notice function which retrievers all markert addresses for given parent market
    /// @param _parent parent market
    /// @return address[] child addresses
    function getAllChildMarketsFromParent(address _parent) public view returns (address[] memory) {
        address[] memory allMarkets = new address[](numberOfChildMarkets[_parent]);
        for (uint i = 0; i < numberOfChildMarkets[_parent]; i++) {
            allMarkets[i] = mainMarketChildMarketIndex[_parent][i];
        }
        return allMarkets;
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

    function _areTotalOddsValid(IGamesOddsObtainer.GameOdds memory _game) internal returns (bool) {
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
        if (_isSpread) {
            // no child market
            if (numberOfChildMarkets[_main] == 0) {
                _createMarketSpreadTotalMarket(_game.gameId, _main, true, _game.spreadHome, _game.totalOver);
                // new spread no market -> create new pause old
            } else if (mainMarketSpreadChildMarket[_main][_game.spreadHome] == address(0)) {
                if (currentActiveSpreadChildMarket[_main] != address(0)) {
                    consumer.pauseOrUnpauseMarket(currentActiveSpreadChildMarket[_main], true);
                }
                _createMarketSpreadTotalMarket(_game.gameId, _main, true, _game.spreadHome, _game.totalOver);
                // new spread arived, market exist -> unpause, pause old
            } else if (mainMarketSpreadChildMarket[_main][_game.spreadHome] != currentActiveSpreadChildMarket[_main]) {
                consumer.pauseOrUnpauseMarket(mainMarketSpreadChildMarket[_main][_game.spreadHome], false);
                consumer.pauseOrUnpauseMarket(currentActiveSpreadChildMarket[_main], true);
                _setCurrentChildMarkets(_main, mainMarketSpreadChildMarket[_main][_game.spreadHome], true);
            }
        } else {
            // no child market
            if (numberOfChildMarkets[_main] == 0) {
                _createMarketSpreadTotalMarket(_game.gameId, _main, _isSpread, _game.spreadHome, _game.totalOver);
                // new total no market -> create new pause old
            } else if (mainMarketTotalChildMarket[_main][_game.totalOver] == address(0)) {
                if (currentActiveTotalChildMarket[_main] != address(0)) {
                    consumer.pauseOrUnpauseMarket(currentActiveTotalChildMarket[_main], true);
                }
                _createMarketSpreadTotalMarket(_game.gameId, _main, _isSpread, _game.spreadHome, _game.totalOver);
                // new total arived, market exist -> unpause, pause old
            } else if (mainMarketTotalChildMarket[_main][_game.totalOver] != currentActiveTotalChildMarket[_main]) {
                consumer.pauseOrUnpauseMarket(mainMarketTotalChildMarket[_main][_game.totalOver], false);
                consumer.pauseOrUnpauseMarket(currentActiveTotalChildMarket[_main], true);
                _setCurrentChildMarkets(_main, mainMarketTotalChildMarket[_main][_game.totalOver], false);
            }
        }
    }

    function _createMarketSpreadTotalMarket(
        bytes32 _gameId,
        address _mainMarket,
        bool _isSpread,
        int16 _spreadHome,
        uint24 _totalOver
    ) internal {
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

        address _childMarket = sportsManager.getActiveMarketAddress(sportsManager.numActiveMarkets() - 1);

        // adding child markets
        _setChildMarkets(_gameId, _mainMarket, _childMarket, _isSpread, _spreadHome, _totalOver, tags[1]);
    }

    function _calculateTags(uint _sportsId, bool _isSpread) internal pure returns (uint[] memory) {
        uint[] memory result = new uint[](2);
        result[0] = MIN_TAG_NUMBER + _sportsId;
        result[1] = _isSpread ? TAG_NUMBER_SPREAD : TAG_NUMBER_TOTAL;
        return result;
    }

    // "homeTeam(450) vs awayTeam HOME/AWAY"
    // "homeTeam vs awayTeam - 20050 OVER/UNDER"
    function _append(
        bytes32 _gameId,
        bool _isSpread,
        int16 _spreadHome,
        uint24 _totalOver
    ) internal view returns (string memory) {
        return
            _isSpread
                ? string(
                    abi.encodePacked(
                        consumer.getGameCreatedById(_gameId).homeTeam,
                        "(",
                        _parseSpread(_spreadHome),
                        ")",
                        " vs ",
                        consumer.getGameCreatedById(_gameId).awayTeam
                    )
                )
                : string(
                    abi.encodePacked(
                        consumer.getGameCreatedById(_gameId).homeTeam,
                        " vs ",
                        consumer.getGameCreatedById(_gameId).awayTeam,
                        " - ",
                        Strings.toString(_totalOver)
                    )
                );
    }

    function _parseSpread(int16 _spreadHome) internal pure returns (string memory) {
        return
            _spreadHome > 0
                ? Strings.toString(uint16(_spreadHome))
                : string(abi.encodePacked("-", Strings.toString(uint16(_spreadHome * (-1)))));
    }

    function _pauseAllMarkets(
        IGamesOddsObtainer.GameOdds memory _game,
        address _main,
        bool _flag,
        bool _unpauseMain
    ) internal {
        if (_unpauseMain) {
            consumer.pauseOrUnpauseMarket(_main, _flag);
        }
        // in number of childs more then 0
        if (numberOfChildMarkets[_main] > 0) {
            // if pause pause all
            if (_flag) {
                for (uint i = 0; i < numberOfChildMarkets[_main]; i++) {
                    consumer.pauseOrUnpauseMarket(mainMarketChildMarketIndex[_main][i], _flag);
                }
                // if unpause check odds
            } else {
                if (_areTotalOddsValid(_game)) {
                    // if not exist create
                    if (mainMarketTotalChildMarket[_main][_game.totalOver] == address(0)) {
                        _createMarketSpreadTotalMarket(_game.gameId, _main, false, _game.spreadHome, _game.totalOver);
                        // if exist unpause
                    } else {
                        consumer.pauseOrUnpauseMarket(mainMarketTotalChildMarket[_main][_game.totalOver], _flag);
                        _setCurrentChildMarkets(_main, mainMarketTotalChildMarket[_main][_game.totalOver], false);
                    }
                }
                if (_areSpreadOddsValid(_game)) {
                    // if not exist create
                    if (mainMarketSpreadChildMarket[_main][_game.spreadHome] == address(0)) {
                        _createMarketSpreadTotalMarket(_game.gameId, _main, true, _game.spreadHome, _game.totalOver);
                        // if exist unpause
                    } else {
                        consumer.pauseOrUnpauseMarket(mainMarketSpreadChildMarket[_main][_game.spreadHome], _flag);
                        _setCurrentChildMarkets(_main, mainMarketSpreadChildMarket[_main][_game.spreadHome], true);
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
        if ((_homeScore + _awayScore) * 100 > totalLine) {
            sportsManager.resolveMarket(_child, HOME_WIN);
            emit ResolveChildMarket(_child, HOME_WIN, childMarketMainMarket[_child], _homeScore, _awayScore);
        } else if ((_homeScore + _awayScore) * 100 < totalLine) {
            sportsManager.resolveMarket(_child, AWAY_WIN);
            emit ResolveChildMarket(_child, AWAY_WIN, childMarketMainMarket[_child], _homeScore, _awayScore);
        } else {
            // total equal
            sportsManager.resolveMarket(_child, CANCELLED);
            emit ResolveChildMarket(_child, CANCELLED, childMarketMainMarket[_child], 0, 0);
        }
    }

    function _resolveMarketSpread(
        address _child,
        uint16 _homeScore,
        uint16 _awayScore
    ) internal {
        int16 spreadLine = childMarketSread[_child]; // can be negative

        uint16 homeScoreWithSpread = 0;
        if (spreadLine > 0) {
            // add on hometeam score
            homeScoreWithSpread = (_homeScore * 100) + uint16(spreadLine);
        } else {
            // sub on hometeam score
            homeScoreWithSpread = (_homeScore * 100) - uint16(spreadLine * (-1));
        }

        uint16 newAwayScore = _awayScore * 100;

        if (homeScoreWithSpread > newAwayScore) {
            sportsManager.resolveMarket(_child, HOME_WIN);
            emit ResolveChildMarket(_child, HOME_WIN, childMarketMainMarket[_child], uint24(_homeScore), uint24(_awayScore));
        } else if (homeScoreWithSpread < newAwayScore) {
            sportsManager.resolveMarket(_child, AWAY_WIN);
            emit ResolveChildMarket(_child, AWAY_WIN, childMarketMainMarket[_child], uint24(_homeScore), uint24(_awayScore));
        } else {
            // spread equal
            sportsManager.resolveMarket(_child, CANCELLED);
            emit ResolveChildMarket(_child, CANCELLED, childMarketMainMarket[_child], 0, 0);
        }
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    /// @notice sets consumer, verifier, manager address
    /// @param _consumer consumer address
    /// @param _verifier verifier address
    /// @param _sportsManager sport manager address
    function setContracts(
        address _consumer,
        address _verifier,
        address _sportsManager
    ) external onlyOwner {
        consumer = ITherundownConsumer(_consumer);
        verifier = ITherundownConsumerVerifier(_verifier);
        sportsManager = ISportPositionalMarketManager(_sportsManager);

        emit NewContractAddresses(_consumer, _verifier, _sportsManager);
    }

    /// @notice sets if sport is suported or not (delete from supported sport)
    /// @param _sportId sport id which needs to be supported or not
    /// @param _isSupported true/false (supported or not)
    function setSupportedSportForTotalAndSpread(uint _sportId, bool _isSupported) external onlyOwner {
        doesSportSupportSpreadAndTotal[_sportId] = _isSupported;
        emit SupportedSportForTotalAndSpreadAdded(_sportId, _isSupported);
    }

    /* ========== MODIFIERS ========== */

    modifier onlyConsumer() {
        require(msg.sender == address(consumer), "Only consumer");
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
    event NewContractAddresses(address _consumer, address _verifier, address _sportsManager);
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

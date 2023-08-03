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
import "../../interfaces/IGamesPlayerProps.sol";

/// @title Contract, which works on player props
/// @author gruja
contract GamesPlayerProps is Initializable, ProxyOwned, ProxyPausable {
    /* ========== CONSTANTS =========== */
    uint public constant MIN_TAG_NUMBER = 9000;
    uint public constant TAG_NUMBER_PLAYERS = 10010;
    uint public constant TAG_NUMBER_PLAYER_PROPS = 11000;
    uint public constant CANCELLED = 0;
    uint public constant HOME_WIN = 1;
    uint public constant AWAY_WIN = 2;

    /* ========== CONSUMER STATE VARIABLES ========== */

    ITherundownConsumer public consumer;
    ITherundownConsumerVerifier public verifier;
    ISportPositionalMarketManager public sportsManager;
    address public playerPropsReceiver;

    // game properties
    mapping(bytes32 => mapping(bytes32 => mapping(uint8 => IGamesPlayerProps.PlayerProps))) public playerProp;
    mapping(uint => bool) public doesSportSupportPlayerProps;
    mapping(address => bytes32) public gameIdPerChildMarket;
    mapping(address => bytes32) public playerIdPerChildMarket;
    mapping(address => uint8) public optionIdPerChildMarket;

    // market props
    mapping(address => mapping(uint => address)) public mainMarketChildMarketIndex;
    mapping(address => bool) public mainMarketPausedPlayerProps;
    mapping(address => uint) public numberOfChildMarkets;
    mapping(address => mapping(bytes32 => mapping(uint8 => mapping(uint => address))))
        public mainMarketChildMarketPerPlayerAndOptionIndex;
    mapping(address => mapping(bytes32 => mapping(uint8 => uint))) public numberOfChildMarketsPerPlayerAndOption;
    mapping(address => mapping(bytes32 => mapping(uint8 => mapping(uint16 => address))))
        public mainMarketPlayerOptionLineChildMarket;
    mapping(address => address) public childMarketMainMarket;
    mapping(address => mapping(bytes32 => mapping(uint8 => address))) public currentActiveChildMarketPerPlayerAndOption;
    mapping(address => uint[]) public normalizedOddsForMarket;
    mapping(address => bool) public normalizedOddsForMarketFulfilled;
    mapping(address => bool) public childMarketCreated;
    mapping(address => uint16) public childMarketLine;
    mapping(bytes32 => mapping(bytes32 => mapping(uint8 => bool))) public invalidOddsForPlayerProps;
    mapping(bytes32 => mapping(bytes32 => mapping(uint8 => bool))) public createFulfilledForPlayerProps;
    mapping(bytes32 => mapping(bytes32 => mapping(uint8 => bool))) public resolveFulfilledForPlayerProps;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        address _consumer,
        address _verifier,
        address _sportsManager,
        address _playerPropsReceiver,
        uint[] memory _supportedSportIds
    ) external initializer {
        setOwner(_owner);
        consumer = ITherundownConsumer(_consumer);
        verifier = ITherundownConsumerVerifier(_verifier);
        sportsManager = ISportPositionalMarketManager(_sportsManager);
        playerPropsReceiver = _playerPropsReceiver;

        for (uint i; i < _supportedSportIds.length; i++) {
            doesSportSupportPlayerProps[_supportedSportIds[i]] = true;
        }
    }

    /* ========== PLAYER PROPS MAIN FUNCTIONS ========== */

    /// @notice main function for player props
    /// @param _player player props struct see @ IGamesPlayerProps.PlayerProps
    /// @param _sportId sport id
    function obtainPlayerProps(IGamesPlayerProps.PlayerProps memory _player, uint _sportId) external canExecute {
        address _main = consumer.marketPerGameId(_player.gameId);
        // if main is created and not paused and also sport support player props
        if (_main != address(0) && doesSportSupportPlayerProps[_sportId]) {
            if (_areOddsAndLinesValidForPlayer(_player)) {
                if (invalidOddsForPlayerProps[_player.gameId][_player.playerId][_player.option]) {
                    invalidOddsForPlayerProps[_player.gameId][_player.playerId][_player.option] = false;
                }
                address playerPropsMarket = _obtainPlayerProps(_player, _main);
                playerProp[_player.gameId][_player.playerId][_player.option] = _player;
                mainMarketPausedPlayerProps[_main] = false;
                createFulfilledForPlayerProps[_player.gameId][_player.playerId][_player.option] = true;

                emit PlayerPropsAdded(
                    _player.gameId,
                    _player.playerId,
                    _player.option,
                    normalizedOddsForMarket[playerPropsMarket]
                );
            } else {
                invalidOddsForPlayerProps[_player.gameId][_player.playerId][_player.option] = true;
                _pauseMarketsForPlayerPropsForOption(_player, true);

                emit InvalidOddsForMarket(_main, _player.gameId, _player.playerId, _player.option);
            }
        }
    }

    /// @notice resolve playerProp
    /// @param _result object for resolve
    function resolvePlayerProps(IGamesPlayerProps.PlayerPropsResolver memory _result) external canExecute {
        // get main market
        address _main = consumer.marketPerGameId(_result.gameId);
        // all options for player
        for (uint i = 0; i < _result.options.length; i++) {
            //number of childs per option
            uint numberOfChildsPerOptions = numberOfChildMarketsPerPlayerAndOption[_main][_result.playerId][
                _result.options[i]
            ];
            // if it is resolved skip it
            if (!resolveFulfilledForPlayerProps[_result.gameId][_result.playerId][_result.options[i]]) {
                // resolve all per option
                for (uint j = 0; j < numberOfChildsPerOptions; j++) {
                    address child = mainMarketChildMarketPerPlayerAndOptionIndex[_main][_result.playerId][
                        _result.options[i]
                    ][j];
                    if (invalidOddsForPlayerProps[_result.gameId][_result.playerId][_result.options[i]]) {
                        consumer.pauseOrUnpauseMarket(child, false);
                    }
                    _resolveMarketForPlayer(child, _result.scores[i]);
                }
                resolveFulfilledForPlayerProps[_result.gameId][_result.playerId][_result.options[i]] = true;
            }
        }
    }

    /// @notice pause/unpause all markets for game
    /// @param _main parent market for which we are pause/unpause child markets
    /// @param _flag pause -> true, unpause -> false
    function pauseAllPlayerPropsMarketForMain(address _main, bool _flag) external onlyConsumer {
        mainMarketPausedPlayerProps[_main] = _flag;
        _pauseAllPlayerPropsMarket(_main, _flag);
    }

    /// @notice pause/unpause current active child markets
    /// @param _main parent market for which we are pause/unpause child markets
    function cancelPlayerPropsMarketForMain(address _main) external onlyConsumer {
        _cancelPlayerPropsMarket(_main);
    }

    /* ========== INTERNALS ========== */

    function _areOddsAndLinesValidForPlayer(IGamesPlayerProps.PlayerProps memory _player) internal view returns (bool) {
        return verifier.areOddsAndLinesValidForPlayer(_player.line, _player.overOdds, _player.underOdds);
    }

    function _obtainPlayerProps(IGamesPlayerProps.PlayerProps memory _player, address _main) internal returns (address) {
        bool isNewMarket = numberOfChildMarkets[_main] == 0;
        address currentActiveChildMarket = currentActiveChildMarketPerPlayerAndOption[_main][_player.playerId][
            _player.option
        ];
        address currentMarket = mainMarketPlayerOptionLineChildMarket[_main][_player.playerId][_player.option][_player.line];

        if (isNewMarket || currentMarket == address(0)) {
            address newMarket = _createMarketForPlayerProps(_player, _main);

            currentActiveChildMarketPerPlayerAndOption[_main][_player.playerId][_player.option] = newMarket;

            if (currentActiveChildMarket != address(0)) {
                consumer.pauseOrUnpauseMarket(currentActiveChildMarket, true);
            }
            _setNormalizedOdds(newMarket, _player.gameId, _player.playerId, _player.option);
            return newMarket;
        } else if (currentMarket != currentActiveChildMarket) {
            consumer.pauseOrUnpauseMarket(currentMarket, false);
            consumer.pauseOrUnpauseMarket(currentActiveChildMarket, true);
            currentActiveChildMarketPerPlayerAndOption[_main][_player.playerId][_player.option] = currentMarket;
            _setNormalizedOdds(currentMarket, _player.gameId, _player.playerId, _player.option);
            return currentMarket;
        } else {
            consumer.pauseOrUnpauseMarket(currentActiveChildMarket, false);
            _setNormalizedOdds(currentActiveChildMarket, _player.gameId, _player.playerId, _player.option);
            return currentActiveChildMarket;
        }
    }

    function _pauseMarketsForPlayerPropsForOption(IGamesPlayerProps.PlayerProps memory _player, bool _flag)
        internal
        returns (bool)
    {
        // get main market
        address _main = consumer.marketPerGameId(_player.gameId);
        //number of childs per option
        uint numberOfChildsPerOptions = numberOfChildMarketsPerPlayerAndOption[_main][_player.playerId][_player.option];
        // pause all per option
        for (uint j = 0; j < numberOfChildsPerOptions; j++) {
            address child = mainMarketChildMarketPerPlayerAndOptionIndex[_main][_player.playerId][_player.option][j];
            _pauseOrUnpauseMarket(child, _flag);
        }
    }

    function _pauseAllPlayerPropsMarket(address _main, bool _flag) internal {
        for (uint i = 0; i < numberOfChildMarkets[_main]; i++) {
            consumer.pauseOrUnpauseMarket(mainMarketChildMarketIndex[_main][i], _flag);
        }
    }

    function _cancelPlayerPropsMarket(address _main) internal {
        for (uint i = 0; i < numberOfChildMarkets[_main]; i++) {
            sportsManager.resolveMarket(mainMarketChildMarketIndex[_main][i], CANCELLED);
        }
    }

    function _pauseOrUnpauseMarket(address _market, bool _pause) internal {
        consumer.pauseOrUnpauseMarket(_market, _pause);
    }

    function _setNormalizedOdds(
        address _market,
        bytes32 _gameId,
        bytes32 _playerId,
        uint8 _option
    ) internal {
        normalizedOddsForMarket[_market] = getNormalizedOddsForPlayerProps(_gameId, _playerId, _option);
        normalizedOddsForMarketFulfilled[_market] = true;
    }

    function _createMarketForPlayerProps(IGamesPlayerProps.PlayerProps memory _player, address _mainMarket)
        internal
        returns (address _playerMarket)
    {
        // create
        uint[] memory tags = _calculateTags(consumer.sportsIdPerGame(_player.gameId), _player.option);
        sportsManager.createMarket(
            _player.gameId,
            _append(_player), // gameLabel
            consumer.getGameCreatedById(_player.gameId).startTime, //maturity
            0, //initialMint
            2, // always two positions for player props
            tags, //tags
            true, // is child
            _mainMarket
        );

        _playerMarket = sportsManager.getActiveMarketAddress(sportsManager.numActiveMarkets() - 1);

        // adding child markets
        _setChildMarkets(
            _player.gameId,
            _mainMarket,
            _playerMarket,
            _player.line,
            _player.playerId,
            _player.option,
            tags[2]
        );
    }

    function _append(IGamesPlayerProps.PlayerProps memory _player) internal view returns (string memory) {
        return
            string(
                abi.encodePacked(
                    _player.playerName,
                    " - ",
                    Strings.toString(_player.option),
                    " - ",
                    Strings.toString(_player.line)
                )
            );
    }

    function _calculateTags(uint _sportsId, uint8 _option) internal pure returns (uint[] memory) {
        uint[] memory result = new uint[](3);
        result[0] = MIN_TAG_NUMBER + _sportsId;
        result[1] = TAG_NUMBER_PLAYERS;
        result[2] = TAG_NUMBER_PLAYER_PROPS + _option;
        return result;
    }

    function _setChildMarkets(
        bytes32 _gameId,
        address _main,
        address _child,
        uint16 _line,
        bytes32 _playerId,
        uint8 _option,
        uint _type
    ) internal {
        consumer.setGameIdPerChildMarket(_gameId, _child);
        gameIdPerChildMarket[_child] = _gameId;
        playerIdPerChildMarket[_child] = _playerId;
        optionIdPerChildMarket[_child] = _option;
        childMarketCreated[_child] = true;
        childMarketMainMarket[_child] = _main;
        mainMarketChildMarketIndex[_main][numberOfChildMarkets[_main]] = _child;
        numberOfChildMarkets[_main] += 1;
        mainMarketPlayerOptionLineChildMarket[_main][_playerId][_option][_line] = _child;
        childMarketLine[_child] = _line;
        currentActiveChildMarketPerPlayerAndOption[_main][_playerId][_option] = _child;
        mainMarketChildMarketPerPlayerAndOptionIndex[_main][_playerId][_option][
            numberOfChildMarketsPerPlayerAndOption[_main][_playerId][_option]
        ] = _child;
        numberOfChildMarketsPerPlayerAndOption[_main][_playerId][_option] += 1;
        emit CreatePlayerPropsMarket(
            _main,
            _child,
            _gameId,
            _playerId,
            _line,
            _option,
            getNormalizedChildOdds(_child),
            _type
        );
    }

    function _resolveMarketForPlayer(address _child, uint16 _score) internal {
        uint16 line = childMarketLine[_child];

        uint outcome = _score * 100 > line ? HOME_WIN : _score * 100 < line ? AWAY_WIN : CANCELLED;

        sportsManager.resolveMarket(_child, outcome);
        emit ResolveChildMarket(_child, outcome, childMarketMainMarket[_child], _score);
    }

    /* ========== VIEW FUNCTIONS ========== */

    /// @param _gameId game id for which game is looking
    /// @return uint[] odds array normalized
    function getNormalizedOddsForPlayerProps(
        bytes32 _gameId,
        bytes32 _playerId,
        uint8 _option
    ) public view returns (uint[] memory) {
        int[] memory odds = new int[](2);
        odds[0] = playerProp[_gameId][_playerId][_option].overOdds;
        odds[1] = playerProp[_gameId][_playerId][_option].underOdds;
        return verifier.calculateAndNormalizeOdds(odds);
    }

    /// @notice view function which returns normalized odds (spread or total) up to 100 (Example: 55-45)
    /// @param _market market
    /// @return uint[] odds array normalized
    function getNormalizedChildOddsFromGameOddsStruct(address _market) public view returns (uint[] memory) {
        return
            getNormalizedOddsForPlayerProps(
                gameIdPerChildMarket[_market],
                playerIdPerChildMarket[_market],
                optionIdPerChildMarket[_market]
            );
    }

    function getNormalizedChildOdds(address _market) public view returns (uint[] memory) {
        return
            normalizedOddsForMarketFulfilled[_market]
                ? normalizedOddsForMarket[_market]
                : getNormalizedChildOddsFromGameOddsStruct(_market);
    }

    function getPlayerPropForOption(
        bytes32 _gameId,
        bytes32 _playerId,
        uint8 _option
    )
        external
        view
        returns (
            uint16,
            int24,
            int24,
            bool
        )
    {
        IGamesPlayerProps.PlayerProps memory currentProp = playerProp[_gameId][_playerId][_option];
        return (
            currentProp.line,
            currentProp.overOdds,
            currentProp.underOdds,
            invalidOddsForPlayerProps[_gameId][_playerId][_option]
        );
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    /// @notice sets consumer, verifier, manager address
    /// @param _consumer consumer address
    /// @param _verifier verifier address
    /// @param _sportsManager sport manager address
    /// @param _playerPropsReceiver receiver
    function setContracts(
        address _consumer,
        address _verifier,
        address _sportsManager,
        address _playerPropsReceiver
    ) external onlyOwner {
        consumer = ITherundownConsumer(_consumer);
        verifier = ITherundownConsumerVerifier(_verifier);
        sportsManager = ISportPositionalMarketManager(_sportsManager);
        playerPropsReceiver = _playerPropsReceiver;

        emit NewContractAddresses(_consumer, _verifier, _sportsManager, _playerPropsReceiver);
    }

    /// @notice sets if sport is suported or not (delete from supported sport)
    /// @param _sportId sport id which needs to be supported or not
    /// @param _isSupported true/false (supported or not)
    function setSupportedSportForPlayerPropsAdded(uint _sportId, bool _isSupported) external onlyOwner {
        doesSportSupportPlayerProps[_sportId] = _isSupported;
        emit SupportedSportForPlayerPropsAdded(_sportId, _isSupported);
    }

    /* ========== MODIFIERS ========== */

    modifier canExecute() {
        require(msg.sender == playerPropsReceiver, "Invalid sender");
        _;
    }

    modifier onlyConsumer() {
        require(msg.sender == address(consumer), "Only consumer");
        _;
    }

    /* ========== EVENTS ========== */
    event PlayerPropsAdded(bytes32 _gameId, bytes32 _playerId, uint8 _option, uint[] _normalizedOdds);
    event NewContractAddresses(address _consumer, address _verifier, address _sportsManager, address _receiver);
    event SupportedSportForPlayerPropsAdded(uint _sportId, bool _isSupported);
    event CreatePlayerPropsMarket(
        address _main,
        address _child,
        bytes32 _gameId,
        bytes32 _playerId,
        uint16 _line,
        uint8 _option,
        uint[] _normalizedOdds,
        uint _type
    );
    event ResolveChildMarket(address _child, uint _outcome, address _main, uint16 _score);
    event InvalidOddsForMarket(address _main, bytes32 _gameId, bytes32 _playerId, uint8 option);
}

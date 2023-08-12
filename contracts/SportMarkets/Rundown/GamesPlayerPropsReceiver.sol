// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

// interface
import "../../interfaces/IGamesPlayerProps.sol";
import "../../interfaces/ITherundownConsumer.sol";

/// @title Recieve player props
/// @author gruja
contract GamesPlayerPropsReceiver is Initializable, ProxyOwned, ProxyPausable {
    IGamesPlayerProps public playerProps;
    ITherundownConsumer public consumer;

    mapping(address => bool) public whitelistedAddresses;
    mapping(uint => mapping(uint8 => bool)) public isValidOptionPerSport;
    mapping(uint => uint[]) public optionsPerSport;

    address public wrapperAddress;

    /// @notice public initialize proxy method
    /// @param _owner future owner of a contract
    function initialize(
        address _owner,
        address _consumer,
        address _playerProps,
        address[] memory _whitelistAddresses
    ) public initializer {
        setOwner(_owner);
        consumer = ITherundownConsumer(_consumer);
        playerProps = IGamesPlayerProps(_playerProps);

        for (uint i; i < _whitelistAddresses.length; i++) {
            whitelistedAddresses[_whitelistAddresses[i]] = true;
        }
    }

    /* ========== PLAYER PROPS R. MAIN FUNCTIONS ========== */

    /// @notice receive player props and create markets
    /// @param _gameIds for which gameids market is created (Boston vs Miami etc.)
    /// @param _playerIds for which playerids market is created (12345, 678910 etc.)
    /// @param _options for which options market is created (points, assists, etc.)
    /// @param _names for which player names market is created (Jimmy Buttler etc.)
    /// @param _lines number of points assists per option
    /// @param _linesOdds odds for lines
    function fulfillPlayerProps(
        bytes32[] memory _gameIds,
        bytes32[] memory _playerIds,
        uint8[] memory _options,
        string[] memory _names,
        uint16[] memory _lines,
        int24[] memory _linesOdds
    ) external isAddressWhitelisted {
        for (uint i = 0; i < _gameIds.length; i++) {
            uint sportId = consumer.sportsIdPerGame(_gameIds[i]);
            if (isValidOptionPerSport[sportId][_options[i]]) {
                IGamesPlayerProps.PlayerProps memory player = _castToPlayerProps(
                    i,
                    _gameIds[i],
                    _playerIds[i],
                    _options[i],
                    _names[i],
                    _lines[i],
                    _linesOdds
                );
                // game needs to be fulfilled and market needed to be created
                if (consumer.gameFulfilledCreated(_gameIds[i]) && consumer.marketPerGameId(_gameIds[i]) != address(0)) {
                    playerProps.obtainPlayerProps(player, sportId);
                }
            }
        }
    }

    /// @notice receive resolve properties for markets
    /// @param _gameIds for which gameids market is resolving (Boston vs Miami etc.)
    /// @param _playerIds for which playerids market is resolving (12345, 678910 etc.)
    /// @param _options options (assists, points etc.)
    /// @param _scores number of points assists etc. which player had
    /// @param _statuses resolved statuses
    function fulfillResultOfPlayerProps(
        bytes32[] memory _gameIds,
        bytes32[] memory _playerIds,
        uint8[] memory _options,
        uint16[] memory _scores,
        uint8[] memory _statuses
    ) external isAddressWhitelisted {
        for (uint i = 0; i < _gameIds.length; i++) {
            uint sportId = consumer.sportsIdPerGame(_gameIds[i]);
            if (isValidOptionPerSport[sportId][_options[i]]) {
                IGamesPlayerProps.PlayerPropsResolver memory playerResult = _castToPlayerPropsResolver(
                    _gameIds[i],
                    _playerIds[i],
                    _options[i],
                    _scores[i],
                    _statuses[i]
                );
                // game needs to be resolved or canceled
                if (consumer.isGameResolvedOrCanceled(_gameIds[i])) {
                    playerProps.resolvePlayerProps(playerResult);
                }
            }
        }
    }

    /// @notice fulfill all data necessary to resolve player props markets with CL node
    /// @param _playerProps array player Props
    function fulfillPlayerPropsCLResolved(bytes[] memory _playerProps) external onlyWrapper {
        for (uint i = 0; i < _playerProps.length; i++) {
            IGamesPlayerProps.PlayerPropsResolver memory playerResult = abi.decode(
                _playerProps[i],
                (IGamesPlayerProps.PlayerPropsResolver)
            );
            uint sportId = consumer.sportsIdPerGame(playerResult.gameId);
            if (isValidOptionPerSport[sportId][playerResult.option]) {
                // game needs to be resolved or canceled
                if (consumer.isGameResolvedOrCanceled(playerResult.gameId)) {
                    playerProps.resolvePlayerProps(playerResult);
                }
            }
        }
    }

    /* ========== VIEWS ========== */

    function getOptionsPerSport(uint _sportsId) public view returns (uint[] memory) {
        return optionsPerSport[_sportsId];
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function _castToPlayerProps(
        uint index,
        bytes32 _gameId,
        bytes32 _playerId,
        uint8 _option,
        string memory _name,
        uint16 _line,
        int24[] memory _linesOdds
    ) internal returns (IGamesPlayerProps.PlayerProps memory) {
        return
            IGamesPlayerProps.PlayerProps(
                _gameId,
                _playerId,
                _option,
                _name,
                _line,
                _linesOdds[index * 2],
                _linesOdds[index * 2 + 1]
            );
    }

    function _castToPlayerPropsResolver(
        bytes32 _gameId,
        bytes32 _playerId,
        uint8 _option,
        uint16 _score,
        uint8 _statusId
    ) internal returns (IGamesPlayerProps.PlayerPropsResolver memory) {
        return IGamesPlayerProps.PlayerPropsResolver(_gameId, _playerId, _option, _score, _statusId);
    }

    /* ========== OWNER MANAGEMENT FUNCTIONS ========== */

    /// @notice Sets valid/invalid options per sport
    /// @param _sportId Sport id
    /// @param _options Option ids
    /// @param _flag Invalid/valid flag
    function setValidOptionsPerSport(
        uint _sportId,
        uint8[] memory _options,
        bool _flag
    ) external onlyOwner {
        require(consumer.supportedSport(_sportId), "SportId is not supported");
        for (uint index = 0; index < _options.length; index++) {
            // Only if current flag is different, if same, skip it
            if (isValidOptionPerSport[_sportId][_options[index]] != _flag) {
                // Update the option validity flag
                isValidOptionPerSport[_sportId][_options[index]] = _flag;

                // Update the options array
                if (_flag) {
                    optionsPerSport[_sportId].push(_options[index]);
                } else {
                    // Find and remove the option from the array
                    uint[] storage optionsArray = optionsPerSport[_sportId];
                    for (uint i = 0; i < optionsArray.length; i++) {
                        if (optionsArray[i] == _options[index]) {
                            // Swap with the last element and remove
                            optionsArray[i] = optionsArray[optionsArray.length - 1];
                            optionsArray.pop();
                            break;
                        }
                    }
                }

                // Emit the event
                emit IsValidOptionPerSport(_sportId, _options[index], _flag);
            }
        }
    }

    /// @notice sets the consumer contract address, which only owner can execute
    /// @param _consumer address of a consumer contract
    function setConsumerAddress(address _consumer) external onlyOwner {
        require(_consumer != address(0), "Invalid address");
        consumer = ITherundownConsumer(_consumer);
        emit NewConsumerAddress(_consumer);
    }

    /// @notice sets the wrepper address
    /// @param _wrapper address of a wrapper contract
    function setWrapperAddress(address _wrapper) external onlyOwner {
        require(_wrapper != address(0), "Invalid address");
        wrapperAddress = _wrapper;
        emit NewWrapperAddress(_wrapper);
    }

    /// @notice sets the PlayerProps contract address, which only owner can execute
    /// @param _playerProps address of a player props contract
    function setPlayerPropsAddress(address _playerProps) external onlyOwner {
        require(_playerProps != address(0), "Invalid address");
        playerProps = IGamesPlayerProps(_playerProps);
        emit NewPlayerPropsAddress(_playerProps);
    }

    /// @notice adding/removing whitelist address depending on a flag
    /// @param _whitelistAddresses addresses that needed to be whitelisted/ ore removed from WL
    /// @param _flag adding or removing from whitelist (true: add, false: remove)
    function addToWhitelist(address[] memory _whitelistAddresses, bool _flag) external onlyOwner {
        require(_whitelistAddresses.length > 0, "Whitelisted addresses cannot be empty");
        for (uint256 index = 0; index < _whitelistAddresses.length; index++) {
            require(_whitelistAddresses[index] != address(0), "Can't be zero address");
            // only if current flag is different, if same skip it
            if (whitelistedAddresses[_whitelistAddresses[index]] != _flag) {
                whitelistedAddresses[_whitelistAddresses[index]] = _flag;
                emit AddedIntoWhitelist(_whitelistAddresses[index], _flag);
            }
        }
    }

    /* ========== MODIFIERS ========== */

    modifier isAddressWhitelisted() {
        require(whitelistedAddresses[msg.sender], "Whitelisted address");
        _;
    }

    modifier onlyWrapper() {
        require(msg.sender == wrapperAddress, "Invalid wrapper");
        _;
    }

    /* ========== EVENTS ========== */

    event NewWrapperAddress(address _wrapper);
    event NewPlayerPropsAddress(address _playerProps);
    event NewConsumerAddress(address _consumer);
    event AddedIntoWhitelist(address _whitelistAddress, bool _flag);
    event IsValidOptionPerSport(uint _sport, uint8 _option, bool _flag);
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

/// @title Storage for games (created or resolved), calculation for order-making bot processing
/// @author gruja
contract GamesQueue is Initializable, ProxyOwned, ProxyPausable {
    // create games queue
    mapping(uint => bytes32) public gamesCreateQueue;
    mapping(bytes32 => bool) public existingGamesInCreatedQueue;
    uint public firstCreated;
    uint public lastCreated;
    mapping(bytes32 => uint) public gameStartPerGameId;

    // resolve games queue
    bytes32[] public unproccessedGames;
    mapping(bytes32 => uint) public unproccessedGamesIndex;
    mapping(uint => bytes32) public gamesResolvedQueue;
    mapping(bytes32 => bool) public existingGamesInResolvedQueue;
    uint public firstResolved;
    uint public lastResolved;

    address public consumer;
    mapping(address => bool) public whitelistedAddresses;

    /// @notice public initialize proxy method
    /// @param _owner future owner of a contract
    function initialize(address _owner) public initializer {
        setOwner(_owner);
        firstCreated = 1;
        lastCreated = 0;
        firstResolved = 1;
        lastResolved = 0;
    }

    /// @notice putting game in a crated queue and fill up unprocessed games array
    /// @param data id of a game in byte32
    /// @param startTime game start time
    /// @param sportsId id of a sport (Example: NBA = 4 etc.)
    function enqueueGamesCreated(
        bytes32 data,
        uint startTime,
        uint sportsId
    ) public canExecuteFunction {
        lastCreated += 1;
        gamesCreateQueue[lastCreated] = data;

        existingGamesInCreatedQueue[data] = true;
        unproccessedGames.push(data);
        unproccessedGamesIndex[data] = unproccessedGames.length - 1;
        gameStartPerGameId[data] = startTime;

        emit EnqueueGamesCreated(data, sportsId, lastCreated);
    }

    /// @notice removing first game in a queue from created queue
    /// @return data returns id of a game which is removed
    function dequeueGamesCreated() public canExecuteFunction returns (bytes32 data) {
        require(lastCreated >= firstCreated, "No more elements in a queue");

        data = gamesCreateQueue[firstCreated];

        delete gamesCreateQueue[firstCreated];
        firstCreated += 1;

        emit DequeueGamesCreated(data, firstResolved - 1);
    }

    /// @notice putting game in a resolved queue
    /// @param data id of a game in byte32
    function enqueueGamesResolved(bytes32 data) public canExecuteFunction {
        lastResolved += 1;
        gamesResolvedQueue[lastResolved] = data;
        existingGamesInResolvedQueue[data] = true;

        emit EnqueueGamesResolved(data, lastCreated);
    }

    /// @notice removing first game in a queue from resolved queue
    /// @return data returns id of a game which is removed
    function dequeueGamesResolved() public canExecuteFunction returns (bytes32 data) {
        require(lastResolved >= firstResolved, "No more elements in a queue");

        data = gamesResolvedQueue[firstResolved];

        delete gamesResolvedQueue[firstResolved];
        firstResolved += 1;

        emit DequeueGamesResolved(data, firstResolved - 1);
    }

    /// @notice removing game from array of unprocessed games
    /// @param index index in array
    function removeItemUnproccessedGames(uint index) public canExecuteFunction {
        require(index < unproccessedGames.length, "No such index in array");

        bytes32 dataProccessed = unproccessedGames[index];

        unproccessedGames[index] = unproccessedGames[unproccessedGames.length - 1];
        unproccessedGamesIndex[unproccessedGames[index]] = index;
        unproccessedGames.pop();

        emit GameProcessed(dataProccessed, index);
    }

    /// @notice update a game start date
    /// @param _gameId gameId which start date is updated
    /// @param _date date
    function updateGameStartDate(bytes32 _gameId, uint _date) public canExecuteFunction {
        require(_date > block.timestamp, "Date must be in future");
        require(gameStartPerGameId[_gameId] != 0, "Game not existing");
        gameStartPerGameId[_gameId] = _date;
        emit NewStartDateOnGame(_gameId, _date);
    }

    /// @notice public function which will return length of unprocessed array
    /// @return index index in array
    function getLengthUnproccessedGames() public view returns (uint) {
        return unproccessedGames.length;
    }

    /// @notice sets the consumer contract address, which only owner can execute
    /// @param _consumer address of a consumer contract
    function setConsumerAddress(address _consumer) external onlyOwner {
        require(_consumer != address(0), "Invalid address");
        consumer = _consumer;
        emit NewConsumerAddress(_consumer);
    }

    /// @notice adding/removing whitelist address depending on a flag
    /// @param _whitelistAddress address that needed to be whitelisted/ ore removed from WL
    /// @param _flag adding or removing from whitelist (true: add, false: remove)
    function addToWhitelist(address _whitelistAddress, bool _flag) external onlyOwner {
        require(_whitelistAddress != address(0) && whitelistedAddresses[_whitelistAddress] != _flag, "Invalid");
        whitelistedAddresses[_whitelistAddress] = _flag;
        emit AddedIntoWhitelist(_whitelistAddress, _flag);
    }

    modifier canExecuteFunction() {
        require(msg.sender == consumer || whitelistedAddresses[msg.sender], "Only consumer or whitelisted address");
        _;
    }

    event EnqueueGamesCreated(bytes32 _gameId, uint _sportId, uint _index);
    event EnqueueGamesResolved(bytes32 _gameId, uint _index);
    event DequeueGamesCreated(bytes32 _gameId, uint _index);
    event DequeueGamesResolved(bytes32 _gameId, uint _index);
    event GameProcessed(bytes32 _gameId, uint _index);
    event NewConsumerAddress(address _consumer);
    event AddedIntoWhitelist(address _whitelistAddress, bool _flag);
    event NewStartDateOnGame(bytes32 _gameId, uint _date);
}

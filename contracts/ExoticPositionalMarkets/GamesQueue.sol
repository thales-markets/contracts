pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

/* 
    Storage for games (created or resolved)
*/
contract GamesQueue is Initializable, ProxyOwned, ProxyPausable {

    // create games queue
    mapping(uint => bytes32) public gamesCreateQueue;
    mapping(bytes32 => bool) public existingGamesInCreatedQueue;
    uint public firstCreated;
    uint public lastCreated;
    mapping(bytes32 => uint) public gameStartPerGameId;
    mapping(bytes32 => uint) public sportPerGameId;

    // resolve games queue
    bytes32[] public unproccessedGames;
    mapping(bytes32 => uint) public unproccessedGamesIndex;
    mapping(uint => bytes32) public gamesResolvedQueue;
    uint public firstResolved;
    uint public lastResolved;

    address public consumer;

    function initialize(
        address _owner
    ) public initializer {
        setOwner(_owner);
        firstCreated = 1;
        lastCreated = 0;
        firstResolved = 1;
        lastResolved = 0;
    }

    function enqueueGamesCreated(bytes32 data, uint startTime, uint sportsId) onlyConsumer public {

        lastCreated += 1;
        gamesCreateQueue[lastCreated] = data;

        existingGamesInCreatedQueue[data] = true;
        unproccessedGames.push(data);
        unproccessedGamesIndex[data] = unproccessedGames.length - 1;
        gameStartPerGameId[data] = startTime;
        sportPerGameId[data] = sportsId;

        emit EnqueueGamesCreated(data, sportsId, lastCreated);
    }

    function dequeueGamesCreated() public returns (bytes32 data) {
        require(lastCreated >= firstCreated, "No more elements in a queue");

        data = gamesCreateQueue[firstCreated];

        delete gamesCreateQueue[firstCreated];
        firstCreated += 1;

        emit DequeueGamesCreated(data, firstResolved - 1);
    }

    function enqueueGamesResolved(bytes32 data) onlyConsumer public {
        lastResolved += 1;
        gamesResolvedQueue[lastResolved] = data;

        emit EnqueueGamesResolved(data, lastCreated);
    }

    function dequeueGamesResolved() public onlyConsumer returns (bytes32 data) {
        require(lastResolved >= firstResolved, "No more elements in a queue");

        data = gamesResolvedQueue[firstResolved];

        delete gamesResolvedQueue[firstResolved];
        firstResolved += 1;

        emit DequeueGamesResolved(data, firstResolved - 1);
    }

    function removeItemUnproccessedGames(uint index) public onlyConsumer{
        require(index < unproccessedGames.length, "No such index in array");

        bytes32 dataProccessed = unproccessedGames[index];

        unproccessedGames[index] = unproccessedGames[unproccessedGames.length - 1];
        unproccessedGamesIndex[unproccessedGames[index]] = index;
        unproccessedGames.pop();

        emit GameProcessed(dataProccessed, index);
    }

    function getLengthUnproccessedGames() public view returns(uint){
        return unproccessedGames.length;
    }

    function setConsumerAddress(address _consumer) external onlyOwner {
        require(_consumer != address(0), "Invalid address");
        consumer = _consumer;
        emit NewConsumerAddress(_consumer);
    }

    modifier onlyConsumer() {
        require(msg.sender == consumer, "Only consumer can call this function");
        _;
    }

    event EnqueueGamesCreated(bytes32 _gameId, uint _sportId, uint _index);
    event EnqueueGamesResolved(bytes32 _gameId, uint _index);
    event DequeueGamesCreated(bytes32 _gameId, uint _index);
    event DequeueGamesResolved(bytes32 _gameId, uint _index);
    event GameProcessed(bytes32 _gameId, uint _index);
    event NewConsumerAddress(address _consumer);

}

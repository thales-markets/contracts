pragma solidity ^0.8.0;

contract TestOdds {
    mapping(bytes32 => uint[]) public odds;

    function getNormalizedOdds(bytes32 _gameId) external view returns (uint[] memory) {
        return odds[_gameId];
    }

    function addOddsForGameId(bytes32 _gameId, uint[] memory _odds) external {
        odds[_gameId] = _odds;
    }
}

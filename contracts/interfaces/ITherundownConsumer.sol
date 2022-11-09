// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ITherundownConsumer {
    struct GameCreate {
        bytes32 gameId;
        uint256 startTime;
        int24 homeOdds;
        int24 awayOdds;
        int24 drawOdds;
        string homeTeam;
        string awayTeam;
    }

    // view functions
    function isSupportedSport(uint _sportId) external view returns (bool);

    function isSupportedMarketType(string memory _market) external pure returns (bool);

    function getNormalizedOdds(bytes32 _gameId) external view returns (uint[] memory);

    function getNormalizedOddsForTwoPosition(bytes32 _gameId) external view returns (uint[] memory);

    function getGameCreatedById(address _market) external view returns (bytes32);

    function getGamePropsForOdds(address _market) external view returns (uint, uint);

    function gameIdPerMarket(address _market) external view returns (bytes32);

    function getGameCreatedById(bytes32 _gameId) external view returns (GameCreate memory);

    // write functions
    function fulfillGamesCreated(
        bytes32 _requestId,
        bytes[] memory _games,
        uint _sportsId,
        uint _date
    ) external;

    function fulfillGamesResolved(
        bytes32 _requestId,
        bytes[] memory _games,
        uint _sportsId
    ) external;

    function fulfillGamesOdds(
        bytes32 _requestId,
        bytes[] memory _games,
        uint _date
    ) external;

    function resolveMarketManually(
        address _market,
        uint _outcome,
        uint8 _homeScore,
        uint8 _awayScore
    ) external;

    function getOddsForGame(bytes32 _gameId)
        external
        view
        returns (
            int24,
            int24,
            int24
        );
}

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
    function supportedSport(uint _sportId) external view returns (bool);

    function gameOnADate(bytes32 _gameId) external view returns (uint);

    function isGameResolvedOrCanceled(bytes32 _gameId) external view returns (bool);

    function getNormalizedOdds(bytes32 _gameId) external view returns (uint[] memory);

    function getNormalizedOddsForMarket(address _market) external view returns (uint[] memory);

    function getNormalizedChildOdds(address _market) external view returns (uint[] memory);

    function getNormalizedOddsForTwoPosition(bytes32 _gameId) external view returns (uint[] memory);

    function getGamesPerDatePerSport(uint _sportId, uint _date) external view returns (bytes32[] memory);

    function getGamePropsForOdds(address _market)
        external
        view
        returns (
            uint,
            uint,
            bytes32
        );

    function gameIdPerMarket(address _market) external view returns (bytes32);

    function getGameCreatedById(bytes32 _gameId) external view returns (GameCreate memory);

    function isChildMarket(address _market) external view returns (bool);

    function gameFulfilledCreated(bytes32 _gameId) external view returns (bool);

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

    function fulfillGamesOdds(bytes32 _requestId, bytes[] memory _games) external;

    function setPausedByCanceledStatus(address _market, bool _flag) external;

    function setGameIdPerChildMarket(bytes32 _gameId, address _child) external;

    function pauseOrUnpauseMarket(address _market, bool _pause) external;

    function pauseOrUnpauseMarketForPlayerProps(
        address _market,
        bool _pause,
        bool _invalidOdds,
        bool _circuitBreakerMain
    ) external;

    function setChildMarkets(
        bytes32 _gameId,
        address _main,
        address _child,
        bool _isSpread,
        int16 _spreadHome,
        uint24 _totalOver
    ) external;

    function resolveMarketManually(
        address _market,
        uint _outcome,
        uint8 _homeScore,
        uint8 _awayScore,
        bool _usebackupOdds
    ) external;

    function getOddsForGame(bytes32 _gameId)
        external
        view
        returns (
            int24,
            int24,
            int24
        );

    function sportsIdPerGame(bytes32 _gameId) external view returns (uint);

    function getGameStartTime(bytes32 _gameId) external view returns (uint256);

    function marketPerGameId(bytes32 _gameId) external view returns (address);

    function marketResolved(address _market) external view returns (bool);

    function marketCanceled(address _market) external view returns (bool);

    function invalidOdds(address _market) external view returns (bool);

    function isPausedByCanceledStatus(address _market) external view returns (bool);

    function isSportOnADate(uint _date, uint _sportId) external view returns (bool);

    function isSportTwoPositionsSport(uint _sportsId) external view returns (bool);
}

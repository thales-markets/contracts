// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IGamesPlayerProps {
    struct PlayerProps {
        bytes32 gameId;
        bytes32 playerId;
        uint8 option;
        string playerName;
        uint16 line;
        int24 overOdds;
        int24 underOdds;
    }

    struct PlayerPropsResolver {
        bytes32 gameId;
        bytes32 playerId;
        uint8 option;
        uint16 score;
        uint8 statusId;
    }

    function obtainPlayerProps(PlayerProps memory _player, uint _sportId) external;

    function resolvePlayerProps(PlayerPropsResolver memory _result) external;

    function cancelMarketFromManager(address _market) external;

    function pauseAllPlayerPropsMarketForMain(
        address _main,
        bool _flag,
        bool _invalidOddsOnMain,
        bool _circuitBreakerMain
    ) external;

    function createFulfilledForPlayerProps(
        bytes32 gameId,
        bytes32 playerId,
        uint8 option
    ) external view returns (bool);

    function cancelPlayerPropsMarketForMain(address _main) external;

    function getNormalizedOddsForMarket(address _market) external view returns (uint[] memory);

    function mainMarketChildMarketIndex(address _main, uint _index) external view returns (address);

    function numberOfChildMarkets(address _main) external view returns (uint);

    function doesSportSupportPlayerProps(uint _sportId) external view returns (bool);

    function pausedByInvalidOddsOnMain(address _main) external view returns (bool);

    function pausedByCircuitBreakerOnMain(address _main) external view returns (bool);

    function getAllOptionsWithPlayersForGameId(bytes32 _gameId)
        external
        view
        returns (
            bytes32[] memory _playerIds,
            uint8[] memory _options,
            bool[] memory _isResolved,
            address[][] memory _childMarketsPerOption
        );

    function getPlayerPropsDataForMarket(address _market)
        external
        view
        returns (
            address,
            bytes32,
            bytes32,
            uint8
        );

    function getPlayerPropForOption(
        bytes32 gameId,
        bytes32 playerId,
        uint8 option
    )
        external
        view
        returns (
            uint16,
            int24,
            int24,
            bool
        );

    function fulfillPlayerPropsCLResolved(bytes[] memory _playerProps) external;
}

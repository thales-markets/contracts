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
        uint8[] options;
        uint16[] scores;
    }

    function obtainPlayerProps(PlayerProps memory _player, uint _sportId) external;

    function resolvePlayerProps(PlayerPropsResolver memory _result) external;

    function pauseAllPlayerPropsMarketForMain(
        address _main,
        bool _flag,
        bool _invalidOddsOnMain,
        bool _circuitBreakerMain
    ) external;

    function cancelPlayerPropsMarketForMain(address _main) external;

    function getNormalizedChildOdds(address _market) external view returns (uint[] memory);

    function mainMarketChildMarketIndex(address _main, uint _index) external view returns (address);

    function numberOfChildMarkets(address _main) external view returns (uint);

    function doesSportSupportPlayerProps(uint _sportId) external view returns (bool);

    function pausedByInvalidOddsOnMain(address _main) external view returns (bool);

    function pausedByCircuitBreakerOnMain(address _main) external view returns (bool);

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
}

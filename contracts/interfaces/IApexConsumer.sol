// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IApexConsumer {
    // view functions
    function isSupportedSport(string memory sport) external view returns (bool);

    function getNormalizedOdds(bytes32 _gameId) external view returns (uint[] memory);

    function isApexGame(bytes32 _gameId) external view returns (bool);

    // write functions
    function fulfillMetaData(
        bytes32 _requestId,
        string memory _event_id,
        string memory _bet_type,
        string memory _event_name,
        uint256 _qualifying_start_time,
        uint256 _race_start_time,
        string memory _sport
    ) external;

    function fulfillMatchup(
        bytes32 _requestId,
        string memory _betTypeDetail1,
        string memory _betTypeDetail2,
        uint256 _probA,
        uint256 _probB,
        bytes32 _gameId,
        string memory _sport,
        string memory _eventId,
        bool _arePostQualifyingOdds
    ) external;

    function fulfillResults(
        bytes32 _requestId,
        string memory _result,
        string memory _resultDetails,
        bytes32 _gameId,
        string memory _sport
    ) external;
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ITherundownConsumerVerifier {
    // view functions
    function isInvalidNames(string memory _teamA, string memory _teamB) external view returns (bool);

    function areTeamsEqual(string memory _teamA, string memory _teamB) external view returns (bool);

    function isSupportedMarketType(string memory _market) external view returns (bool);

    function areOddsInThreshold(
        uint _sportId,
        uint[] memory _currentOdds,
        uint[] memory _newOdds,
        bool _isTwoPositionalSport
    ) external view returns (bool);
}

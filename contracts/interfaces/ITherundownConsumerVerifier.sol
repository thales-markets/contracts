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

    function areOddsValid(
        bool _isTwoPositionalSport,
        int24 _homeOdds,
        int24 _awayOdds,
        int24 _drawOdds
    ) external view returns (bool);

    function isValidOutcomeForGame(bool _isTwoPositionalSport, uint _outcome) external view returns (bool);

    function isValidOutcomeWithResult(
        uint _outcome,
        uint _homeScore,
        uint _awayScore
    ) external view returns (bool);

    function calculateAndNormalizeOdds(int[] memory _americanOdds) external view returns (uint[] memory);
}

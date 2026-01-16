// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IFreeBetsHolder {
    function numOfActiveSpeedMarketsPerUser(address _user) external view returns (uint);

    function numOfResolvedSpeedMarketsPerUser(address _user) external view returns (uint);

    function numOfActiveChainedSpeedMarketsPerUser(address _user) external view returns (uint);

    function numOfResolvedChainedSpeedMarketsPerUser(address _user) external view returns (uint);

    function ticketToUser(address _speedMarket) external view returns (address);

    function confirmSpeedMarketResolved(
        address _resolvedTicket,
        uint _exercized,
        uint _buyInAmount,
        address _collateral,
        bool _isChained
    ) external;

    function confirmSpeedOrChainedSpeedMarketTrade(
        bytes32 _requestId,
        address _speedMarketAddress,
        address _collateral,
        uint _buyinAmount,
        bool _isChained
    ) external;
}

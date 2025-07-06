// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IFreeBetsHolder {
    function confirmSpeedMarketResolved(
        address _resolvedTicket,
        uint _exercized,
        uint _buyInAmount,
        address _collateral
    ) external;

    function confirmSpeedOrChainedSpeedMarketTrade(
        bytes32 _requestId,
        address _speedMarketAddress,
        address _collateral,
        uint _buyinAmount,
        bool _isChained
    ) external;
}

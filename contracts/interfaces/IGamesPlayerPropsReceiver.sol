// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IGamesPlayerPropsReciever {
    function fulfillPlayerPropsCLResolved(bytes[] memory _playerProps) external;

    function fulfillPlayerPropsCL(bytes[] memory _playerProps) external;
}

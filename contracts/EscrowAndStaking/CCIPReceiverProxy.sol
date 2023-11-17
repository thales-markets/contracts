// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IAny2EVMMessageReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IAny2EVMMessageReceiver.sol";

import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

import {IERC165} from "@chainlink/contracts-ccip/src/v0.8/vendor/openzeppelin-solidity/v4.8.0/utils/introspection/IERC165.sol";

/// @title - Cross Chain Collector contract for Thales staking rewards
abstract contract CCIPReceiverProxy is IAny2EVMMessageReceiver, IERC165 {
    address internal i_router;

    function _setRouter(address router) internal {
        if (router == address(0)) revert InvalidRouter(address(0));
        i_router = router;
    }

    /// @notice IERC165 supports an interfaceId
    /// @param interfaceId The interfaceId to check
    /// @return true if the interfaceId is supported
    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return interfaceId == type(IAny2EVMMessageReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    /// @inheritdoc IAny2EVMMessageReceiver
    function ccipReceive(Client.Any2EVMMessage calldata message) external virtual override onlyRouter {
        _ccipReceive(message);
    }

    /// @notice Override this function in your implementation.
    /// @param message Any2EVMMessage
    function _ccipReceive(Client.Any2EVMMessage memory message) internal virtual;

    /////////////////////////////////////////////////////////////////////
    // Plumbing
    /////////////////////////////////////////////////////////////////////

    /// @notice Return the current router
    /// @return i_router address
    function getRouter() public view returns (address) {
        return address(i_router);
    }

    error InvalidRouter(address router);

    /// @dev only calls from the set router are accepted.
    modifier onlyRouter() {
        if (msg.sender != address(i_router)) revert InvalidRouter(msg.sender);
        _;
    }
}

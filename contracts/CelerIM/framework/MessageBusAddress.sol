// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";

abstract contract MessageBusAddress is ProxyOwned {
    event MessageBusUpdated(address messageBus);

    address public messageBus;

    function setMessageBus(address _messageBus) public onlyOwner {
        messageBus = _messageBus;
        emit MessageBusUpdated(messageBus);
    }
}

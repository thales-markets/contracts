// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IAny2EVMMessageReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IAny2EVMMessageReceiver.sol";

import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

import {IERC165} from "@chainlink/contracts-ccip/src/v0.8/vendor/openzeppelin-solidity/v4.8.0/utils/introspection/IERC165.sol";

contract MockCCIPRouter {
    receive() external payable {}

    function getFee(uint64 destinationChainSelector, Client.EVM2AnyMessage memory message)
        external
        view
        returns (uint256 fee)
    {
        return 0;
    }

    function ccipSend(uint64 destinationChainSelector, Client.EVM2AnyMessage memory message)
        external
        payable
        returns (bytes32)
    {
        address receiver = abi.decode(message.receiver, (address));
        bytes32 messageId = keccak256(abi.encode(destinationChainSelector, receiver));
        Client.Any2EVMMessage memory messageToBeReceved = Client.Any2EVMMessage({
            messageId: messageId,
            sourceChainSelector: destinationChainSelector,
            sender: abi.encode(msg.sender),
            data: message.data,
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });
        IAny2EVMMessageReceiver(receiver).ccipReceive(messageToBeReceved);
        emit MessageSent(msg.sender, receiver, message.data);
        return messageId;
    }

    event MessageSent(address sender, address receiver, bytes message);
}

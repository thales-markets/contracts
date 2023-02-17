// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";

contract MultiSend {
    function sendToMultipleAddresses(
        address[] memory recepients,
        uint _amount,
        IERC20 _token
    ) external {
        require(recepients.length * _amount <= _token.allowance(msg.sender, address(this)), "Low allowance");
        for (uint i = 0; i < recepients.length; i++) {
            _token.transferFrom(msg.sender, recepients[i], _amount);
        }
    }
}

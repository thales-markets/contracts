// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "./framework/MessageApp.sol";

contract CrossChainTest is MessageApp, Initializable, ProxyPausable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // acccount, token -> balance
    mapping(address => mapping(address => uint256)) public balances;

    mapping(bytes4 => address) public selectorAddress;

    // constructor(address _messageBus) MessageApp(_messageBus) {}
    function initialize(address _owner, address _messageBus) public initializer {
        setOwner(_owner);
        initNonReentrant();
        messageBus = _messageBus;
    }

    // called by user on source chain to send token with note to destination chain
    function sendNote(
        address _dstContract,
        uint64 _dstChainId,
        bytes memory _note
    ) external payable {
        bytes memory message = abi.encode(msg.sender, _note);
        sendMessage(_dstContract, _dstChainId, message, msg.value);
    }

    function executeMessage(
        bytes calldata _sender,
        uint64 _srcChainId,
        bytes calldata _message,
        address _executor
    ) external payable virtual override onlyMessageBus returns (ExecutionStatus) {
        (address sender, bytes memory note) = abi.decode((_message), (address, bytes));
        emit MessageReceived(sender, _srcChainId, note);
        return ExecutionStatus.Success;
    }

    function sendTokenWithNote(
        address _dstContract,
        address _token,
        uint256 _amount,
        uint64 _dstChainId,
        uint64 _nonce,
        uint32 _maxSlippage,
        bytes calldata _note,
        MsgDataTypes.BridgeSendType _bridgeSendType
    ) external payable {
        IERC20Upgradeable(_token).safeTransferFrom(msg.sender, address(this), _amount);
        bytes memory message = abi.encode(msg.sender, _note);
        sendMessageWithTransfer(
            _dstContract,
            _token,
            _amount,
            _dstChainId,
            _nonce,
            _maxSlippage,
            message,
            _bridgeSendType,
            msg.value
        );
    }

    // called by MessageBus on destination chain to receive message, record and emit info.
    // the associated token transfer is guaranteed to have already been received
    function executeMessageWithTransfer(
        address, // srcContract
        address _token,
        uint256 _amount,
        uint64 _srcChainId,
        bytes memory _message,
        address // executor
    ) external payable override onlyMessageBus returns (ExecutionStatus) {
        (address sender, bytes memory note) = abi.decode((_message), (address, bytes));
        balances[sender][_token] += _amount;
        emit MessageWithTransferReceived(sender, _token, _amount, _srcChainId, note);
        return ExecutionStatus.Success;
    }

    // called by MessageBus on source chain to handle message with failed token transfer
    // the associated token transfer is guaranteed to have already been refunded
    function executeMessageWithTransferRefund(
        address _token,
        uint256 _amount,
        bytes calldata _message,
        address // executor
    ) external payable override onlyMessageBus returns (ExecutionStatus) {
        (address sender, bytes memory note) = abi.decode((_message), (address, bytes));
        IERC20Upgradeable(_token).safeTransfer(sender, _amount);
        emit MessageWithTransferRefunded(sender, _token, _amount, note);
        return ExecutionStatus.Success;
    }

    // called by user on destination chain to withdraw tokens
    function withdraw(address _token, uint256 _amount) external {
        balances[msg.sender][_token] -= _amount;
        IERC20Upgradeable(_token).safeTransfer(msg.sender, _amount);
    }

    event MessageReceived(address sender, uint64 srcChainId, bytes note);
    event MessageWithTransferReceived(address sender, address token, uint256 amount, uint64 srcChainId, bytes note);
    event MessageWithTransferRefunded(address sender, address token, uint256 amount, bytes note);
}

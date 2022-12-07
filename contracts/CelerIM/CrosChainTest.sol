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
    mapping(address => bool) public whitelistedAddress;

    address public thalesOPExecutor;
    uint64 private constant OPTIMISM = 10;

    address public sportsAMM;
    address public sUSD;

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
    ) public payable {
        bytes memory message = abi.encode(msg.sender, _note);
        sendMessage(_dstContract, _dstChainId, _note, msg.value);
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

    function buyFromAMM(
        address market,
        uint position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) external nonReentrant notPaused {
        bytes memory message = abi.encode(
            msg.sender,
            bytes4(keccak256(bytes("buyFromAMM(address,uint256,uint256,uint256,uint256)"))),
            market,
            position,
            amount,
            expectedPayout,
            additionalSlippage
        );
        sendNote(thalesOPExecutor, OPTIMISM, message);
    }

    function sendExoticUSD(
        address _from,
        address _to,
        uint _amount
    ) external nonReentrant notPaused {
        bytes memory message = abi.encode(
            msg.sender,
            bytes4(keccak256(bytes("transferFrom(address,address,uint256)"))),
            _from,
            _to,
            _amount
        );
        emit Message(msg.sender, _to, OPTIMISM, message, 0);

        sendNote(thalesOPExecutor, OPTIMISM, message);
    }

    function executeThalesMessage(bytes calldata _message) external nonReentrant notPaused {
        require(_message.length > 0, "No msg");
        // require(whitelistedAddress[msg.sender], "Invalid sender");
        (address sender, bytes4 selector, ) = abi.decode(_message, (address, bytes4, address));
        if (selectorAddress[selector] != address(0)) {
            if (bytes4(keccak256(bytes("buyFromAMM(address,uint256,uint256,uint256,uint256)"))) == selector) {
                (, , address market, uint position, uint amount, uint expectedPayout, uint additionalSlippge) = abi.decode(
                    _message,
                    (address, bytes4, address, uint, uint, uint, uint)
                );
                (bool success, bytes memory result) = sportsAMM.call(
                    abi.encodeWithSelector(selector, market, position, amount, expectedPayout, additionalSlippge)
                );
            }
            if (bytes4(keccak256(bytes("transferFrom(address,address,uint256)"))) == selector && sUSD != address(0)) {
                (, , address from, address to, uint256 amount) = abi.decode(
                    _message,
                    (address, bytes4, address, address, uint256)
                );
                (bool success, bytes memory result) = sUSD.call(abi.encodeWithSelector(selector, from, to, amount));
                emit MessageExercised(msg.sender, sUSD, success, result);
            }
        }
    }

    function setUSD(address _susd) external {
        sUSD = _susd;
        selectorAddress[bytes4(keccak256(bytes("transferFrom(address,address,uint256)")))] = _susd;
    }

    event Message(address indexed sender, address receiver, uint256 dstChainId, bytes message, uint256 fee);
    event MessageExercised(address sender, address contractAddress, bool success, bytes result);
    event MessageReceived(address sender, uint64 srcChainId, bytes note);
    event MessageWithTransferReceived(address sender, address token, uint256 amount, uint64 srcChainId, bytes note);
    event MessageWithTransferRefunded(address sender, address token, uint256 amount, bytes note);
}

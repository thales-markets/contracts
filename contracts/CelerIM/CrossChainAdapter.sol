// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "./framework/MessageApp.sol";

// import "hardhat/console.sol";

contract CrossChainAdapter is MessageApp, Initializable, ProxyPausable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    mapping(bytes4 => address) public selectorAddress;
    mapping(address => bool) public whitelistedToReceiveFrom;
    address public adapterOnDestination;
    uint64 private constant OPTIMISM = 10;

    address public sportsAMM;
    IERC20Upgradeable public sUSD;

    // userAccount, token -> balance
    mapping(address => mapping(address => uint256)) public sUSDBalances;

    // userAccount, game, poistion => balance
    mapping(address => mapping(address => mapping(uint8 => uint256))) public gameBalances;

    address public sourceAdapter;
    mapping(bytes4 => uint64) public noncePerSelector;
    mapping(address => mapping(address => uint)) public userOwningToken;
    uint private testChain;

    // constructor(address _messageBus) MessageApp(_messageBus) {}
    function initialize(address _owner, address _messageBus) public initializer {
        setOwner(_owner);
        initNonReentrant();
        messageBus = _messageBus;
    }

    function sendNote(
        address _dstContract,
        uint64 _dstChainId,
        bytes memory _note
    ) public payable {
        bytes memory message = abi.encode(msg.sender, _note);
        sendMessage(_dstContract, _dstChainId, _note, msg.value);
    }

    function buyFromSportAMM(
        address market,
        uint8 position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) external nonReentrant notPaused {
        // todo specify
        // packing: | msg.sender | chain id | function selector | payload |
        bytes memory payload = abi.encode(market, position, amount, expectedPayout, additionalSlippage);
        bytes memory message = abi.encode(
            msg.sender,
            block.chainid,
            bytes4(keccak256(bytes("buyFromSportAMM(address,uint8,uint256,uint256,uint256)"))),
            payload
        );
        emit MessageSent(msg.sender, adapterOnDestination, block.chainid, message);
    }

    function buyFromSportAMM2(
        address _token,
        address market,
        uint8 position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        uint64 _dstChainId
    ) external payable nonReentrant notPaused {
        // todo specify
        // packing: | msg.sender | chain id | function selector | payload |
        bytes memory payload = abi.encode(market, position, amount, expectedPayout, additionalSlippage);
        bytes4 selector = bytes4(keccak256(bytes("buyFromSportAMM(address,uint8,uint256,uint256,uint256)")));
        bytes memory message = abi.encode(msg.sender, block.chainid, selector, payload);
        noncePerSelector[bytes4(keccak256(bytes("buyFromSportAMM(address,uint8,uint256,uint256,uint256)")))]++;
        if (_dstChainId == testChain) {
            IERC20Upgradeable(_token).transferFrom(msg.sender, adapterOnDestination, amount);
            emit MessageSent(msg.sender, adapterOnDestination, block.chainid, message);
        } else {
            sendMessageWithTransfer(
                adapterOnDestination,
                _token,
                amount,
                _dstChainId,
                noncePerSelector[selector],
                1000000,
                message,
                MsgDataTypes.BridgeSendType.Liquidity,
                msg.value
            );
        }
        // sendMessage(adapterOnDestination, _dstChainId, message, msg.value);
        // emit MessageSent(msg.sender, adapterOnDestination, block.chainid, message);
    }

    function buyFromCryptoAMM(
        address market,
        uint8 position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) external nonReentrant notPaused returns (uint) {
        //todo specify
        // packing: | msg.sender | chain id | function selector | payload |
        bytes memory payload = abi.encode(market, position, amount, expectedPayout, additionalSlippage);
        bytes memory message = abi.encode(
            msg.sender,
            block.chainid,
            bytes4(keccak256(bytes("buyFromCryptoAMM(address,uint8,uint256,uint256,uint256)"))),
            payload
        );
        emit MessageSent(msg.sender, adapterOnDestination, block.chainid, message);
    }

    function buyFromCryptoAMM(
        address market,
        uint8 position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        uint64 _dstChainId
    ) external nonReentrant notPaused returns (uint) {
        //todo specify
        // packing: | msg.sender | chain id | function selector | payload |
        bytes memory payload = abi.encode(market, position, amount, expectedPayout, additionalSlippage);
        bytes memory message = abi.encode(
            msg.sender,
            block.chainid,
            bytes4(keccak256(bytes("buyFromCryptoAMM(address,uint8,uint256,uint256,uint256)"))),
            payload
        );
        emit MessageSent(msg.sender, adapterOnDestination, block.chainid, message);
    }

    function buyFromParlay(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDPaid,
        uint _additionalSlippage,
        uint _expectedPayout,
        address _differentRecepient
    ) external nonReentrant notPaused {
        //todo specify
        // packing: | msg.sender | chain id | function selector | payload |
        bytes memory payload = abi.encode(
            _sportMarkets,
            _positions,
            _sUSDPaid,
            _additionalSlippage,
            _expectedPayout,
            _differentRecepient
        );
        bytes memory message = abi.encode(
            msg.sender,
            block.chainid,
            bytes4(keccak256(bytes("buyFromParlay(address[],uint256[],uint256,uint256,uint256,address)"))),
            payload
        );
        emit MessageSent(msg.sender, adapterOnDestination, block.chainid, message);
    }

    function buyFromParlay(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDPaid,
        uint _additionalSlippage,
        uint _expectedPayout,
        address _differentRecepient,
        uint64 _dstChainId
    ) external nonReentrant notPaused {
        //todo specify
        // packing: | msg.sender | chain id | function selector | payload |
        bytes memory payload = abi.encode(
            _sportMarkets,
            _positions,
            _sUSDPaid,
            _additionalSlippage,
            _expectedPayout,
            _differentRecepient
        );
        bytes memory message = abi.encode(
            msg.sender,
            block.chainid,
            bytes4(keccak256(bytes("buyFromParlay(address[],uint256[],uint256,uint256,uint256,address)"))),
            payload
        );
        emit MessageSent(msg.sender, adapterOnDestination, block.chainid, message);
    }

    function executeBuyMessage(bytes calldata _message) external notPaused nonReentrant returns (bool success) {
        success = _executeBuy(_message);
    }

    function executeSportBuyMessage(
        address _sender, // srcContract
        address _token,
        uint256 _amount,
        uint64 _srcChainId,
        bytes calldata _message,
        address // executor
    ) external notPaused nonReentrant returns (ExecutionStatus) {
        require(whitelistedToReceiveFrom[_sender], "Invalid sender");
        (address sender, uint chainId, bytes4 selector, bytes memory payload) = abi.decode(
            _message,
            (address, uint, bytes4, bytes)
        );
        // sUSDBalances[sender][_token] += _amount;
        require(selectorAddress[selector] != address(0), "Invalid selector");
        bool success = checkAndSendMessage(sender, selector, payload);
        if (success) {
            emit MessageExercised(sender, selectorAddress[selector], success, payload);
            emit MessageWithTransferReceived(sender, _token, _amount, _srcChainId, _message);
            return ExecutionStatus.Success;
        } else {
            emit MessageExercised(sender, selectorAddress[selector], success, payload);
            return ExecutionStatus.Fail;
        }
    }

    function _executeBuy(bytes calldata _message) internal returns (bool) {
        (address sender, uint chainId, bytes4 selector, bytes memory payload) = abi.decode(
            _message,
            (address, uint, bytes4, bytes)
        );
        require(selectorAddress[selector] != address(0), "Invalid selector");
        bool success = checkAndSendMessage(sender, selector, payload);
        if (success) {
            emit MessageExercised(sender, selectorAddress[selector], success, payload);
            return true;
        } else {
            emit MessageExercised(sender, selectorAddress[selector], success, payload);
            return false;
        }
    }

    function checkAndSendMessage(
        address _sender,
        bytes4 _selector,
        bytes memory _message
    ) internal returns (bool) {
        if (_selector == bytes4(keccak256(bytes("buyFromSportAMM(address,uint8,uint256,uint256,uint256)")))) {
            bytes4 realSelector = bytes4(keccak256(bytes("buyFromAMM(address,uint8,uint256,uint256,uint256)")));
            (address market, uint8 position, uint amount, uint expectedPayout, uint additionalSlippage) = abi.decode(
                _message,
                (address, uint8, uint, uint, uint)
            );
            (bool success, bytes memory result) = selectorAddress[_selector].call(
                abi.encodeWithSelector(realSelector, market, position, amount, expectedPayout, additionalSlippage)
            );
            if (success) {
                userOwningToken[_sender][market] += expectedPayout;
                gameBalances[_sender][market][position] += expectedPayout;
            }
            return success;
        } else if (_selector == bytes4(keccak256(bytes("buyFromCryptoAMM(address,uint8,uint256,uint256,uint256)")))) {
            bytes4 realSelector = bytes4(keccak256(bytes("buyFromAMM(address,uint8,uint256,uint256,uint256)")));
            (address market, uint8 position, uint amount, uint expectedPayout, uint additionalSlippage) = abi.decode(
                _message,
                (address, uint8, uint, uint, uint)
            );
            (bool success, bytes memory result) = selectorAddress[_selector].call(
                abi.encodeWithSelector(realSelector, market, position, amount, expectedPayout, additionalSlippage)
            );
            return success;
        } else if (_selector == bytes4(keccak256(bytes("buyFromParlay(address,uint8,uint256,uint256,uint256)")))) {
            (address market, uint8 position, uint amount, uint expectedPayout, uint additionalSlippage) = abi.decode(
                _message,
                (address, uint8, uint, uint, uint)
            );
            (bool success, bytes memory result) = selectorAddress[_selector].call(
                abi.encodeWithSelector(_selector, market, position, amount, expectedPayout, additionalSlippage)
            );
            return success;
        } else {
            return false;
        }
    }

    function setSelectorAddress(string memory _selectorString, address _selectorAddress) external onlyOwner {
        bytes4 selector = bytes4(keccak256(bytes(_selectorString)));
        selectorAddress[selector] = _selectorAddress;
        sUSD.approve(_selectorAddress, type(uint256).max);
    }

    function setWhitelistedAddress(address _account, bool _enable) external onlyOwner {
        whitelistedToReceiveFrom[_account] = _account != address(0) ? _enable : false;
    }

    function setPaymentToken(address _paymentToken) external onlyOwner {
        sUSD = IERC20Upgradeable(_paymentToken);
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

    function executeMessage(
        address _sender,
        uint64 _srcChainId,
        bytes calldata _message,
        address _executor
    ) external payable virtual override onlyMessageBus returns (ExecutionStatus) {
        (address sender, bytes memory note) = abi.decode((_message), (address, bytes));
        emit MessageReceived(sender, _srcChainId, note);
        return ExecutionStatus.Success;

        // require(whitelistedToReceiveFrom[_sender], "Sender not whitelisted");
        // _executeBuy(_message);

        // emit MessageReceived(_sender, _srcChainId, _message);
        // bool result = _executeBuy(_message);
        // if(result) {
        //     return ExecutionStatus.Success;
        // }
        // else {
        //     return ExecutionStatus.Fail;
        // }
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

    // called by MessageBus on destination chain to receive message, record and emit info.
    // the associated token transfer is guaranteed to have already been received
    function executeMessageWithTransfer(
        address _sender, // srcContract
        address _token,
        uint256 _amount,
        uint64 _srcChainId,
        bytes calldata _message,
        address // executor
    ) external payable override onlyMessageBus returns (ExecutionStatus) {
        // (address sender, bytes memory note) = abi.decode((_message), (address, bytes));
        require(_sender == sourceAdapter, "Invalid sender");
        (address sender, uint chainId, bytes4 selector, bytes memory payload) = abi.decode(
            _message,
            (address, uint, bytes4, bytes)
        );
        sUSDBalances[sender][_token] += _amount;
        require(selectorAddress[selector] != address(0), "Invalid selector");
        bool success = checkAndSendMessage(sender, selector, payload);
        if (success) {
            sUSDBalances[sender][_token] -= _amount;
            emit MessageExercised(sender, selectorAddress[selector], success, payload);
            emit MessageWithTransferReceived(sender, _token, _amount, _srcChainId, _message);
            return ExecutionStatus.Success;
        } else {
            emit MessageExercised(sender, selectorAddress[selector], success, payload);
            return ExecutionStatus.Fail;
        }

        // require(whitelistedToReceiveFrom[_sender], "Sender not whitelisted");
        // _executeBuy(_message);

        // emit MessageReceived(_sender, _srcChainId, _message);
        // bool result = _executeBuy(_message);
        // if(result) {
        //     return ExecutionStatus.Success;
        // }
        // else {
        //     return ExecutionStatus.Fail;
        // }
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
        sUSDBalances[msg.sender][_token] -= _amount;
        IERC20Upgradeable(_token).safeTransfer(msg.sender, _amount);
    }

    function setParameters(address _adapterOnDestination, uint _testChain) external onlyOwner {
        testChain = _testChain;
        adapterOnDestination = _adapterOnDestination;
    }

    event MessageSent(address indexed sender, address receiver, uint chainId, bytes message);
    event Message(address indexed sender, address receiver, uint256 dstChainId, bytes message, uint256 fee);
    event MessageExercised(address sender, address contractAddress, bool success, bytes result);
    event MessageReceived(address sender, uint64 srcChainId, bytes note);
    event MessageWithTransferReceived(address sender, address token, uint256 amount, uint64 srcChainId, bytes note);
    event MessageWithTransferRefunded(address sender, address token, uint256 amount, bytes note);
}

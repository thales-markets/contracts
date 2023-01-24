// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "./framework/MessageApp.sol";
import "../interfaces/ISportPositionalMarket.sol";
import "../interfaces/IPositionalMarket.sol";
import "../interfaces/IParlayMarketsAMM.sol";
import "../interfaces/IParlayMarketData.sol";

contract CrossChainAdapter is MessageApp, Initializable, ProxyPausable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    mapping(bytes4 => address) public selectorAddress;
    address public adapterOnDestination;
    uint64 private constant OPTIMISM = 10;

    address public sportsAMM;
    IERC20Upgradeable public sUSD;

    // userAccount, token -> balance
    mapping(address => mapping(address => uint256)) public balances;

    // userAccount, game, poistion => balance
    mapping(address => mapping(address => mapping(uint8 => uint256))) public userMarketBalances;
    mapping(address => bool) public whitelistedToReceiveFrom;
    mapping(address => bool) public whitelistedOperator;

    address public sourceAdapter;
    address public parlayAMM;
    mapping(bytes4 => uint64) public noncePerSelector;
    mapping(address => mapping(address => uint)) public userOwningToken;
    uint private testChain;
    mapping(address => bool) public marketExercised;
    mapping(address => mapping(uint8 => uint256)) public exercisedMarketBalance;
    uint32 public minBridgeSlippage;
    uint public bridgeFeePercentage;
    uint public defaultSlippage;
    uint private constant ONE = 1e18;

    function initialize(address _owner, address _messageBus) public initializer {
        setOwner(_owner);
        initNonReentrant();
        messageBus = _messageBus;
    }

    function calculateMessageFee(bytes memory message) external view returns (uint fee) {
        fee = MessageBusSender(messageBus).calcFee(message);
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
        address _token,
        address market,
        uint8 position,
        uint amount,
        uint expectedPayout,
        uint64 _dstChainId
    ) external payable nonReentrant notPaused {
        // packing: | msg.sender | chain id | function selector | payload |
        bytes memory payload = abi.encode(market, position, amount, expectedPayout, _token);
        bytes4 selector = bytes4(keccak256(bytes("buyFromSportAMM(address,uint8,uint256,uint256,address)")));
        bytes memory message = abi.encode(msg.sender, block.chainid, selector, payload);
        noncePerSelector[selector]++;
        // Needs to be removed before deployment on mainchain
        if (_dstChainId == testChain) {
            IERC20Upgradeable(_token).transferFrom(msg.sender, adapterOnDestination, expectedPayout);
            emit MessageSent(msg.sender, adapterOnDestination, block.chainid, message);
        } else {
            IERC20Upgradeable(_token).safeTransferFrom(
                msg.sender,
                address(this),
                ((expectedPayout * (ONE + bridgeFeePercentage)) / ONE)
            );
            sendMessageWithTransfer(
                adapterOnDestination,
                _token,
                ((expectedPayout * (ONE + bridgeFeePercentage)) / ONE),
                _dstChainId,
                noncePerSelector[selector],
                minBridgeSlippage,
                message,
                MsgDataTypes.BridgeSendType.Liquidity,
                msg.value
            );
        }
    }

    function buyFromCryptoAMM(
        address _token,
        address market,
        uint8 position,
        uint amount,
        uint expectedPayout,
        uint64 _dstChainId
    ) external payable nonReentrant notPaused returns (uint) {
        //todo specify
        // packing: | msg.sender | chain id | function selector | payload |
        bytes memory payload = abi.encode(market, position, amount, expectedPayout, _token);
        bytes4 selector = bytes4(keccak256(bytes("buyFromCryptoAMM(address,uint8,uint256,uint256,address)")));
        bytes memory message = abi.encode(msg.sender, block.chainid, selector, payload);
        noncePerSelector[selector]++;
        // Needs to be removed before deployment on mainchain
        if (_dstChainId == testChain) {
            IERC20Upgradeable(_token).transferFrom(msg.sender, adapterOnDestination, expectedPayout);
            emit MessageSent(msg.sender, adapterOnDestination, block.chainid, message);
        } else {
            IERC20Upgradeable(_token).safeTransferFrom(
                msg.sender,
                address(this),
                ((expectedPayout * (ONE + bridgeFeePercentage)) / ONE)
            );
            sendMessageWithTransfer(
                adapterOnDestination,
                _token,
                ((expectedPayout * (ONE + bridgeFeePercentage)) / ONE),
                _dstChainId,
                noncePerSelector[selector],
                minBridgeSlippage,
                message,
                MsgDataTypes.BridgeSendType.Liquidity,
                msg.value
            );
        }
    }

    function buyFromParlay(
        address _token,
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDPaid,
        uint _expectedPayout,
        uint64 _dstChainId
    ) external payable nonReentrant notPaused {
        // packing: | msg.sender | chain id | function selector | payload |
        bytes memory payload = abi.encode(_sportMarkets, _positions, _sUSDPaid, _expectedPayout, _token);
        bytes4 selector = bytes4(
            keccak256(
                bytes(
                    "buyFromParlayWithDifferentCollateralAndReferrer(address[],uint256[],uint256,uint256,uint256,address,address)"
                )
            )
        );
        bytes memory message = abi.encode(msg.sender, block.chainid, selector, payload);
        noncePerSelector[selector]++;
        if (_dstChainId == testChain) {
            IERC20Upgradeable(_token).transferFrom(msg.sender, adapterOnDestination, _sUSDPaid);
            emit MessageSent(msg.sender, adapterOnDestination, block.chainid, message);
        } else {
            IERC20Upgradeable(_token).safeTransferFrom(
                msg.sender,
                address(this),
                ((_sUSDPaid * (ONE + bridgeFeePercentage)) / ONE)
            );
            sendMessageWithTransfer(
                adapterOnDestination,
                _token,
                ((_sUSDPaid * (ONE + bridgeFeePercentage)) / ONE),
                _dstChainId,
                noncePerSelector[selector],
                minBridgeSlippage,
                message,
                MsgDataTypes.BridgeSendType.Liquidity,
                msg.value
            );
        }
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
    ) external payable notPaused nonReentrant returns (ExecutionStatus) {
        require(whitelistedToReceiveFrom[_sender], "Invalid sender");
        (address sender, uint chainId, bytes4 selector, bytes memory payload) = abi.decode(
            _message,
            (address, uint, bytes4, bytes)
        );
        require(selectorAddress[selector] != address(0), "Invalid selector");
        bool success = checkAndSendMessage(sender, selector, chainId, payload);
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
        bool success = checkAndSendMessage(sender, selector, chainId, payload);
        if (success) {
            emit MessageReceived(sender, uint64(chainId), payload);
            emit MessageExercised(sender, selectorAddress[selector], success, payload);
            return true;
        } else {
            emit MessageExercised(sender, selectorAddress[selector], success, payload);
            return false;
        }
    }

    function exerciseSportPosition(
        address market,
        uint8 position,
        uint64 _dstChainId
    ) external payable nonReentrant notPaused {
        // packing: | msg.sender | chain id | function selector | payload |
        bytes memory payload = abi.encode(market, position);
        bytes4 selector = bytes4(keccak256(bytes("exerciseSportPosition(address,uint8)")));
        bytes memory message = abi.encode(msg.sender, block.chainid, selector, payload);
        // Needs to be removed before deployment on mainchain
        if (_dstChainId == testChain) {
            emit MessageSent(msg.sender, adapterOnDestination, block.chainid, message);
        } else {
            sendMessage(adapterOnDestination, _dstChainId, message, msg.value);
        }
    }

    function exerciseParlay(address market, uint64 _dstChainId) external payable nonReentrant notPaused {
        // packing: | msg.sender | chain id | function selector | payload |
        bytes memory payload = abi.encode(market);
        bytes4 selector = bytes4(keccak256(bytes("exerciseParlay(address)")));
        bytes memory message = abi.encode(msg.sender, block.chainid, selector, payload);
        // Needs to be removed before deployment on mainchain
        if (_dstChainId == testChain) {
            emit MessageSent(msg.sender, adapterOnDestination, block.chainid, message);
        } else {
            sendMessage(adapterOnDestination, _dstChainId, message, msg.value);
        }
    }

    function exerciseCryptoPosition(
        address market,
        uint8 position,
        uint64 _dstChainId
    ) external payable nonReentrant notPaused {
        // todo specify
        // packing: | msg.sender | chain id | function selector | payload |
        bytes memory payload = abi.encode(market, position);
        bytes4 selector = bytes4(keccak256(bytes("exerciseCryptoPosition(address,uint8)")));
        bytes memory message = abi.encode(msg.sender, block.chainid, selector, payload);
        // Needs to be removed before deployment on mainchain
        if (_dstChainId == testChain) {
            emit MessageSent(msg.sender, adapterOnDestination, block.chainid, message);
        } else {
            sendMessage(adapterOnDestination, _dstChainId, message, msg.value);
        }
    }

    function checkAndSendMessage(
        address _sender,
        bytes4 _selector,
        uint _sourceChain,
        bytes memory _message
    ) internal returns (bool) {
        if (_selector == bytes4(keccak256(bytes("buyFromSportAMM(address,uint8,uint256,uint256,address)")))) {
            bytes4 realSelector = bytes4(
                keccak256(
                    bytes(
                        "buyFromAMMWithDifferentCollateralAndReferrer(address,uint8,uint256,uint256,uint256,address,address)"
                    )
                )
            );
            (address market, uint8 position, uint amount, uint expectedPayout, address collateral) = abi.decode(
                _message,
                (address, uint8, uint, uint, address)
            );
            IERC20Upgradeable(collateral).approve(selectorAddress[_selector], amount);
            (bool success, bytes memory result) = selectorAddress[_selector].call(
                abi.encodeWithSelector(
                    realSelector,
                    market,
                    position,
                    amount,
                    expectedPayout,
                    defaultSlippage,
                    collateral,
                    address(0)
                )
            );
            if (success) {
                userOwningToken[_sender][market] += amount;
                userMarketBalances[_sender][market][position] += amount;
            }
            return success;
        } else if (_selector == bytes4(keccak256(bytes("buyFromCryptoAMM(address,uint8,uint256,uint256,address)")))) {
            bytes4 realSelector = bytes4(
                keccak256(
                    bytes(
                        "buyFromAMMWithDifferentCollateralAndReferrer(address,uint8,uint256,uint256,uint256,address,address)"
                    )
                )
            );
            (address market, uint8 position, uint amount, uint expectedPayout, address collateral) = abi.decode(
                _message,
                (address, uint8, uint, uint, address)
            );
            IERC20Upgradeable(collateral).approve(selectorAddress[_selector], amount);
            (bool success, bytes memory result) = selectorAddress[_selector].call(
                abi.encodeWithSelector(
                    realSelector,
                    market,
                    position,
                    amount,
                    expectedPayout,
                    defaultSlippage,
                    collateral,
                    address(0)
                )
            );
            if (success) {
                userOwningToken[_sender][market] += amount;
                userMarketBalances[_sender][market][position] += amount;
            }
            return success;
        } else if (
            _selector ==
            bytes4(
                keccak256(
                    bytes(
                        "buyFromParlayWithDifferentCollateralAndReferrer(address[],uint256[],uint256,uint256,uint256,address,address)"
                    )
                )
            )
        ) {
            (address[] memory market, uint8[] memory position, uint amount, uint expectedPayout, address collateral) = abi
                .decode(_message, (address[], uint8[], uint, uint, address));
            IERC20Upgradeable(collateral).approve(selectorAddress[_selector], amount);
            (bool success, bytes memory result) = selectorAddress[_selector].call(
                abi.encodeWithSelector(
                    _selector,
                    market,
                    position,
                    amount,
                    defaultSlippage,
                    expectedPayout,
                    collateral,
                    address(0)
                )
            );
            if (success) {
                _updateParlayDetails(_sender, expectedPayout);
            }
            return success;
        } else if (_selector == bytes4(keccak256(bytes("exerciseParlay(address)")))) {
            noncePerSelector[_selector]++;
            address market = abi.decode(_message, (address));
            uint initalBalance = sUSD.balanceOf(address(this));
            IParlayMarketsAMM(parlayAMM).exerciseParlay(market);
            uint issueBalance = sUSD.balanceOf(address(this)) - initalBalance;
            require(issueBalance >= 0 && userOwningToken[_sender][market] > 0, "Balances dont match");
            if (_sourceChain == block.chainid) {
                sUSD.transfer(_sender, issueBalance);
            } else {
                sendMessageWithTransfer(
                    _sender,
                    address(sUSD),
                    issueBalance,
                    uint64(_sourceChain),
                    noncePerSelector[_selector],
                    minBridgeSlippage,
                    "",
                    MsgDataTypes.BridgeSendType.Liquidity,
                    msg.value
                );
            }
            userOwningToken[_sender][market] = 0;
            return true;
        } else if (_selector == bytes4(keccak256(bytes("exerciseCryptoPosition(address,uint8)")))) {
            noncePerSelector[_selector]++;
            (address market, uint8 position) = abi.decode(_message, (address, uint8));
            if (!marketExercised[market]) {
                (exercisedMarketBalance[market][0], exercisedMarketBalance[market][1]) = IPositionalMarket(market)
                    .balancesOf(address(this));
                IPositionalMarket(market).exerciseOptions();
                marketExercised[market] = true;
            }
            require(
                exercisedMarketBalance[market][position] >= userMarketBalances[_sender][market][position] &&
                    sUSD.balanceOf(address(this)) >= userMarketBalances[_sender][market][position],
                "Invalid amount"
            );
            if (_sourceChain == block.chainid) {
                sUSD.transfer(_sender, userMarketBalances[_sender][market][position]);
            } else {
                sendMessageWithTransfer(
                    _sender,
                    address(sUSD),
                    userMarketBalances[_sender][market][position],
                    uint64(_sourceChain),
                    noncePerSelector[_selector],
                    minBridgeSlippage,
                    "",
                    MsgDataTypes.BridgeSendType.Liquidity,
                    msg.value
                );
            }
            exercisedMarketBalance[market][position] -= userMarketBalances[_sender][market][position];
            userMarketBalances[_sender][market][position] = 0;
            return true;
        } else if (_selector == bytes4(keccak256(bytes("exerciseSportPosition(address,uint8)")))) {
            noncePerSelector[_selector]++;
            (address market, uint8 position) = abi.decode(_message, (address, uint8));
            if (!marketExercised[market]) {
                (
                    exercisedMarketBalance[market][0],
                    exercisedMarketBalance[market][1],
                    exercisedMarketBalance[market][2]
                ) = ISportPositionalMarket(market).balancesOf(address(this));
                ISportPositionalMarket(market).exerciseOptions();
                marketExercised[market] = true;
            }
            require(
                exercisedMarketBalance[market][position] >= userMarketBalances[_sender][market][position] &&
                    sUSD.balanceOf(address(this)) >= userMarketBalances[_sender][market][position],
                "Invalid amount"
            );
            if (_sourceChain == block.chainid) {
                sUSD.transfer(_sender, userMarketBalances[_sender][market][position]);
            } else {
                require(
                    exercisedMarketBalance[market][position] >= userMarketBalances[_sender][market][position],
                    "Invalid amount"
                );
                sendMessageWithTransfer(
                    _sender,
                    address(sUSD),
                    userMarketBalances[_sender][market][position],
                    uint64(_sourceChain),
                    noncePerSelector[_selector],
                    minBridgeSlippage,
                    "",
                    MsgDataTypes.BridgeSendType.Liquidity,
                    msg.value
                );
            }
            exercisedMarketBalance[market][position] -= userMarketBalances[_sender][market][position];
            userMarketBalances[_sender][market][position] = 0;
            return true;
        } else {
            return false;
        }
    }

    function setSelectorAddress(string memory _selectorString, address _selectorAddress) external {
        require(whitelistedOperator[msg.sender], "Invalid operator");
        bytes4 selector = bytes4(keccak256(bytes(_selectorString)));
        selectorAddress[selector] = _selectorAddress;
        sUSD.approve(_selectorAddress, type(uint256).max);
    }

    function setWhitelistedAddress(address _account, bool _enable) external {
        require(whitelistedOperator[msg.sender], "Invalid operator");
        whitelistedToReceiveFrom[_account] = _account != address(0) ? _enable : false;
    }

    function setWhitelistedOperator(address _account, bool _enable) external onlyOwner {
        whitelistedOperator[_account] = _account != address(0) ? _enable : false;
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
        require(whitelistedToReceiveFrom[_sender], "Invalid sender");
        bool success = _executeBuy(_message);
        if (success) {
            return ExecutionStatus.Success;
        } else {
            return ExecutionStatus.Fail;
        }
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
        require(whitelistedToReceiveFrom[_sender], "Invalid sender");
        (address sender, uint chainId, bytes4 selector, bytes memory payload) = abi.decode(
            _message,
            (address, uint, bytes4, bytes)
        );
        balances[sender][_token] += _amount;
        require(selectorAddress[selector] != address(0), "Invalid selector");
        bool success = checkAndSendMessage(sender, selector, chainId, payload);
        if (success) {
            balances[sender][_token] -= _amount;
            emit MessageExercised(sender, selectorAddress[selector], success, payload);
            emit MessageWithTransferReceived(sender, _token, _amount, _srcChainId, _message);
            return ExecutionStatus.Success;
        } else {
            emit MessageExercised(sender, selectorAddress[selector], success, payload);
            return ExecutionStatus.Fail;
        }
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

    function setParameters(
        address _adapterOnDestination,
        uint _testChain,
        address _parlayAMM,
        uint32 _minBridgeSlippage,
        uint _bridgeFeePercentage,
        uint _defaultSlippage
    ) external {
        require(whitelistedOperator[msg.sender], "Invalid operator");
        testChain = _testChain;
        adapterOnDestination = _adapterOnDestination;
        parlayAMM = _parlayAMM;
        // default minBridgeSlippage = 1000000;
        minBridgeSlippage = _minBridgeSlippage;
        bridgeFeePercentage = _bridgeFeePercentage;
        defaultSlippage = _defaultSlippage;
    }

    function _updateParlayDetails(address _sender, uint _expectedPayout) internal {
        address parlayMarket = IParlayMarketData(IParlayMarketsAMM(parlayAMM).parlayMarketData()).getLastUserParlay(
            address(this)
        );
        userOwningToken[_sender][parlayMarket] = 1;
        userMarketBalances[_sender][parlayMarket][0] = 1;
    }

    event MessageSent(address indexed sender, address receiver, uint chainId, bytes message);
    event Message(address indexed sender, address receiver, uint256 dstChainId, bytes message, uint256 fee);
    event MessageExercised(address sender, address contractAddress, bool success, bytes result);
    event MessageReceived(address sender, uint64 srcChainId, bytes note);
    event MessageWithTransferReceived(address sender, address token, uint256 amount, uint64 srcChainId, bytes note);
    event MessageWithTransferRefunded(address sender, address token, uint256 amount, bytes note);
}

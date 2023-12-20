// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
// import {LinkTokenInterface} from "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";
// import {CCIPReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

import "../interfaces/IStakingThales.sol";

import "./CCIPReceiverProxy.sol";

/// @title - Cross Chain Collector contract for Thales staking rewards
contract CrossChainCollector is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard, CCIPReceiverProxy {
    // Custom errors to provide more descriptive revert messages.
    error NotEnoughBalance(uint256 currentBalance, uint256 calculatedFees); // Used to make sure contract has enough balance.
    uint private constant MAX_GAS = 10 * 1e6;
    IRouterClient private s_router;
    address public stakingThales;

    address public masterCollector;
    uint64 public masterCollectorChain;

    mapping(uint => uint64) public chainSelector;
    mapping(uint64 => uint) public chainSelectorIndex;
    mapping(uint => address) public collectorAddress;

    mapping(uint => uint) public lastPeriodForChain;
    mapping(uint => mapping(uint => uint)) public chainStakedAmountInPeriod;
    mapping(uint => mapping(uint => uint)) public chainEscrowedAmountInPeriod;
    mapping(uint => mapping(uint => uint)) public chainBaseRewardsInPeriod;
    mapping(uint => mapping(uint => uint)) public chainExtraRewardsInPeriod;
    mapping(uint => mapping(uint => uint)) public chainBonusPointsInPeriod;
    mapping(uint => mapping(uint => uint)) public chainRevenueInPeriod;
    mapping(uint => mapping(uint => uint)) public chainRevenueShareInPeriod;

    mapping(uint => uint) public calculatedStakedAmountForPeriod;
    mapping(uint => uint) public calculatedEscrowedAmountForPeriod;
    mapping(uint => uint) public calculatedBonusPointsForPeriod;
    mapping(uint => uint) public calculatedRevenueForPeriod;

    mapping(bytes32 => bool) public messageIdAlreadyReceived;
    mapping(uint => uint64) public messagesReceivedFromChainSelector;
    mapping(uint => bytes) public messagesReceived;
    uint public numOfMessagesReceived;

    uint public numOfActiveCollectors;
    uint public period;
    uint public baseRewardsPerPeriod;
    uint public extraRewardsPerPeriod;
    uint public numOfCollectedResultsForThisPeriod;
    uint public lastPeriodBeforeTesting;

    bool public readyToBroadcast;
    bool public readOnlyMode;
    uint public gasLimitUsed;
    uint public weeklyRewardsDecreaseFactor;

    /* ========== INITIALIZERS ========== */
    function initialize(
        address _router,
        bool _masterCollector,
        uint64 _masterCollectorSelector
    ) public initializer {
        setOwner(msg.sender);
        initNonReentrant();
        _setRouter(_router);
        s_router = IRouterClient(_router);
        gasLimitUsed = 1000000;
        if (_masterCollector) {
            masterCollector = address(this);
            masterCollectorChain = _masterCollectorSelector;
            chainSelector[0] = _masterCollectorSelector;
            collectorAddress[_masterCollectorSelector] = address(this);
            chainSelectorIndex[_masterCollectorSelector] = 0;
            numOfActiveCollectors = 1;
            period = 1;
        }
    }

    receive() external payable {}

    /* ========== VIEW FUNCTIONS ========== */

    function isMasterCollector() external view returns (bool isMaster) {
        isMaster = masterCollector == address(this);
    }

    function lastMessageFromChainSelector() external view returns (uint64 chainSelector_) {
        if (numOfMessagesReceived > 0) {
            chainSelector_ = messagesReceivedFromChainSelector[numOfMessagesReceived - 1];
        }
    }

    /* ========== EXTERNAL FUNCTIONS ========== */

    function sendOnClosePeriod(
        uint _totalStakedLastPeriodEnd,
        uint _totalEscrowedLastPeriodEnd,
        uint _bonusPoints,
        uint _revShare
    ) external {
        require(msg.sender == stakingThales, "InvSender");
        if (masterCollector == address(this)) {
            _storeRewards(
                masterCollectorChain,
                _totalStakedLastPeriodEnd,
                _totalEscrowedLastPeriodEnd,
                _bonusPoints,
                _revShare
            );
            ++numOfCollectedResultsForThisPeriod;
            if (numOfCollectedResultsForThisPeriod == numOfActiveCollectors) {
                readyToBroadcast = true;
            }
        } else {
            bytes memory message = abi.encode(
                _totalStakedLastPeriodEnd,
                _totalEscrowedLastPeriodEnd,
                _bonusPoints,
                _revShare
            );
            _sendMessageToChain(masterCollectorChain, message);
        }
        emit SentOnClosePeriod(_totalStakedLastPeriodEnd, _totalEscrowedLastPeriodEnd, _bonusPoints, _revShare);
    }

    function broadcastMessageToAll() external onlyOwner {
        if (readyToBroadcast) {
            _broadcastMessageToAll();
            numOfCollectedResultsForThisPeriod = 0;
            readyToBroadcast = false;
            ++period;
            if (weeklyRewardsDecreaseFactor > 0) {
                _setRewardsForNextPeriod();
            }
        }
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /// handle a received message
    function _ccipReceive(Client.Any2EVMMessage memory any2EvmMessage) internal override {
        // decoding the message
        if (!messageIdAlreadyReceived[any2EvmMessage.messageId]) {
            address sender = abi.decode(any2EvmMessage.sender, (address));
            messagesReceivedFromChainSelector[numOfMessagesReceived] = any2EvmMessage.sourceChainSelector;
            messagesReceived[numOfMessagesReceived] = any2EvmMessage.data;
            messageIdAlreadyReceived[any2EvmMessage.messageId] = true;
            ++numOfMessagesReceived;

            if (masterCollector == address(this)) {
                uint sourceChainSelector = any2EvmMessage.sourceChainSelector;
                if (readOnlyMode) {
                    if (collectorAddress[sourceChainSelector] == sender) {
                        _calculateRewards(any2EvmMessage.data, sourceChainSelector);
                    }
                    ++numOfCollectedResultsForThisPeriod;
                    if (numOfCollectedResultsForThisPeriod == numOfActiveCollectors) {
                        readyToBroadcast = true;
                    }
                } else if (
                    collectorAddress[sourceChainSelector] == sender && lastPeriodForChain[sourceChainSelector] < period
                ) {
                    lastPeriodForChain[sourceChainSelector] = period;
                    _calculateRewards(any2EvmMessage.data, sourceChainSelector);
                    ++numOfCollectedResultsForThisPeriod;
                    if (numOfCollectedResultsForThisPeriod == numOfActiveCollectors) {
                        readyToBroadcast = true;
                    }
                }
            } else if (masterCollector == sender) {
                _updateRewardsOnStakingContract(any2EvmMessage.data);
            }
        }
        emit MessageReceived(
            any2EvmMessage.messageId,
            any2EvmMessage.sourceChainSelector, // fetch the source chain identifier (aka selector)
            abi.decode(any2EvmMessage.sender, (address)), // abi-decoding of the sender address,
            any2EvmMessage.data
        );
    }

    function _calculateRewards(bytes memory data, uint _chainSelector) internal {
        (uint stakedAmount, uint escrowedAmount, uint bonusPoints, uint revShare) = abi.decode(
            data,
            (uint, uint, uint, uint)
        );
        _storeRewards(_chainSelector, stakedAmount, escrowedAmount, bonusPoints, revShare);
    }

    function _storeRewards(
        uint _chainSelector,
        uint _stakedAmount,
        uint _escrowedAmount,
        uint _bonusPoints,
        uint _revShare
    ) internal {
        chainStakedAmountInPeriod[period][_chainSelector] = _stakedAmount;
        chainEscrowedAmountInPeriod[period][_chainSelector] = _escrowedAmount;
        chainBonusPointsInPeriod[period][_chainSelector] = _bonusPoints;
        chainRevenueInPeriod[period][_chainSelector] = _revShare;

        calculatedStakedAmountForPeriod[period] += _stakedAmount;
        calculatedEscrowedAmountForPeriod[period] += _escrowedAmount;
        calculatedBonusPointsForPeriod[period] += _bonusPoints;
        calculatedRevenueForPeriod[period] += _revShare;
    }

    function _broadcastMessageToAll() internal {
        uint chainBaseRewards;
        uint chainExtraRewards;
        uint revShare;
        bytes memory message;

        for (uint i = 0; i < numOfActiveCollectors; i++) {
            chainBaseRewards =
                ((chainStakedAmountInPeriod[period][chainSelector[i]] +
                    chainEscrowedAmountInPeriod[period][chainSelector[i]]) * baseRewardsPerPeriod) /
                (calculatedStakedAmountForPeriod[period] + calculatedEscrowedAmountForPeriod[period]);

            chainExtraRewards =
                (chainBonusPointsInPeriod[period][chainSelector[i]] * extraRewardsPerPeriod) /
                (calculatedBonusPointsForPeriod[period]);

            revShare =
                ((chainStakedAmountInPeriod[period][chainSelector[i]] +
                    chainEscrowedAmountInPeriod[period][chainSelector[i]]) * calculatedRevenueForPeriod[period]) /
                (calculatedStakedAmountForPeriod[period] + calculatedEscrowedAmountForPeriod[period]);

            chainBaseRewardsInPeriod[period][chainSelector[i]] = chainBaseRewards;
            chainExtraRewardsInPeriod[period][chainSelector[i]] = chainExtraRewards;
            chainRevenueShareInPeriod[period][chainSelector[i]] = revShare;

            message = abi.encode(chainBaseRewards, chainExtraRewards, revShare);
            if (i == 0) {
                _updateRewards(chainBaseRewards, chainExtraRewards, revShare);
            } else {
                _sendMessageToChain(chainSelector[i], message);
            }
        }
    }

    function _sendMessageToChain(uint64 _chainSelector, bytes memory _message) internal returns (bytes32 messageId) {
        Client.EVM2AnyMessage memory evm2AnyMessage = Client.EVM2AnyMessage({
            receiver: abi.encode(collectorAddress[_chainSelector]), // ABI-encoded receiver address
            data: _message, // ABI-encoded string
            tokenAmounts: new Client.EVMTokenAmount[](0), // Empty array indicating no tokens are being sent
            extraArgs: Client._argsToBytes(
                // Additional arguments, setting gas limit and non-strict sequencing mode
                Client.EVMExtraArgsV1({gasLimit: gasLimitUsed, strict: false})
            ),
            // Set the feeToken  address, indicating LINK will be used for fees
            feeToken: address(0)
        });

        // Get the fee required to send the message
        uint256 fees = s_router.getFee(_chainSelector, evm2AnyMessage);

        if (fees > address(this).balance) revert NotEnoughBalance(address(this).balance, fees);

        // Send the message through the router and store the returned message ID
        messageId = s_router.ccipSend{value: fees}(_chainSelector, evm2AnyMessage);

        // Emit an event with message details
        emit MessageSent(messageId, _chainSelector, collectorAddress[_chainSelector], _message, address(0), fees);

        // Return the message ID
        return messageId;
    }

    function _updateRewardsOnStakingContract(bytes memory data) internal {
        (uint baseRewards, uint extraRewards, uint revShare) = abi.decode(data, (uint, uint, uint));
        _updateRewards(baseRewards, extraRewards, revShare);
    }

    function _updateRewards(
        uint _baseRewards,
        uint _extraRewards,
        uint _revShare
    ) internal {
        IStakingThales(stakingThales).updateStakingRewards(_baseRewards, _extraRewards, _revShare);
    }

    function _setRewardsForNextPeriod() internal {
        baseRewardsPerPeriod = (baseRewardsPerPeriod * weeklyRewardsDecreaseFactor) / 1e18;
        extraRewardsPerPeriod = (extraRewardsPerPeriod * weeklyRewardsDecreaseFactor) / 1e18;
    }

    /* ========== CONTRACT SETTERS FUNCTIONS ========== */

    function setStakingThales(address _stakingThales) external onlyOwner {
        stakingThales = _stakingThales;
        emit SetStakingThales(_stakingThales);
    }

    function setCCIPRouter(address _router) external onlyOwner {
        _setRouter(_router);
        s_router = IRouterClient(_router);
        emit SetCCIPRouter(_router);
    }

    function setPeriodRewards(
        uint _baseRewardsPerPeriod,
        uint _extraRewardsPerPeriod,
        uint _weeklyDecreaseFactor
    ) external onlyOwner {
        baseRewardsPerPeriod = _baseRewardsPerPeriod;
        extraRewardsPerPeriod = _extraRewardsPerPeriod;
        weeklyRewardsDecreaseFactor = _weeklyDecreaseFactor;
        emit SetPeriodRewards(_baseRewardsPerPeriod, _extraRewardsPerPeriod, _weeklyDecreaseFactor);
    }

    function setGasLimit(uint _gasLimitUsed) external onlyOwner {
        require(_gasLimitUsed <= MAX_GAS, "Exceeds MAX_GAS");
        gasLimitUsed = _gasLimitUsed;
        emit SetGasLimit(_gasLimitUsed);
    }

    function setMasterCollector(address _masterCollector, uint64 _materCollectorChainId) external onlyOwner {
        masterCollector = _masterCollector;
        masterCollectorChain = _materCollectorChainId;
        collectorAddress[_materCollectorChainId] = _masterCollector;
        chainSelector[0] = _materCollectorChainId;
        chainSelectorIndex[_materCollectorChainId] = 0;
        numOfActiveCollectors = numOfActiveCollectors == 0 ? 1 : numOfActiveCollectors;
        emit MasterCollectorSet(_masterCollector, _materCollectorChainId);
    }

    function setCollectorForChain(
        uint64 _chainId,
        address _collectorAddress,
        uint _slot
    ) external onlyOwner {
        require(masterCollector == address(this), "NonMasterCollector");
        require(_slot <= numOfActiveCollectors, "SlotTooBig");
        if (_slot == numOfActiveCollectors) {
            chainSelector[numOfActiveCollectors] = _chainId;
            collectorAddress[_chainId] = _collectorAddress;
            chainSelectorIndex[_chainId] = numOfActiveCollectors;
            ++numOfActiveCollectors;
        } else if (collectorAddress[_chainId] == address(0) && _collectorAddress == address(0)) {
            --numOfActiveCollectors;
            (collectorAddress[_chainId], chainSelector[chainSelectorIndex[_chainId]]) = (
                collectorAddress[chainSelector[numOfActiveCollectors]],
                chainSelector[numOfActiveCollectors]
            );
            delete collectorAddress[chainSelector[numOfActiveCollectors]];
            delete chainSelector[numOfActiveCollectors];
        } else {
            chainSelector[_slot] = _chainId;
            collectorAddress[_chainId] = _collectorAddress;
            chainSelectorIndex[_chainId] = _slot;
        }
        emit CollectorForChainSet(_chainId, _collectorAddress);
    }

    function setReadOnlyMode(bool _enableReadOnly) external onlyOwner {
        if (_enableReadOnly) {
            lastPeriodBeforeTesting = period;
            readOnlyMode = true;
            period = 0;
        } else {
            readOnlyMode = false;
            period = lastPeriodBeforeTesting;
        }
    }

    /* ========== EVENTS ========== */

    // Event emitted when a message is sent to another chain.
    event MessageSent(
        bytes32 indexed messageId, // The unique ID of the CCIP message.
        uint64 indexed destinationChainSelector, // The chain selector of the destination chain.
        address receiver, // The address of the receiver on the destination chain.
        bytes text, // The text being sent.
        address feeToken, // the token address used to pay CCIP fees.
        uint256 fees // The fees paid for sending the CCIP message.
    );

    // Event emitted when a message is received from another chain.
    event MessageReceived(
        bytes32 indexed messageId, // The unique ID of the message.
        uint64 indexed sourceChainSelector, // The chain selector of the source chain.
        address sender, // The address of the sender from the source chain.
        bytes data // The text that was received.
    );

    event CollectorForChainSet(uint64 chainId, address collectorAddress);
    event MasterCollectorSet(address masterCollector, uint64 materCollectorChainId);
    event SetPeriodRewards(uint _baseRewardsPerPeriod, uint _extraRewardsPerPeriod, uint _weeklyDecreaseFactor);
    event SetCCIPRouter(address _router);
    event SetStakingThales(address _stakingThales);
    event SentOnClosePeriod(
        uint _totalStakedLastPeriodEnd,
        uint _totalEscrowedLastPeriodEnd,
        uint _bonusPoints,
        uint _revShare
    );
    event SetGasLimit(uint _gasLimitUsed);
}

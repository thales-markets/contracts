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
import "../interfaces/IAddressManager.sol";

import "./CCIPReceiverProxy.sol";

/// @title - Cross Chain Collector contract for Thales staking rewards
contract CrossChainCollector is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard, CCIPReceiverProxy {
    // Custom errors to provide more descriptive revert messages.
    error NotEnoughBalance(uint256 currentBalance, uint256 calculatedFees); // Used to make sure contract has enough balance.

    IRouterClient private s_router;
    address private stakingThales;
    // the CrossChainCollector instance on master chain
    address public masterCollector;
    // chainID of the master chain as assigned by CCIP
    uint64 public masterCollectorChain;

    //index to chainId as assigned by CCIP
    mapping(uint => uint64) public chainSelector;
    // chainID to index above
    mapping(uint64 => uint) public chainSelectorIndex;
    // index to collector address
    mapping(uint => address) public collectorAddress;

    mapping(uint => uint) public lastPeriodForChain;

    // first uint is the CCIP period, second uint is the chain selector per CCIP convention
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
    uint public collectedResultsForPeriod;
    uint private lastPeriodBeforeTesting;

    bool public readyToBroadcast;
    bool private readOnlyMode;
    uint public gasLimitUsed;
    uint public weeklyRewardsDecreaseFactor;

    IAddressManager private addressManager;

    uint private constant ONE_MILLION_GAS = 1e6;
    uint private constant MAX_GAS = 10 * ONE_MILLION_GAS;
    uint private constant ONE = 1e18;
    uint64 public localChainSelector;

    /* ========== INITIALIZERS ========== */
    function initialize(
        address _router,
        bool _masterCollector,
        uint64 _masterCollectorSelector,
        uint64 _localChainSelector
    ) public initializer {
        setOwner(msg.sender);
        initNonReentrant();
        _setRouter(_router);
        s_router = IRouterClient(_router);
        gasLimitUsed = ONE_MILLION_GAS;
        localChainSelector = _localChainSelector;
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

    /// @notice Check if this CCIP contract is a master collector CCIP contract
    function isMasterCollector() external view returns (bool isMaster) {
        isMaster = masterCollector == address(this) && localChainSelector == masterCollectorChain;
    }

    /// @notice Get the chain selector number of the last message received on contract
    function getChainSelectorForLastMessage() external view returns (uint64 chainSelector_) {
        if (numOfMessagesReceived > 0) {
            chainSelector_ = messagesReceivedFromChainSelector[numOfMessagesReceived - 1];
        }
    }

    /* ========== EXTERNAL FUNCTIONS ========== */

    /// @notice Used for sending staking information at the end of each period by the (local) Staking contract on the particular chain.
    /// @param _totalStakedLastPeriodEnd the amount of staked THALES at the end of a period
    /// @param _totalEscrowedLastPeriodEnd the amount of escrowed THALES at the end of a period
    /// @param _bonusPoints the total bonus points at the end of a period
    /// @param _revShare the total revenue at the end of a period
    function sendOnClosePeriod(
        uint _totalStakedLastPeriodEnd,
        uint _totalEscrowedLastPeriodEnd,
        uint _bonusPoints,
        uint _revShare
    ) external {
        address _stakingThales_ = addressManager.getAddress("StakingThales");
        require(msg.sender == _stakingThales_, "InvSender");
        _sendOnClosePeriod(_totalStakedLastPeriodEnd, _totalEscrowedLastPeriodEnd, _bonusPoints, _revShare);
    }

    /// @notice Only Admin function: Used for sending staking information at the end of each period by the (local) Staking contract on the particular chain.
    /// @param _totalStakedLastPeriodEnd the amount of staked THALES at the end of a period
    /// @param _totalEscrowedLastPeriodEnd the amount of escrowed THALES at the end of a period
    /// @param _bonusPoints the total bonus points at the end of a period
    /// @param _revShare the total revenue at the end of a period
    function sendOnClosePeriodAdmin(
        uint _totalStakedLastPeriodEnd,
        uint _totalEscrowedLastPeriodEnd,
        uint _bonusPoints,
        uint _revShare
    ) external onlyOwner {
        _sendOnClosePeriod(_totalStakedLastPeriodEnd, _totalEscrowedLastPeriodEnd, _bonusPoints, _revShare);
    }

    /// @notice (If it is master collector) when all messages are received from each chain, the final calculated amounts are broadcasted to all Staking contracts via CCIP
    function broadcastMessageToAll() external nonReentrant {
        require(readyToBroadcast, "NotReadyToBroadcast");
        // the flag is true only if collectedResultsForPeriod == numOfActiveCollectors
        _broadcastMessageToAll(); // messages are broadcasted
        collectedResultsForPeriod = 0; // message counter is reset
        readyToBroadcast = false; // the broadcast flag is reset
        ++period; // the period is increased
        if (weeklyRewardsDecreaseFactor > 0) {
            // in case of dynamic decrease of rewards
            _setRewardsForNextPeriod(); // the rewards for the next period are decreased
        }
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /// @notice function triggered by local Staking contract on close period
    function _sendOnClosePeriod(
        uint _totalStakedLastPeriodEnd,
        uint _totalEscrowedLastPeriodEnd,
        uint _bonusPoints,
        uint _revShare
    ) internal {
        if (masterCollector == address(this) && localChainSelector == masterCollectorChain) {
            _storeRewards(
                masterCollectorChain,
                _totalStakedLastPeriodEnd,
                _totalEscrowedLastPeriodEnd,
                _bonusPoints,
                _revShare
            );
            ++collectedResultsForPeriod;
            if (collectedResultsForPeriod == numOfActiveCollectors) {
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

    /// @notice processing/handling received messages
    function _ccipReceive(Client.Any2EVMMessage memory any2EvmMessage) internal override {
        // decoding the message
        if (!messageIdAlreadyReceived[any2EvmMessage.messageId] && localChainSelector > 0) {
            // check if the particular message has been already received
            address sender = abi.decode(any2EvmMessage.sender, (address)); // get the message sender (used for further checks)
            messagesReceivedFromChainSelector[numOfMessagesReceived] = any2EvmMessage.sourceChainSelector; // store the chain selector of the message
            messagesReceived[numOfMessagesReceived] = any2EvmMessage.data; // store the message content
            messageIdAlreadyReceived[any2EvmMessage.messageId] = true; // flag the message as received
            ++numOfMessagesReceived; // increase the message counter

            if (masterCollector == address(this) && localChainSelector == masterCollectorChain) {
                uint sourceChainSelector = any2EvmMessage.sourceChainSelector; // cache the source collector
                // if the contract is master collector, use master collector mode of processing
                if (
                    collectorAddress[sourceChainSelector] == sender && lastPeriodForChain[sourceChainSelector] < period // check if the sender is registered and it is first incoming message in this period
                ) {
                    lastPeriodForChain[sourceChainSelector] = period; // set last message received in this period
                    _calculateRewards(any2EvmMessage.data, sourceChainSelector); // calculate and store the received rewards information
                    ++collectedResultsForPeriod; // increase the number of collected results
                    if (collectedResultsForPeriod == numOfActiveCollectors) {
                        // if messages are received from all collectors
                        readyToBroadcast = true; // calculated results are ready for broadcasting
                    }
                }
            } else if (
                masterCollector == sender &&
                localChainSelector != any2EvmMessage.sourceChainSelector &&
                localChainSelector != masterCollectorChain
            ) {
                // receive broadcast message from master node
                // if this contract is not a master collector
                _updateRewardsOnStakingContract(any2EvmMessage.data); // process and send incoming message to local Staking contract
            }
        }
        emit MessageReceived(
            any2EvmMessage.messageId,
            any2EvmMessage.sourceChainSelector, // fetch the source chain identifier (aka selector)
            abi.decode(any2EvmMessage.sender, (address)), // abi-decoding of the sender address,
            any2EvmMessage.data
        );
    }

    // @notice decode and store values received
    function _calculateRewards(bytes memory data, uint _chainSelector) internal {
        (uint stakedAmount, uint escrowedAmount, uint bonusPoints, uint revShare) = abi.decode(
            data,
            (uint, uint, uint, uint)
        );
        _storeRewards(_chainSelector, stakedAmount, escrowedAmount, bonusPoints, revShare);
    }

    // @notice store the rewards
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

    // @notice broadcast messages
    function _broadcastMessageToAll() internal {
        uint chainBaseRewards;
        uint chainExtraRewards;
        uint revShare;
        bytes memory message;

        for (uint i = 0; i < numOfActiveCollectors; i++) {
            uint64 chainId = chainSelector[i];
            chainBaseRewards =
                ((chainStakedAmountInPeriod[period][chainId] + chainEscrowedAmountInPeriod[period][chainId]) *
                    baseRewardsPerPeriod) /
                (calculatedStakedAmountForPeriod[period] + calculatedEscrowedAmountForPeriod[period]);

            chainExtraRewards =
                (chainBonusPointsInPeriod[period][chainId] * extraRewardsPerPeriod) /
                (calculatedBonusPointsForPeriod[period]);

            revShare =
                ((chainStakedAmountInPeriod[period][chainId] + chainEscrowedAmountInPeriod[period][chainId]) *
                    calculatedRevenueForPeriod[period]) /
                (calculatedStakedAmountForPeriod[period] + calculatedEscrowedAmountForPeriod[period]);

            chainBaseRewardsInPeriod[period][chainId] = chainBaseRewards;
            chainExtraRewardsInPeriod[period][chainId] = chainExtraRewards;
            chainRevenueShareInPeriod[period][chainId] = revShare;

            message = abi.encode(chainBaseRewards, chainExtraRewards, revShare);
            // 0 index is master
            if (masterCollectorChain == chainId) {
                _updateRewards(chainBaseRewards, chainExtraRewards, revShare);
            } else {
                _sendMessageToChain(chainId, message);
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
        IStakingThales _stakingThales_ = IStakingThales(addressManager.getAddress("StakingThales"));
        _stakingThales_.updateStakingRewards(_baseRewards, _extraRewards, _revShare);
    }

    function _setRewardsForNextPeriod() internal {
        baseRewardsPerPeriod = (baseRewardsPerPeriod * weeklyRewardsDecreaseFactor) / ONE;
        extraRewardsPerPeriod = (extraRewardsPerPeriod * weeklyRewardsDecreaseFactor) / ONE;
    }

    /* ========== CONTRACT SETTERS FUNCTIONS ========== */

    /// @notice Set address manager on contract
    /// @param _addressManager address of Address Manager contract
    function setAddressManager(address _addressManager) external onlyOwner {
        addressManager = IAddressManager(_addressManager);
        emit SetAddressManager(_addressManager);
    }

    /// @notice Set CCIP router per chain
    /// @param _router address of CCIP Router contract
    function setCCIPRouter(address _router) external onlyOwner {
        _setRouter(_router);
        s_router = IRouterClient(_router);
        emit SetCCIPRouter(_router);
    }

    /// @notice Set CCIP router per chain
    /// @param _baseRewardsPerPeriod base rewards per period
    /// @param _extraRewardsPerPeriod extra rewards per period
    /// @param _weeklyDecreaseFactor weekly decrease factor in (X * 1e16, where X is percentage - e.g. 5% = 5*1e16)
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

    /// @notice Set gas limit to be used for for cross message
    /// @param _gasLimitUsed gas limit
    function setGasLimit(uint _gasLimitUsed) external onlyOwner {
        require(_gasLimitUsed <= MAX_GAS, "Exceeds MAX_GAS");
        gasLimitUsed = _gasLimitUsed;
        emit SetGasLimit(_gasLimitUsed);
    }

    /// @notice Set master collector address and selector
    /// @param _masterCollector address of the master collector
    /// @param _materCollectorChainId Chainlink predefined selector per chain
    function setMasterCollector(
        address _masterCollector,
        uint64 _materCollectorChainId,
        uint64 _localChainSelector
    ) external onlyOwner {
        localChainSelector = _localChainSelector;
        masterCollector = _masterCollector;
        masterCollectorChain = _materCollectorChainId;
        collectorAddress[_materCollectorChainId] = _masterCollector;
        chainSelector[0] = _materCollectorChainId;
        chainSelectorIndex[_materCollectorChainId] = 0;
        numOfActiveCollectors = numOfActiveCollectors == 0 ? 1 : numOfActiveCollectors;
        emit MasterCollectorSet(_masterCollector, _materCollectorChainId);
    }

    /// @notice (ONLY in Master collector): Add a new destination chain CCIP Collector contract
    /// @param _chainId the chain selector
    /// @param _collectorAddress Chainlink predefined selector per chain
    function setCollectorForChain(
        uint64 _chainId,
        address _collectorAddress,
        uint _slot
    ) external onlyOwner {
        require(masterCollector == address(this) && localChainSelector == masterCollectorChain, "NonMasterCollector");
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

    /// @notice Reset most of the data in the contract
    function resetAllData() external onlyOwner {
        require(numOfActiveCollectors > 0, "AlreadyResetAllSlots");
        for (uint i = 0; i < numOfActiveCollectors; i++) {
            delete chainSelectorIndex[chainSelector[i]];
            delete collectorAddress[chainSelector[i]];
            delete chainSelector[i];
            lastPeriodForChain[chainSelector[i]] = 0;
        }
        numOfActiveCollectors = 0;
        collectedResultsForPeriod = 0;
        masterCollector = address(0);
        masterCollectorChain = 0;
        period = 0;
        numOfMessagesReceived = 0;
        baseRewardsPerPeriod = 0;
        extraRewardsPerPeriod = 0;
        emit RemovedAllData();
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
    event SetAddressManager(address _addressManager);
    event SentOnClosePeriod(
        uint _totalStakedLastPeriodEnd,
        uint _totalEscrowedLastPeriodEnd,
        uint _bonusPoints,
        uint _revShare
    );
    event SetGasLimit(uint _gasLimitUsed);
    event RemovedAllData();
}

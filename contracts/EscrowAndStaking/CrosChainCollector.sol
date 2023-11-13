// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
// import {LinkTokenInterface} from "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

import "../interfaces/IStakingThales.sol";

/// @title - Cross Chain Collector contract for Thales staking rewards
contract CrossChainCollector is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard, CCIPReceiver {
    // Custom errors to provide more descriptive revert messages.
    error NotEnoughBalance(uint256 currentBalance, uint256 calculatedFees); // Used to make sure contract has enough balance.

    IRouterClient private s_router;

    bytes32 private s_lastReceivedMessageId; // Store the last received messageId.
    string private s_lastReceivedText; // Store the last received text.
    address public masterCollector;
    address public stakingThales;
    uint64 public masterCollectorChain;
    mapping(uint => uint64) public supportedChains;
    mapping(uint => address) public collectorForChain;
    mapping(uint => uint) public lastPeriodForChain;

    mapping(uint => mapping(uint => uint)) public chainStakedAmountInPeriod;
    mapping(uint => mapping(uint => uint)) public chainEscrowedAmountInPeriod;

    mapping(uint => mapping(uint => uint)) public chainBaseRewardsInPeriod;
    mapping(uint => mapping(uint => uint)) public chainExtraRewardsInPeriod;

    mapping(uint => uint) public calculatedStakedAmountForPeriod;
    mapping(uint => uint) public calculatedEscrowedAmountForPeriod;

    uint public numOfActiveCollectors;
    uint public period;
    uint public baseRewardsPerPeriod;
    uint public extraRewardsPerPeriod;
    uint private collectedResultsPerPeriod;

    function initialize(address _router, bool _masterCollector) public initializer {
        setOwner(msg.sender);
        initNonReentrant();
        setRouter(_router);
        s_router = IRouterClient(_router);
        if (_masterCollector) {
            masterCollector = address(this);
            period = 1;
        }
    }

    receive() external payable {}

    /// handle a received message
    function _ccipReceive(Client.Any2EVMMessage memory any2EvmMessage) internal override {
        s_lastReceivedMessageId = any2EvmMessage.messageId; // fetch the messageId
        // decoding the message
        s_lastReceivedText = abi.decode(any2EvmMessage.data, (string)); // abi-decoding of the sent text
        address sender = abi.decode(any2EvmMessage.sender, (address));

        if (masterCollector == address(this)) {
            uint chainSelector = any2EvmMessage.sourceChainSelector;
            if (collectorForChain[chainSelector] == sender && lastPeriodForChain[chainSelector] < period) {
                ++lastPeriodForChain[chainSelector];
                _calculateRewards(any2EvmMessage.data, chainSelector);
                // perform calculations
                ++collectedResultsPerPeriod;
                if (collectedResultsPerPeriod == numOfActiveCollectors) {
                    // broadcast message
                    _broadcastMessageToAll();
                    ++period;
                    collectedResultsPerPeriod = 0;
                }
            }
        } else if (masterCollector == sender) {
            _updateRewardsOnStakingContract(any2EvmMessage.data);
        }
        emit MessageReceived(
            any2EvmMessage.messageId,
            any2EvmMessage.sourceChainSelector, // fetch the source chain identifier (aka selector)
            abi.decode(any2EvmMessage.sender, (address)), // abi-decoding of the sender address,
            abi.decode(any2EvmMessage.data, (string))
        );
    }

    function _calculateRewards(bytes memory data, uint chainSelector) internal {
        (uint stakedAmount, uint escrowedAmount) = abi.decode(data, (uint, uint));
        chainStakedAmountInPeriod[period][chainSelector] = stakedAmount;
        chainEscrowedAmountInPeriod[period][chainSelector] = escrowedAmount;

        calculatedStakedAmountForPeriod[period] += stakedAmount;
        calculatedEscrowedAmountForPeriod[period] += escrowedAmount;
    }

    function _broadcastMessageToAll() internal {
        uint chainBaseRewards;
        uint chainExtraRewards;
        bytes memory message;

        for (uint i = 0; i < numOfActiveCollectors; i++) {
            chainBaseRewards =
                (chainStakedAmountInPeriod[period][supportedChains[i]] * baseRewardsPerPeriod) /
                (calculatedStakedAmountForPeriod[period] + calculatedEscrowedAmountForPeriod[period]);
            chainExtraRewards =
                (chainStakedAmountInPeriod[period][supportedChains[i]] * extraRewardsPerPeriod) /
                (calculatedStakedAmountForPeriod[period] + calculatedEscrowedAmountForPeriod[period]);
            message = abi.encode(
                chainBaseRewards,
                chainExtraRewards,
                calculatedStakedAmountForPeriod[period],
                calculatedEscrowedAmountForPeriod[period]
            );
            _sendMessageToChain(supportedChains[i], message);
        }
        _updateRewards(
            chainBaseRewards,
            chainExtraRewards,
            calculatedStakedAmountForPeriod[period],
            calculatedEscrowedAmountForPeriod[period]
        );
    }

    function _sendMessageToChain(uint64 chainSelector, bytes memory _message) internal returns (bytes32 messageId) {
        Client.EVM2AnyMessage memory evm2AnyMessage = Client.EVM2AnyMessage({
            receiver: abi.encode(collectorForChain[chainSelector]), // ABI-encoded receiver address
            data: _message, // ABI-encoded string
            tokenAmounts: new Client.EVMTokenAmount[](0), // Empty array indicating no tokens are being sent
            extraArgs: Client._argsToBytes(
                // Additional arguments, setting gas limit and non-strict sequencing mode
                Client.EVMExtraArgsV1({gasLimit: 200_000, strict: false})
            ),
            // Set the feeToken  address, indicating LINK will be used for fees
            feeToken: address(0)
        });

        // Get the fee required to send the message
        uint256 fees = s_router.getFee(chainSelector, evm2AnyMessage);

        if (fees > address(this).balance) revert NotEnoughBalance(address(this).balance, fees);

        // Send the message through the router and store the returned message ID
        messageId = s_router.ccipSend(chainSelector, evm2AnyMessage);

        // Emit an event with message details
        emit MessageSent(messageId, chainSelector, collectorForChain[chainSelector], _message, address(0), fees);

        // Return the message ID
        return messageId;
    }

    function _updateRewardsOnStakingContract(bytes memory data) internal {
        (uint baseRewards, uint extraRewards, uint stakedAmount, uint escrowedAmount) = abi.decode(
            data,
            (uint, uint, uint, uint)
        );
        _updateRewards(baseRewards, extraRewards, stakedAmount, escrowedAmount);
    }

    function _updateRewards(
        uint _baseRewards,
        uint _extraRewards,
        uint _stakedAmount,
        uint _escrowedAmount
    ) internal {
        IStakingThales(stakingThales).updateStakingRewards(_baseRewards, _extraRewards, _stakedAmount, _escrowedAmount);
    }

    function sendOnClosePeriod(uint _totalStakedLastPeriodEnd, uint _totalEscrowedLastPeriodEnd) external {
        require(msg.sender == stakingThales, "InvSender");
        bytes memory message = abi.encode(_totalStakedLastPeriodEnd, _totalEscrowedLastPeriodEnd);
        _sendMessageToChain(masterCollectorChain, message);
    }

    /// @notice Fetches the details of the last received message.
    /// @return messageId The ID of the last received message.
    /// @return text The last received text.
    function getLastReceivedMessageDetails() external view returns (bytes32 messageId, string memory text) {
        return (s_lastReceivedMessageId, s_lastReceivedText);
    }

    /// @notice Sends data to receiver on the destination chain.
    /// @dev Assumes your contract has sufficient LINK.
    /// @param destinationChainSelector The identifier (aka selector) for the destination blockchain.
    /// @param receiver The address of the recipient on the destination blockchain.
    /// @param text The string text to be sent.
    /// @return messageId The ID of the message that was sent.
    function sendMessage(
        uint64 destinationChainSelector,
        address receiver,
        string calldata text
    ) external onlyOwner returns (bytes32 messageId) {
        // Create an EVM2AnyMessage struct in memory with necessary information for sending a cross-chain message
        Client.EVM2AnyMessage memory evm2AnyMessage = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver), // ABI-encoded receiver address
            data: abi.encode(text), // ABI-encoded string
            tokenAmounts: new Client.EVMTokenAmount[](0), // Empty array indicating no tokens are being sent
            extraArgs: Client._argsToBytes(
                // Additional arguments, setting gas limit and non-strict sequencing mode
                Client.EVMExtraArgsV1({gasLimit: 200_000, strict: false})
            ),
            // Set the feeToken  address, indicating LINK will be used for fees
            feeToken: address(0)
        });

        // Get the fee required to send the message
        uint256 fees = s_router.getFee(destinationChainSelector, evm2AnyMessage);

        if (fees > address(this).balance) revert NotEnoughBalance(address(this).balance, fees);

        // Send the message through the router and store the returned message ID
        messageId = s_router.ccipSend(destinationChainSelector, evm2AnyMessage);

        // Emit an event with message details
        emit MessageSent(messageId, destinationChainSelector, receiver, bytes(text), address(0), fees);

        // Return the message ID
        return messageId;
    }

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
        string text // The text that was received.
    );
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UserOperation} from "./Biconomy/interfaces/UserOperation.sol";
import {ECDSA} from "./OpenZepellin/ECDSA.sol";

contract SessionValidationModule is Initializable {
    /**
     * User Operation struct
     * @param sender the sender account of this request
     * @param nonce unique value the sender uses to verify it is not a replay.
     * @param initCode if set, the account contract will be created by this constructor
     * @param callData the method call to execute on this account.
     * @param verificationGasLimit gas used for validateUserOp and validatePaymasterUserOp
     * @param preVerificationGas gas not calculated by the handleOps method, but added to the gas paid. Covers batch overhead.
     * @param maxFeePerGas same as EIP-1559 gas parameter
     * @param maxPriorityFeePerGas same as EIP-1559 gas parameter
     * @param paymasterAndData if set, this field hold the paymaster address and "paymaster-specific-data". the paymaster will pay for the transaction instead of the sender
     * @param signature sender-verified signature over the entire request, the EntryPoint address and the chain ID.
     */
    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }

    address public creatorContract;
    address public speedMarketsAMM;
    address public chainedSpeedMarkets;

    function initialize(
        address _creatorContract,
        address _speedMarketsAMM,
        address _chainedSpeedMarkets
    ) external initializer {
        creatorContract = _creatorContract;
        speedMarketsAMM = _speedMarketsAMM;
        chainedSpeedMarkets = _chainedSpeedMarkets;
    }

    /**
     * @dev validates if the _op (UserOperation) matches the SessionKey permissions
     * and that _op has been signed by this SessionKey
     * Please mind the decimals of your exact token when setting maxAmount
     * @param _op User Operation to be validated.
     * @param _userOpHash Hash of the User Operation to be validated.
     * @param _sessionKeyData SessionKey data, that describes sessionKey permissions
     * @param _sessionKeySignature Signature over the the _userOpHash.
     * @return true if the _op is valid, false otherwise.
     */
    function validateSessionUserOp(
        UserOperation calldata _op,
        bytes32 _userOpHash,
        bytes calldata _sessionKeyData,
        bytes calldata _sessionKeySignature
    ) external view returns (bool) {
        bytes calldata callData = _op.callData;

        address sessionKey = abi.decode(_sessionKeyData[:20], (address));
        uint160 destContract;
        uint160 destContract2;

        assembly {
            // There are two types of calldata that is being sent for validation.
            // First one is without paymaster and second one is with paymaster.
            // When calldata does not contain paymaster the destination contract is after the selector and we need to skip 0x4 bytes.
            // When calldata contains paymaster data then the destination contract is after 0xa4 bytes.
            destContract := calldataload(add(callData.offset, 0x4))
            destContract2 := calldataload(add(callData.offset, 0xa4))
        }

        if (
            address(destContract) == creatorContract ||
            address(destContract2) == creatorContract ||
            address(destContract) == speedMarketsAMM ||
            address(destContract2) == speedMarketsAMM ||
            address(destContract) == chainedSpeedMarkets ||
            address(destContract2) == chainedSpeedMarkets
        ) {
            return address(sessionKey) == ECDSA.recover(ECDSA.toEthSignedMessageHash(_userOpHash), _sessionKeySignature);
        }
        revert("forbiden destination");
    }
}

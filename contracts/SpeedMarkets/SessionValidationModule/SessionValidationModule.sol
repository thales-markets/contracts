// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UserOperation} from "./Biconomy/interfaces/UserOperation.sol";
import {ECDSA} from "./OpenZepellin/ECDSA.sol";

contract SessionValidationModule is Initializable {
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
        address sessionKey = address(bytes20(_sessionKeyData[0:20]));
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

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ISessionValidationModule, UserOperation} from "./Biconomy/interfaces/ISessionValidationModule.sol";
import {ECDSA} from "./OpenZepellin/ECDSA.sol";

uint256 constant SELECTOR_LENGTH = 4;

abstract contract SessionValidationModule is ISessionValidationModule {
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
    ) external pure override returns (bool) {
        bytes calldata callData = _op.callData;

        require(
            bytes4(callData[0:4]) == EXECUTE_OPTIMIZED_SELECTOR || bytes4(callData[0:4]) == EXECUTE_SELECTOR,
            "ABISV Not Execute Selector"
        );

        uint160 destContract;
        uint256 callValue;
        bytes calldata data;
        assembly {
            //offset of the first 32-byte arg is 0x4
            destContract := calldataload(add(callData.offset, SELECTOR_LENGTH))
            //offset of the second 32-byte arg is 0x24 = 0x4 (SELECTOR_LENGTH) + 0x20 (first 32-byte arg)
            callValue := calldataload(add(callData.offset, 0x24))

            //we get the data offset from the calldata itself, so no assumptions are made about the data layout
            let dataOffset := add(
                add(callData.offset, 0x04),
                //offset of the bytes arg is stored after selector and two first 32-byte args
                // 0x4+0x20+0x20=0x44
                calldataload(add(callData.offset, 0x44))
            )

            let length := calldataload(dataOffset)
            //data itself starts after the length which is another 32bytes word, so we add 0x20
            data.offset := add(dataOffset, 0x20)
            data.length := length
        }

        return
            _validateSessionParams(address(destContract), _sessionKeyData) ==
            ECDSA.recover(ECDSA.toEthSignedMessageHash(_userOpHash), _sessionKeySignature);
    }

    /**
     * @dev validates that the call (destinationContract, callValue, funcCallData)
     * complies with the Session Key permissions represented by sessionKeyData
     * @param destinationContract address of the contract to be called
     * @param _sessionKeyData SessionKey data, that describes sessionKey permissions
     * @return sessionKey address of the sessionKey that signed the userOp
     * for example to store a list of allowed tokens or receivers
     */
    function _validateSessionParams(address destinationContract, bytes calldata _sessionKeyData)
        internal
        pure
        virtual
        returns (address)
    {
        address sessionKey = address(bytes20(_sessionKeyData[0:20]));

        if (
            destinationContract != address(0x101948A58C35cc84499c4eE282A27bc59217D98B) ||
            destinationContract != address(0x9cF89a7067D2E564803CC2Ba5dAbf03B1Daaf469) ||
            destinationContract != address(0xF8352cB770aCB5b70721Ef10e0D83F386ceD4139)
        ) {
            revert("ABISV Destination Forbidden");
        }

        return sessionKey;
    }
}

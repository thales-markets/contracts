pragma solidity ^0.8.0;

import "./ContractTest.sol";

// This contract is used to invoke the function in ContractTest.
contract Invoker {
    ContractTest myContract;

    constructor(address _myContract) public {
        myContract = ContractTest(_myContract);
    }

    event AddedValuesByCall(uint256 a, uint256 b, bool success);
    event MessageSent(address _from, address _to, bytes message);
    event MessageRaw(bytes result, string invokeStr);
    event MessageDecoded(
        bytes4 _invokeMsg,
        address _market,
        uint _position,
        uint _amount,
        uint _expectedPayout,
        uint _additionalSlippage
    );

    function addValuesWithCall(
        address calculator,
        uint256 a,
        uint256 b
    ) public returns (uint256) {
        (bool success, bytes memory result) = calculator.call(abi.encodeWithSignature("add(uint256,uint256)", a, b));
        emit AddedValuesByCall(a, b, success);
        return abi.decode(result, (uint256));
    }

    function simulateBuyFromAMM(
        address _market,
        uint _position,
        uint _amount,
        uint _expectedPayout,
        uint _additionalSlippage
    ) external {
        bytes memory message = abi.encodePacked(
            "buyFromAMM(address,uint,uint,uint,uint)",
            _market,
            _position,
            _amount,
            _expectedPayout,
            _additionalSlippage
        );
        bytes memory message2 = abi.encodeWithSignature(
            "buyFromAMM(address,uint,uint,uint,uint)",
            _market,
            _position,
            _amount,
            _expectedPayout,
            _additionalSlippage
        );
        emit MessageSent(msg.sender, address(this), message);
        emit MessageSent(msg.sender, address(this), message2);
        string memory invokeFunc = "buyFromAMM(address,uint,uint,uint,uint,address,address,address)";
        bytes4 invokeFunc4 = bytes4(keccak256(bytes(invokeFunc)));
        // bytes32 invokeFunc32;
        // assembly {
        //     invokeFunc32 := mload(add(invokeFunc, 32))
        // }

        // bytes memory message3 = abi.encode(invokeFunc32, _market, _position, _amount, _expectedPayout, _additionalSlippage);
        bytes memory message4 = abi.encode(invokeFunc4, _market, _position, _amount, _expectedPayout, _additionalSlippage);
        emit MessageSent(msg.sender, address(this), message4);
        (bytes4 funcInvoke, address market, uint position, uint amount, uint expectedPayout, uint additionalSlippage) = abi
            .decode(message4, (bytes4, address, uint, uint, uint, uint));
        require(market == _market, "Market not equal");
        emit MessageDecoded(funcInvoke, market, position, amount, expectedPayout, additionalSlippage);
        emit MessageRaw(message4, invokeFunc);
    }

    function simulateAddValueWithSelector(
        address calculator,
        uint256 a,
        uint256 b
    ) public returns (uint256) {
        bytes4 addSelector = bytes4(keccak256(bytes("add(uint256,uint256)")));
        (bool success, bytes memory result) = calculator.call(abi.encodeWithSelector(addSelector, a, b));
        emit AddedValuesByCall(a, b, success);
        return abi.decode(result, (uint256));
    }

    function invokeMyFunction(uint256 _value) public {
        // The function selector for "myFunction" is the first 4 bytes of the
        // Keccak-256 hash of the function signature, in this case:
        //   "myFunction(uint256)" => "0x8be65246"
        bytes4 functionSelector = 0x8be65246;

        // The arguments for the function are encoded as a byte array. In this
        // case, we only have a single argument of type uint256, so we need to
        // encode the value as a 32-byte array.
        bytes memory encodedArgs = new bytes(32);
        assembly {
            // Copy the value to the end of the encodedArgs array.
            mstore(add(encodedArgs, 32), _value)
        }

        // The data field for the function call is the function selector followed
        // by the encoded arguments.
        bytes memory data = new bytes(36);
        assembly {
            // Copy the function selector to the start of the data array.
            mstore(data, functionSelector)

            // Copy the encoded arguments to the end of the data array.
            mstore(add(data, 4), encodedArgs)
        }

        // Use the address of ContractTest and the data field to invoke the function.
        (bool success, bytes memory returndata) = address(myContract).call(data);
        require(success, "Invocation failed");
    }
}

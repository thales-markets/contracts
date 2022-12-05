pragma solidity ^0.8.0;

contract ContractTest {
    uint256 public storedValue;
    address public user;

    function myFunction(uint256 _value) public {
        // Do something with the value passed to the function.
        storedValue = _value;
    }

    event Add(uint256 a, uint256 b);

    function add(uint256 a, uint256 b) public returns (uint256) {
        storedValue = a + b;
        assert(storedValue >= a);

        emit Add(a, b);
        user = msg.sender;

        return storedValue;
    }

    function readValue() public view returns (uint256) {
        return storedValue;
    }
}

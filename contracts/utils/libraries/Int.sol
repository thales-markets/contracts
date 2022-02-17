// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Int {
    /**
     * Parse Int
     * 
     * Converts an ASCII string value into an uint as long as the string 
     * its self is a valid unsigned integer
     * 
     * @param _a The ASCII string to be converted to an unsigned integer
     * @return _parsedInt The unsigned value of the ASCII string
     */
    // function parseInt(string memory _value)
    //     public
    //     pure
    //     returns (uint _ret) {
    //     bytes memory _bytesValue = bytes(_value);
    //     uint j = 1;
    //     for(uint i = _bytesValue.length-1; i >= 0 && i < _bytesValue.length; i--) {
    //         assert(uint8(_bytesValue[i]) >= 48 && uint8(_bytesValue[i]) <= 57);
    //         _ret += (uint8(_bytesValue[i]) - 48)*j;
    //         j*=10;
    //     }
    // }

    function parseInt(string memory _a) public pure returns (uint _parsedInt) {
        bytes memory bresult = bytes(_a);
        uint mint = 0;
        bool decimals = false;
        for (uint i = 0; i < bresult.length; i++) {
            if ((uint(uint8(bresult[i])) >= 48) && (uint(uint8(bresult[i])) <= 57)) {
                if (decimals) {
                   break;
                }
                mint *= 10;
                mint += uint(uint8(bresult[i])) - 48;
            } else if (uint(uint8(bresult[i])) == 46) {
                decimals = true;
            }
        }

        return mint;
    }
}
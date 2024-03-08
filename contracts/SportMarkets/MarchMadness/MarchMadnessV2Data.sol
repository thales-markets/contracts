// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./MarchMadnessV2.sol";

contract MarchMadnessV2Data {
    MarchMadnessV2 public mmv2;

    constructor(address _mmv2) {
        mmv2 = MarchMadnessV2(_mmv2);
    }

    /* ========== VIEW ========== */
    function getBracketsByItemId(uint itemId) public view returns (uint[63] memory brackets) {
        for (uint i = 0; i < brackets.length; i++) {
            brackets[i] = mmv2.itemToBrackets(itemId, i);
        }
    }
}

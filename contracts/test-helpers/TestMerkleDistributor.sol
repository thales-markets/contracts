// SPDX-License-Identifier: MIT
pragma solidity ^0.5.16;
import "../customOracle/IMerkleDistributor.sol";

// Allows anyone to claim a token if they exist in a merkle root.
contract TestMerkleDistributor is IMerkleDistributor {

    uint256 public claimed;
    uint256 public totalClaims;

    function setClaimed(uint256 _claimed) public {
        claimed = _claimed;
    }

}

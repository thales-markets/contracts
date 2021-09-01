// SPDX-License-Identifier: MIT
pragma solidity ^0.5.16;

// Allows anyone to claim a token if they exist in a merkle root.
interface IMerkleDistributor {
    // Returns the address of the token distributed by this contract.
    function totalClaims() external view returns (uint256);

    function claimed() external view returns (uint256);
}

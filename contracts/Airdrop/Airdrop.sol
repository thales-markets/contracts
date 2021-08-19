pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/IERC20.sol";
import "synthetix-2.43.1/contracts/Owned.sol";
import "openzeppelin-solidity-2.3.0/contracts/cryptography/MerkleProof.sol";
import "synthetix-2.43.1/contracts/Pausable.sol";

/**
 * Contract which implements a merkle airdrop for a given token
 * Based on an account balance snapshot stored in a merkle tree
 */
contract Airdrop is Owned, Pausable {
    IERC20 public token;

    bytes32 public root; // merkle tree root

    uint256 public startTime;

    mapping(uint256 => uint256) public _claimed;

    constructor(
        address _owner,
        IERC20 _token,
        bytes32 _root
    ) public Owned(_owner) Pausable() {
        token = _token;
        root = _root;
        startTime = block.timestamp;
    }

    // Check if a given reward has already been claimed
    function claimed(uint256 index) public view returns (uint256 claimedBlock, uint256 claimedMask) {
        claimedBlock = _claimed[index / 256];
        claimedMask = (uint256(1) << uint256(index % 256));
        require((claimedBlock & claimedMask) == 0, "Tokens have already been claimed");
    }

    // Get airdrop tokens assigned to address
    // Requires sending merkle proof to the function
    function claim(
        uint256 index,
        uint256 amount,
        bytes32[] memory merkleProof
    ) public notPaused {
        require(token.balanceOf(address(this)) > amount, "Contract doesnt have enough tokens");

        // Make sure the tokens have not already been redeemed
        (uint256 claimedBlock, uint256 claimedMask) = claimed(index);
        _claimed[index / 256] = claimedBlock | claimedMask;

        // Compute the merkle leaf from index, recipient and amount
        bytes32 leaf = keccak256(abi.encodePacked(index, msg.sender, amount));
        // verify the proof is valid
        require(MerkleProof.verify(merkleProof, root, leaf), "Proof is not valid");
        // Redeem!
        token.transfer(msg.sender, amount);
        emit Claim(msg.sender, amount, block.timestamp);
    }

    function _selfDestruct(address payable beneficiary) external onlyOwner {
        //only callable a year after end time
        require(block.timestamp > (startTime + 365 days), "Contract can only be selfdestruct after a year");

        token.transfer(beneficiary, token.balanceOf(address(this)));

        // Destroy the option tokens before destroying the market itself.
        selfdestruct(beneficiary);
    }

    event Claim(address claimer, uint256 amount, uint timestamp);
}

pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity-2.3.0/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity-2.3.0/contracts/cryptography/MerkleProof.sol";

/**
 * Contract which implements a merkle airdrop for a given token
 * Based on an account balance snapshot stored in a merkle tree
 */
contract OngoingAirdrop is Ownable {

    IERC20 public token;

    bytes32 public root; // merkle tree root

    address public admin;

    mapping (uint256 => uint256) public _claimed;

    constructor (IERC20 _token, bytes32 _root) public {
        token = _token;
        root = _root;
    }

    // Set root of merkle tree
    function setRoot(bytes32 _root) public onlyOwner {
        root = _root;
    }

    // Check if a given reward has already been claimed
    function claimed(uint256 index) public view returns (uint256 claimedBlock, uint256 claimedMask) {
        claimedBlock = _claimed[index / 256];
        claimedMask = (uint256(1) << uint256(index % 256));
        require((claimedBlock & claimedMask) == 0, "Tokens have already been claimed");
    }

    // Get airdrop tokens assigned to address
    // Requires sending merkle proof to the function
    function claim(uint256 index, address recipient, uint256 amount, bytes32[] memory merkleProof) public {
        // Make sure msg.sender is the recipient of this airdrop
        require(msg.sender == recipient, "The reward recipient should be the transaction sender");

        // Make sure the tokens have not already been redeemed
        (uint256 claimedBlock, uint256 claimedMask) = claimed(index);
        _claimed[index / 256] = claimedBlock | claimedMask;

        // Compute the merkle leaf from index, recipient and amount
        bytes32 leaf = keccak256(abi.encodePacked(index, recipient, amount));
        // verify the proof is valid
        require(MerkleProof.verify(merkleProof, root, leaf), "Proof is not valid");
        // Redeem!
        token.transfer(recipient, amount);
    }

    function recoverToken() external onlyOwner {
        token.transfer(msg.sender, token.balanceOf(address(this)));
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Admin only");
        _;
    }
}
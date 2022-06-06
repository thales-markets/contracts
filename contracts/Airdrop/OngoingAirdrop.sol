// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "../utils/Owned.sol";
import "@openzeppelin/contracts-4.4.1/utils/cryptography/MerkleProof.sol";
import "../utils/Pausable.sol";
import "../interfaces/IEscrowThales.sol";

/**
 * Contract which implements a merkle airdrop for a given token
 * Based on an account balance snapshot stored in a merkle tree
 */
contract OngoingAirdrop is Owned, Pausable {
    IERC20 public token;

    IEscrowThales public iEscrowThales;

    bytes32 public root; // merkle tree root

    uint256 public startTime;

    address public admin;

    uint256 public period;

    mapping(uint256 => mapping(uint256 => uint256)) public _claimed;

    constructor(
        address _owner,
        IERC20 _token,
        bytes32 _root
    ) Owned(_owner) Pausable() {
        token = _token;
        root = _root;
        startTime = block.timestamp;
        period = 1;
    }

    // Set root of merkle tree
    function setRoot(bytes32 _root) public onlyOwner {
        require(address(iEscrowThales) != address(0), "Set Escrow Thales address");
        root = _root;
        startTime = block.timestamp; //reset time every period
        emit NewRoot(_root, block.timestamp, period);
        period = period + 1;
    }

    // Set EscrowThales contract address
    function setEscrow(address _escrowThalesContract) public onlyOwner {
        if (address(iEscrowThales) != address(0)) {
            token.approve(address(iEscrowThales), 0);
        }
        iEscrowThales = IEscrowThales(_escrowThalesContract);
        token.approve(_escrowThalesContract, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
    }

    // Check if a given reward has already been claimed
    function claimed(uint256 index) public view returns (uint256 claimedBlock, uint256 claimedMask) {
        claimedBlock = _claimed[period][index / 256];
        claimedMask = (uint256(1) << uint256(index % 256));
        require((claimedBlock & claimedMask) == 0, "Tokens have already been claimed");
    }

    // helper for the dapp
    function canClaim(uint256 index) external view returns (bool) {
        uint256 claimedBlock = _claimed[period][index / 256];
        uint256 claimedMask = (uint256(1) << uint256(index % 256));
        return ((claimedBlock & claimedMask) == 0);
    }

    // Get airdrop tokens assigned to address
    // Requires sending merkle proof to the function
    function claim(
        uint256 index,
        uint256 amount,
        bytes32[] memory merkleProof
    ) public notPaused {
        // Make sure the tokens have not already been redeemed
        (uint256 claimedBlock, uint256 claimedMask) = claimed(index);
        _claimed[period][index / 256] = claimedBlock | claimedMask;

        // Compute the merkle leaf from index, recipient and amount
        bytes32 leaf = keccak256(abi.encodePacked(index, msg.sender, amount));
        // verify the proof is valid
        require(MerkleProof.verify(merkleProof, root, leaf), "Proof is not valid");

        // Send to EscrowThales contract
        iEscrowThales.addToEscrow(msg.sender, amount);

        emit Claim(msg.sender, amount, block.timestamp);
    }

    function _selfDestruct(address payable beneficiary) external onlyOwner {
        token.transfer(beneficiary, token.balanceOf(address(this)));
        selfdestruct(beneficiary);
    }

    event Claim(address claimer, uint256 amount, uint timestamp);
    event NewRoot(bytes32 root, uint timestamp, uint256 period);
}

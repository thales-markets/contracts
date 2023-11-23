// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-4.4.1/utils/cryptography/MerkleProof.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";

// interface
import "../interfaces/ISportsAMM.sol";
import "../interfaces/ISportAMMRiskManager.sol";

/// @title Sports AMM Merkle Tree contract
/// @author vladan
contract SportsAMMMerkleTree is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    bytes32 public root; // merkle tree root

    ISportsAMM public sportsAmm;
    ISportAMMRiskManager public riskManager;

    function initialize(
        address _owner,
        ISportsAMM _sportsAmm,
        ISportAMMRiskManager _riskManager
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        sportsAmm = _sportsAmm;
        riskManager = _riskManager;
    }

    /// @notice Calculate the sUSD cost to buy an amount of available position options from AMM for specific market/game
    /// @param market The address of the SportPositional market of a game
    /// @param position The position (home/away/draw) quoted to buy from AMM
    /// @param amount The position amount quoted to buy from AMM
    /// @return _quote The sUSD cost for buying the `amount` of `position` options (tokens) from AMM for `market`.
    function buyFromAmmQuote(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint baseOdds,
        uint[] memory allBaseOdds,
        bytes32[] memory merkleProof
    ) public view returns (uint _quote) {
        if (sportsAmm.isMarketInAMMTrading(market)) {
            if (baseOdds > 0) {
                // Compute the merkle leaf from market and all odds
                bytes32 leaf = keccak256(abi.encodePacked(market, allBaseOdds));
                // verify the proof is valid
                require(MerkleProof.verify(merkleProof, root, leaf), "Proof is not valid");

                uint flooredBaseOdds = sportsAmm.floorBaseOdds(baseOdds, market);

                ISportsAMM.DoubleChanceStruct memory dcs = sportsAmm.getDoubleChanceStruct(market);

                _quote = sportsAmm.buyFromAmmQuoteWithBaseOdds(
                    market,
                    position,
                    amount,
                    flooredBaseOdds,
                    sportsAmm.safeBoxImpact(),
                    0,
                    false,
                    true,
                    dcs
                );
            }
        }
    }

    /// @notice Setting the addresses for SportsAMMMerkleTree
    /// @param _sportsAMM Address of the Sports AMM
    /// @param _riskManager Address of the Sports AMM risk contract
    function setAddresses(address _sportsAMM, address _riskManager) external onlyOwner {
        sportsAmm = ISportsAMM(_sportsAMM);
        riskManager = ISportAMMRiskManager(_riskManager);

        emit AddressesUpdated(_sportsAMM, _riskManager);
    }

    // @notice Set root of merkle tree
    /// @param _root New root
    function setRoot(bytes32 _root) public onlyOwner {
        root = _root;
        emit NewRoot(_root);
    }

    event AddressesUpdated(address _sportsAMM, address _riskManager);
    event NewRoot(bytes32 root);
}

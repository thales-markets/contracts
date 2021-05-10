pragma solidity ^0.5.16;

// Inheritance
import "synthetix-2.43.1/contracts/MinimalProxyFactory.sol";
import "synthetix-2.43.1/contracts/Owned.sol";


// Internal references
import "./BinaryOptionMarket.sol";
import "synthetix-2.43.1/contracts/interfaces/IAddressResolver.sol";

// https://docs.synthetix.io/contracts/source/contracts/binaryoptionmarketfactory
contract BinaryOptionMarketFactory is MinimalProxyFactory, Owned {

    /* ========== STATE VARIABLES ========== */
    address public binaryOptionMarketManager;
    address public binaryOptionMarketMastercopy;

    /* ========== CONSTRUCTOR ========== */

    constructor(address _owner) public MinimalProxyFactory() Owned(_owner) {
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function createMarket(
        address creator,
        IAddressResolver _resolver,
        uint[2] calldata creatorLimits,
        bytes32 oracleKey,
        uint strikePrice,
        bool refundsEnabled,
        uint[3] calldata times, // [biddingEnd, maturity, expiry]
        uint[2] calldata bids, // [longBid, shortBid]
        uint[3] calldata fees // [poolFee, creatorFee, refundFee]
    ) external returns (BinaryOptionMarket) {
        require(binaryOptionMarketManager == msg.sender, "Only permitted by the manager.");

        BinaryOptionMarket bom =
        BinaryOptionMarket(
            _cloneAsMinimalProxy(binaryOptionMarketMastercopy, "Could not create a Binary Option Market")
        );
        bom.initialize(binaryOptionMarketManager, _resolver, creator, creatorLimits, oracleKey, strikePrice, refundsEnabled, times, bids, fees);
        return bom;
    }


    /* ========== SETTERS ========== */
    function setBinaryOptionMarketManager(address _binaryOptionMarketManager) public onlyOwner {
        binaryOptionMarketManager = _binaryOptionMarketManager;
    }

    function setBinaryOptionMarketMastercopy(address _binaryOptionMarketMastercopy) public onlyOwner {
        binaryOptionMarketMastercopy = _binaryOptionMarketMastercopy;
    }

}

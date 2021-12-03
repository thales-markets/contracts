pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

// Inheritance
import "synthetix-2.50.4-ovm/contracts/Owned.sol";

// Internal references
import "./BinaryOption.sol";
import "./BinaryOptionMarket.sol";
import "./BinaryOptionMarketFactory.sol";
import "../interfaces/IPriceFeed.sol";
import "../interfaces/IBinaryOptionMarket.sol";
import "synthetix-2.50.4-ovm/contracts/interfaces/IERC20.sol";

contract BinaryOptionMarketFactory is Owned {
    /* ========== STATE VARIABLES ========== */
    address public binaryOptionMarketManager;

    struct BinaryOptionCreationMarketParameters {
        address creator;
        IERC20 _sUSD;
        IPriceFeed _priceFeed;
        bytes32 oracleKey;
        uint strikePrice;
        uint[2] times; // [maturity, expiry]
        uint initialMint;
        bool customMarket;
        address customOracle;
    }

    /* ========== CONSTRUCTOR ========== */

    constructor(address _owner) public Owned(_owner) {}

    /* ========== MUTATIVE FUNCTIONS ========== */

    function createMarket(BinaryOptionCreationMarketParameters calldata _parameters) external returns (BinaryOptionMarket) {
        require(binaryOptionMarketManager == msg.sender, "Only permitted by the manager.");

        BinaryOptionMarket bom = new BinaryOptionMarket();
        BinaryOption long = new BinaryOption();
        BinaryOption short = new BinaryOption();
        bom.initialize(
            BinaryOptionMarket.BinaryOptionMarketParameters(
                binaryOptionMarketManager,
                _parameters._sUSD,
                _parameters._priceFeed,
                _parameters.creator,
                _parameters.oracleKey,
                _parameters.strikePrice,
                _parameters.times,
                _parameters.initialMint,
                _parameters.customMarket,
                _parameters.customOracle,
                address(long),
                address(short)
            )
        );
        return bom;
    }

    /* ========== SETTERS ========== */
    function setBinaryOptionMarketManager(address _binaryOptionMarketManager) external onlyOwner {
        binaryOptionMarketManager = _binaryOptionMarketManager;
        emit BinaryOptionMarketManagerChanged(_binaryOptionMarketManager);
    }

    event BinaryOptionMarketManagerChanged(address _binaryOptionMarketManager);
}

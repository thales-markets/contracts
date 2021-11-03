pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

// Inheritance
import "synthetix-2.50.4-ovm/contracts/MinimalProxyFactory.sol";
import "synthetix-2.50.4-ovm/contracts/Owned.sol";

// Internal references
import "./BinaryOptionMarket.sol";
import "../interfaces/IPriceFeed.sol";
import "../interfaces/IBinaryOptionMarket.sol";
import "synthetix-2.50.4-ovm/contracts/interfaces/IERC20.sol";

contract BinaryOptionMarketFactory is MinimalProxyFactory, Owned {
    /* ========== STATE VARIABLES ========== */
    address public binaryOptionMarketManager;
    address public binaryOptionMarketMastercopy;
    address public binaryOptionMastercopy;
    address public zeroExAddress;

    /* ========== CONSTRUCTOR ========== */

    constructor(address _owner) public MinimalProxyFactory() Owned(_owner) {}

    /* ========== MUTATIVE FUNCTIONS ========== */

    function createMarket(
        address creator,
        IERC20 _sUSD,
        IPriceFeed _priceFeed,
        bytes32 oracleKey,
        uint strikePrice,
        uint[2] calldata times, // [maturity, expiry]
        uint initialMint,
        bool customMarket,
        address customOracle
    ) external returns (BinaryOptionMarket) {
        require(binaryOptionMarketManager == msg.sender, "Only permitted by the manager.");

        BinaryOptionMarket bom = BinaryOptionMarket(
            _cloneAsMinimalProxy(binaryOptionMarketMastercopy, "Could not create a Binary Option Market")
        );
        bom.setZeroExAddressAtInit(zeroExAddress);
        bom.initialize(
            BinaryOptionMarket.BinaryOptionMarketParameters(
                binaryOptionMarketManager,
                binaryOptionMastercopy,
                _sUSD,
                _priceFeed,
                creator,
                oracleKey,
                strikePrice,
                times,
                initialMint,
                customMarket,
                customOracle
            )
        );
        return bom;
    }

    /* ========== SETTERS ========== */
    function setBinaryOptionMarketManager(address _binaryOptionMarketManager) external onlyOwner {
        binaryOptionMarketManager = _binaryOptionMarketManager;
        emit BinaryOptionMarketManagerChanged(_binaryOptionMarketManager);
    }

    function setBinaryOptionMarketMastercopy(address _binaryOptionMarketMastercopy) external onlyOwner {
        binaryOptionMarketMastercopy = _binaryOptionMarketMastercopy;
        emit BinaryOptionMarketMastercopyChanged(_binaryOptionMarketMastercopy);
    }

    function setBinaryOptionMastercopy(address _binaryOptionMastercopy) external onlyOwner {
        binaryOptionMastercopy = _binaryOptionMastercopy;
        emit BinaryOptionMastercopyChanged(_binaryOptionMastercopy);
    }
    function setZeroExAddress(address _zeroExAddress) external {
        require(msg.sender == binaryOptionMarketManager, "Only BinaryOptionsManager can set the 0x address");
        zeroExAddress = _zeroExAddress;
        emit ZeroExAddressChanged(_zeroExAddress);
    }

    event BinaryOptionMarketManagerChanged(address _binaryOptionMarketManager);
    event BinaryOptionMarketMastercopyChanged(address _binaryOptionMarketMastercopy);
    event BinaryOptionMastercopyChanged(address _binaryOptionMastercopy);
    event ZeroExAddressChanged(address _zeroExAddress);
}

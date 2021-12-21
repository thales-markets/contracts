pragma solidity 0.5.16;
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
import "synthetix-2.50.4-ovm/contracts/MinimalProxyFactory.sol";

contract BinaryOptionMarketFactory is Owned, MinimalProxyFactory {
    /* ========== STATE VARIABLES ========== */
    address public binaryOptionMarketManager;

    address public binaryOptionMarketMastercopy;
    address public binaryOptionMastercopy;

    address public limitOrderProvider;
    address public thalesAMM;

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

    constructor(address _owner) public Owned(_owner) MinimalProxyFactory() {}

    /* ========== MUTATIVE FUNCTIONS ========== */

    function createMarket(BinaryOptionCreationMarketParameters calldata _parameters) external returns (BinaryOptionMarket) {
        require(binaryOptionMarketManager == msg.sender, "Only permitted by the manager.");

        BinaryOptionMarket bom =
            BinaryOptionMarket(
                _cloneAsMinimalProxy(binaryOptionMarketMastercopy, "Could not create a Binary Option Market")
            );
        BinaryOption long = BinaryOption(_cloneAsMinimalProxy(binaryOptionMastercopy, "Could not create a Binary Option"));
        BinaryOption short = BinaryOption(_cloneAsMinimalProxy(binaryOptionMastercopy, "Could not create a Binary Option"));
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
                address(short),
                limitOrderProvider,
                thalesAMM
            )
        );
        emit MarketCreated(
            address(bom),
            _parameters.oracleKey,
            _parameters.strikePrice,
            _parameters.times[0],
            _parameters.times[1],
            _parameters.initialMint,
            _parameters.customMarket,
            _parameters.customOracle
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

    function setLimitOrderProvider(address _limitOrderProvider) external onlyOwner {
        limitOrderProvider = _limitOrderProvider;
        emit SetLimitOrderProvider(_limitOrderProvider);
    }

    function setThalesAMM(address _thalesAMM) external onlyOwner {
        thalesAMM = _thalesAMM;
        emit SetThalesAMM(_thalesAMM);
    }

    event BinaryOptionMarketManagerChanged(address _binaryOptionMarketManager);
    event BinaryOptionMarketMastercopyChanged(address _binaryOptionMarketMastercopy);
    event BinaryOptionMastercopyChanged(address _binaryOptionMastercopy);
    event SetThalesAMM(address _thalesAMM);
    event SetLimitOrderProvider(address _limitOrderProvider);
    event MarketCreated(
        address market,
        bytes32 indexed oracleKey,
        uint strikePrice,
        uint maturityDate,
        uint expiryDate,
        uint initialMint,
        bool customMarket,
        address customOracle
    );
}

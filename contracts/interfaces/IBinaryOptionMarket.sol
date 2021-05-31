pragma solidity >=0.4.24;

import "../interfaces/IBinaryOptionMarketManager.sol";
import "../interfaces/IBinaryOption.sol";

interface IBinaryOptionMarket {
    /* ========== TYPES ========== */

    enum Phase {Trading, Maturity, Expiry}
    enum Side {Long, Short}

    /* ========== VIEWS / VARIABLES ========== */

    function options() external view returns (IBinaryOption long, IBinaryOption short);

    function times()
        external
        view
        returns (
            uint maturity,
            uint destructino
        );

    function oracleDetails()
        external
        view
        returns (
            bytes32 key,
            uint strikePrice,
            uint finalPrice
        );

    function fees()
        external
        view
        returns (
            uint poolFee,
            uint creatorFee
        );

    function deposited() external view returns (uint);

    function creator() external view returns (address);

    function resolved() external view returns (bool);

    function phase() external view returns (Phase);

    function oraclePriceAndTimestamp() external view returns (uint price, uint updatedAt);

    function canResolve() external view returns (bool);

    function result() external view returns (Side);

    function balancesOf(address account) external view returns (uint long, uint short);

    function totalSupplies() external view returns (uint long, uint short);

    /* ========== MUTATIVE FUNCTIONS ========== */

    function mint(uint value) external;

    function exerciseOptions() external returns (uint);
}

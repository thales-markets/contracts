pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

// Inheritance
import "./BinaryOption.sol";
import "./BinaryOptionMarket.sol";
import "./BinaryOptionMarketManager.sol";

contract BinaryOptionMarketData {
    struct OptionValues {
        uint long;
        uint short;
    }

    struct Deposits {
        uint deposited;
    }

    struct Resolution {
        bool resolved;
        bool canResolve;
    }

    struct OraclePriceAndTimestamp {
        uint price;
        uint updatedAt;
    }

    // used for things that don't change over the lifetime of the contract
    struct MarketParameters {
        address creator;
        BinaryOptionMarket.Options options;
        BinaryOptionMarket.Times times;
        BinaryOptionMarket.OracleDetails oracleDetails;
        BinaryOptionMarketManager.Fees fees;
    }

    struct MarketData {
        OraclePriceAndTimestamp oraclePriceAndTimestamp;
        Deposits deposits;
        Resolution resolution;
        BinaryOptionMarket.Phase phase;
        BinaryOptionMarket.Side result;
        OptionValues totalSupplies;
    }

    struct AccountData {
        OptionValues balances;
    }

    function getMarketParameters(BinaryOptionMarket market) external view returns (MarketParameters memory) {
        (BinaryOption long, BinaryOption short) = market.options();
        (uint maturityDate, uint expiryDate) = market.times();
        (bytes32 key, uint strikePrice, uint finalPrice) = market.oracleDetails();
        (uint poolFee, uint creatorFee) = market.fees();

        MarketParameters memory data =
            MarketParameters(
                market.creator(),
                BinaryOptionMarket.Options(long, short),
                BinaryOptionMarket.Times(maturityDate, expiryDate),
                BinaryOptionMarket.OracleDetails(key, strikePrice, finalPrice),
                BinaryOptionMarketManager.Fees(poolFee, creatorFee)
            );

        return data;
    }

    function getMarketData(BinaryOptionMarket market) external view returns (MarketData memory) {
        (uint price, uint updatedAt) = market.oraclePriceAndTimestamp();
        (uint longSupply, uint shortSupply) = market.totalSupplies();

        return
            MarketData(
                OraclePriceAndTimestamp(price, updatedAt),
                Deposits(market.deposited()),
                Resolution(market.resolved(), market.canResolve()),
                market.phase(),
                market.result(),
                OptionValues(longSupply, shortSupply)
            );
    }

    function getAccountMarketData(BinaryOptionMarket market, address account) external view returns (AccountData memory) {
        (uint longBalance, uint shortBalance) = market.balancesOf(account);

        return AccountData(OptionValues(longBalance, shortBalance));
    }
}

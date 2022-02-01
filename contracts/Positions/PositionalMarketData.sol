pragma solidity >=0.5.16 <0.8.4;
pragma experimental ABIEncoderV2;

// Inheritance
import "./Position.sol";
import "./PositionalMarket.sol";
import "./PositionalMarketManager.sol";

contract PositionalMarketData {
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
        PositionalMarket.Options options;
        PositionalMarket.Times times;
        PositionalMarket.OracleDetails oracleDetails;
        PositionalMarketManager.Fees fees;
    }

    struct MarketData {
        OraclePriceAndTimestamp oraclePriceAndTimestamp;
        Deposits deposits;
        Resolution resolution;
        PositionalMarket.Phase phase;
        PositionalMarket.Side result;
        OptionValues totalSupplies;
    }

    struct AccountData {
        OptionValues balances;
    }

    function getMarketParameters(PositionalMarket market) external view returns (MarketParameters memory) {
        (Position long, Position short) = market.options();
        (uint maturityDate, uint expiryDate) = market.times();
        (bytes32 key, uint strikePrice, uint finalPrice, bool customMarket, address iOracleInstanceAddress) = market
            .oracleDetails();
        (uint poolFee, uint creatorFee) = market.fees();

        MarketParameters memory data = MarketParameters(
            market.creator(),
            PositionalMarket.Options(long, short),
            PositionalMarket.Times(maturityDate, expiryDate),
            PositionalMarket.OracleDetails(key, strikePrice, finalPrice, customMarket, iOracleInstanceAddress),
            PositionalMarketManager.Fees(poolFee, creatorFee)
        );

        return data;
    }

    function getMarketData(PositionalMarket market) external view returns (MarketData memory) {
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

    function getAccountMarketData(PositionalMarket market, address account) external view returns (AccountData memory) {
        (uint longBalance, uint shortBalance) = market.balancesOf(account);

        return AccountData(OptionValues(longBalance, shortBalance));
    }
}

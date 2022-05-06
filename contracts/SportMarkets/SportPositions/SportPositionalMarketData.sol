// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "./SportPosition.sol";
import "./SportPositionalMarket.sol";
import "./SportPositionalMarketManager.sol";

contract SportPositionalMarketData {
    struct OptionValues {
        uint up;
        uint down;
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
        SportPositionalMarket.Options options;
        SportPositionalMarket.Times times;
        SportPositionalMarket.OracleDetails oracleDetails;
        SportPositionalMarketManager.Fees fees;
    }

    struct MarketData {
        OraclePriceAndTimestamp oraclePriceAndTimestamp;
        Deposits deposits;
        Resolution resolution;
        SportPositionalMarket.Phase phase;
        SportPositionalMarket.Side result;
        OptionValues totalSupplies;
    }

    struct AccountData {
        OptionValues balances;
    }

    function getMarketParameters(SportPositionalMarket market) external view returns (MarketParameters memory) {
        (SportPosition up, SportPosition down) = market.options();
        (uint maturityDate, uint expiryDate) = market.times();
        (bytes32 key, uint strikePrice, uint finalPrice, bool customMarket, address iOracleInstanceAddress) = market
            .oracleDetails();
        (uint poolFee, uint creatorFee) = market.fees();

        MarketParameters memory data = MarketParameters(
            market.creator(),
            SportPositionalMarket.Options(up, down),
            SportPositionalMarket.Times(maturityDate, expiryDate),
            SportPositionalMarket.OracleDetails(key, strikePrice, finalPrice, customMarket, iOracleInstanceAddress),
            SportPositionalMarketManager.Fees(poolFee, creatorFee)
        );

        return data;
    }

    function getMarketData(SportPositionalMarket market) external view returns (MarketData memory) {
        (uint price, uint updatedAt) = market.oraclePriceAndTimestamp();
        (uint upSupply, uint downSupply) = market.totalSupplies();

        return
            MarketData(
                OraclePriceAndTimestamp(price, updatedAt),
                Deposits(market.deposited()),
                Resolution(market.resolved(), market.canResolve()),
                market.phase(),
                market.result(),
                OptionValues(upSupply, downSupply)
            );
    }

    function getAccountMarketData(SportPositionalMarket market, address account) external view returns (AccountData memory) {
        (uint upBalance, uint downBalance) = market.balancesOf(account);

        return AccountData(OptionValues(upBalance, downBalance));
    }
}

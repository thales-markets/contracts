// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// Inheritance
import "./Position.sol";
import "./PositionalMarket.sol";
import "./PositionalMarketManager.sol";
import "../interfaces/IThalesAMM.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract PositionalMarketData is Initializable, ProxyOwned, ProxyPausable {
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

    struct ActiveMarketsPriceImpact {
        address market;
        int[] priceImpact;
    }

    struct ActiveMarketsLiquidity {
        address market;
        uint[] liquidity;
    }

    struct ActiveMarketsPrices {
        address market;
        uint[] prices;
    }

    uint private constant ONE = 1e18;

    address public manager;
    address public thalesAMM;

    function initialize(address _owner) external initializer {
        setOwner(_owner);
    }

    /// @notice getMarketParameters returns market details
    /// @param market PositionalMarket
    /// @return MarketParameters
    function getMarketParameters(PositionalMarket market) external view returns (MarketParameters memory) {
        (Position up, Position down) = market.options();
        (uint maturityDate, uint expiryDate) = market.times();
        (bytes32 key, uint strikePrice, uint finalPrice, bool customMarket, address iOracleInstanceAddress) = market
            .oracleDetails();
        (uint poolFee, uint creatorFee) = market.fees();

        MarketParameters memory data = MarketParameters(
            market.creator(),
            PositionalMarket.Options(up, down),
            PositionalMarket.Times(maturityDate, expiryDate),
            PositionalMarket.OracleDetails(key, strikePrice, finalPrice, customMarket, iOracleInstanceAddress),
            PositionalMarketManager.Fees(poolFee, creatorFee)
        );

        return data;
    }

    /// @notice getMarketData returns market details
    /// @param market PositionalMarket
    /// @return MarketData
    function getMarketData(PositionalMarket market) external view returns (MarketData memory) {
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

    /// @notice getAccountMarketData returns account balances
    /// @param market PositionalMarket
    /// @param account address of an account
    /// @return AccountData
    function getAccountMarketData(PositionalMarket market, address account) external view returns (AccountData memory) {
        (uint upBalance, uint downBalance) = market.balancesOf(account);

        return AccountData(OptionValues(upBalance, downBalance));
    }

    /// @notice getPriceImpactForAllActiveMarkets returns price impact for all active markets
    /// @return ActiveMarketsPriceImpact
    function getPriceImpactForAllActiveMarkets() external view returns (ActiveMarketsPriceImpact[] memory) {
        address[] memory activeMarkets = PositionalMarketManager(manager).activeMarkets(
            0,
            PositionalMarketManager(manager).numActiveMarkets()
        );
        ActiveMarketsPriceImpact[] memory marketPriceImpact = new ActiveMarketsPriceImpact[](activeMarkets.length);
        for (uint i = 0; i < activeMarkets.length; i++) {
            marketPriceImpact[i].market = activeMarkets[i];
            marketPriceImpact[i].priceImpact = new int[](2);

            for (uint j = 0; j < marketPriceImpact[i].priceImpact.length; j++) {
                if (IThalesAMM(thalesAMM).isMarketInAMMTrading(activeMarkets[i])) {
                    IThalesAMM.Position position = j == 0 ? IThalesAMM.Position.Up : IThalesAMM.Position.Down;
                    marketPriceImpact[i].priceImpact[j] = IThalesAMM(thalesAMM).buyPriceImpact(
                        activeMarkets[i],
                        position,
                        ONE
                    );
                }
            }
        }
        return marketPriceImpact;
    }

    /// @notice getLiquidityForAllActiveMarkets returns liquidity for all active markets
    /// @return ActiveMarketsLiquidity
    function getLiquidityForAllActiveMarkets() external view returns (ActiveMarketsLiquidity[] memory) {
        address[] memory activeMarkets = PositionalMarketManager(manager).activeMarkets(
            0,
            PositionalMarketManager(manager).numActiveMarkets()
        );
        ActiveMarketsLiquidity[] memory marketLiquidity = new ActiveMarketsLiquidity[](activeMarkets.length);
        for (uint i = 0; i < activeMarkets.length; i++) {
            marketLiquidity[i].market = activeMarkets[i];
            marketLiquidity[i].liquidity = new uint[](2);

            for (uint j = 0; j < marketLiquidity[i].liquidity.length; j++) {
                if (IThalesAMM(thalesAMM).isMarketInAMMTrading(activeMarkets[i])) {
                    IThalesAMM.Position position = j == 0 ? IThalesAMM.Position.Up : IThalesAMM.Position.Down;
                    marketLiquidity[i].liquidity[j] = IThalesAMM(thalesAMM).availableToBuyFromAMM(
                        activeMarkets[i],
                        position
                    );
                }
            }
        }
        return marketLiquidity;
    }

    /// @notice getPricesForAllActiveMarkets returns prices for all active markets
    /// @return ActiveMarketsPrices
    function getPricesForAllActiveMarkets() external view returns (ActiveMarketsPrices[] memory) {
        address[] memory activeMarkets = PositionalMarketManager(manager).activeMarkets(
            0,
            PositionalMarketManager(manager).numActiveMarkets()
        );
        ActiveMarketsPrices[] memory marketPrices = new ActiveMarketsPrices[](activeMarkets.length);
        for (uint i = 0; i < activeMarkets.length; i++) {
            marketPrices[i].market = activeMarkets[i];
            marketPrices[i].prices = new uint[](2);

            for (uint j = 0; j < marketPrices[i].prices.length; j++) {
                if (IThalesAMM(thalesAMM).isMarketInAMMTrading(activeMarkets[i])) {
                    IThalesAMM.Position position = j == 0 ? IThalesAMM.Position.Up : IThalesAMM.Position.Down;
                    marketPrices[i].prices[j] = IThalesAMM(thalesAMM).buyFromAmmQuote(activeMarkets[i], position, ONE);
                }
            }
        }
        return marketPrices;
    }

    function setPositionalMarketManager(address _manager) external onlyOwner {
        manager = _manager;
        emit PositionalMarketManagerChanged(_manager);
    }

    function setThalesAMM(address _thalesAMM) external onlyOwner {
        thalesAMM = _thalesAMM;
        emit SetThalesAMM(_thalesAMM);
    }

    event PositionalMarketManagerChanged(address _manager);
    event SetThalesAMM(address _thalesAMM);
}

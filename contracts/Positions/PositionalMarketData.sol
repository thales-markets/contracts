// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// Inheritance
import "./Position.sol";
import "./PositionalMarket.sol";
import "./PositionalMarketManager.sol";
import "../RangedMarkets/RangedMarket.sol";
import "../RangedMarkets/RangedMarketsAMM.sol";
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
        int upPriceImpact;
        int downPriceImpact;
    }

    struct ActiveMarketsLiquidity {
        address market;
        uint upLiquidity;
        uint downLiquidity;
    }

    struct ActiveMarketsPrices {
        address market;
        uint upPrice;
        uint downPrice;
    }

    struct ActiveMarketsInfoPerPosition {
        address market;
        uint price;
        uint liquidity;
        int priceImpact;
        uint strikePrice;
    }

    struct RangedMarketsInfoPerPosition {
        address market;
        uint price;
        uint liquidity;
        int priceImpact;
        uint leftPrice;
        uint rightPrice;
    }
    struct AmmMarketData {
        uint upBuyLiquidity;
        uint downBuyLiquidity;
        uint upSellLiquidity;
        uint downSellLiquidity;
        uint upBuyPrice;
        uint downBuyPrice;
        uint upSellPrice;
        uint downSellPrice;
        int upBuyPriceImpact;
        int downBuyPriceImpact;
        int upSellPriceImpact;
        int downSellPriceImpact;
        uint iv;
        bool isMarketInAMMTrading;
    }

    struct RangedAmmMarketData {
        uint inBuyLiquidity;
        uint outBuyLiquidity;
        uint inSellLiquidity;
        uint outSellLiquidity;
        uint inBuyPrice;
        uint outBuyPrice;
        uint inSellPrice;
        uint outSellPrice;
        int inPriceImpact;
        int outPriceImpact;
    }

    uint private constant ONE = 1e18;

    address public manager;
    address public thalesAMM;
    address public rangedMarketsAMM;

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
    /// @param start startIndex
    /// @param end endIndex
    /// @return ActiveMarketsPriceImpact
    function getBatchPriceImpactForAllActiveMarkets(uint start, uint end)
        external
        view
        returns (ActiveMarketsPriceImpact[] memory)
    {
        address[] memory activeMarkets = PositionalMarketManager(manager).activeMarkets(
            0,
            PositionalMarketManager(manager).numActiveMarkets()
        );
        uint endIndex = end > PositionalMarketManager(manager).numActiveMarkets()
            ? PositionalMarketManager(manager).numActiveMarkets()
            : end;
        ActiveMarketsPriceImpact[] memory marketPriceImpact = new ActiveMarketsPriceImpact[](endIndex - start);
        for (uint i = start; i < endIndex; i++) {
            marketPriceImpact[i - start].market = activeMarkets[i];

            if (IThalesAMM(thalesAMM).isMarketInAMMTrading(activeMarkets[i])) {
                marketPriceImpact[i - start].upPriceImpact = IThalesAMM(thalesAMM).buyPriceImpact(
                    activeMarkets[i],
                    IThalesAMM.Position.Up,
                    ONE
                );
                marketPriceImpact[i - start].downPriceImpact = IThalesAMM(thalesAMM).buyPriceImpact(
                    activeMarkets[i],
                    IThalesAMM.Position.Down,
                    ONE
                );
            }
        }
        return marketPriceImpact;
    }

    /// @notice getBatchBasePricesForAllActiveMarkets returns base prices for all active markets
    /// @param start startIndex
    /// @param end endIndex
    /// @return ActiveMarketsPrices
    function getBatchBasePricesForAllActiveMarkets(uint start, uint end)
        external
        view
        returns (ActiveMarketsPrices[] memory)
    {
        address[] memory activeMarkets = PositionalMarketManager(manager).activeMarkets(
            0,
            PositionalMarketManager(manager).numActiveMarkets()
        );
        uint endIndex = end > PositionalMarketManager(manager).numActiveMarkets()
            ? PositionalMarketManager(manager).numActiveMarkets()
            : end;
        ActiveMarketsPrices[] memory marketPrices = new ActiveMarketsPrices[](endIndex - start);
        for (uint i = start; i < endIndex; i++) {
            marketPrices[i - start].market = activeMarkets[i];

            if (IThalesAMM(thalesAMM).isMarketInAMMTrading(activeMarkets[i])) {
                marketPrices[i - start].upPrice = IThalesAMM(thalesAMM).price(activeMarkets[i], IThalesAMM.Position.Up);
                marketPrices[i - start].downPrice = IThalesAMM(thalesAMM).price(activeMarkets[i], IThalesAMM.Position.Down);
            }
        }
        return marketPrices;
    }

    /// @notice getAvailableAssets all assets currently available
    /// @return all available assets
    function getAvailableAssets() external view returns (bytes32[] memory) {
        address[] memory activeMarkets = PositionalMarketManager(manager).activeMarkets(
            0,
            PositionalMarketManager(manager).numActiveMarkets()
        );
        bytes32[] memory allActiveAssets = new bytes32[](activeMarkets.length);
        for (uint i = 0; i < activeMarkets.length; i++) {
            IPositionalMarket market = IPositionalMarket(activeMarkets[i]);
            (bytes32 key, , ) = market.getOracleDetails();
            allActiveAssets[i] = key;
        }
        return allActiveAssets;
    }

    /// @notice getMaturityDates all strike dates currently available
    /// @param asset to get markets for
    /// @return all available dates per asset
    function getMaturityDates(bytes32 asset) external view returns (uint[] memory) {
        address[] memory activeMarkets = PositionalMarketManager(manager).activeMarkets(
            0,
            PositionalMarketManager(manager).numActiveMarkets()
        );
        uint[] memory activeDates = new uint[](activeMarkets.length);
        for (uint i = 0; i < activeMarkets.length; i++) {
            IPositionalMarket market = IPositionalMarket(activeMarkets[i]);
            (bytes32 key, , ) = market.getOracleDetails();
            if (key == asset) {
                (uint strikeDate, ) = market.times();
                activeDates[i] = strikeDate;
            }
        }
        return activeDates;
    }

    /// @notice get a list of all markets per asset and strike date
    /// @param asset to get markets for
    /// @param strikeDateParam asset to get markets for
    /// @return a list of all markets per asset and strike date
    function getMarketsForAssetAndStrikeDate(bytes32 asset, uint strikeDateParam) external view returns (address[] memory) {
        address[] memory activeMarkets = PositionalMarketManager(manager).activeMarkets(
            0,
            PositionalMarketManager(manager).numActiveMarkets()
        );
        address[] memory activeMarketsToReturn = new address[](activeMarkets.length);
        for (uint i = 0; i < activeMarkets.length; i++) {
            IPositionalMarket market = IPositionalMarket(activeMarkets[i]);
            (bytes32 key, , ) = market.getOracleDetails();
            if (key == asset) {
                (uint strikeDate, ) = market.times();
                if (strikeDate == strikeDateParam) {
                    activeMarketsToReturn[i] = activeMarkets[i];
                }
            }
        }
        return activeMarketsToReturn;
    }

    /// @notice market info for a list of markets and position
    /// @param markets to get info for
    /// @param position asset to get info for
    /// @return market info for a list of markets and position
    function getActiveMarketsInfoPerPosition(address[] calldata markets, IThalesAMM.Position position)
        external
        view
        returns (ActiveMarketsInfoPerPosition[] memory)
    {
        ActiveMarketsInfoPerPosition[] memory activeMarkets = new ActiveMarketsInfoPerPosition[](markets.length);
        for (uint i = 0; i < markets.length; i++) {
            activeMarkets[i].market = markets[i];
            IPositionalMarket market = IPositionalMarket(markets[i]);
            (, uint strikePrice, ) = market.getOracleDetails();

            activeMarkets[i].strikePrice = strikePrice;

            activeMarkets[i].liquidity = IThalesAMM(thalesAMM).availableToBuyFromAMM(markets[i], position);
            activeMarkets[i].priceImpact = IThalesAMM(thalesAMM).buyPriceImpact(markets[i], position, ONE);
            activeMarkets[i].price = IThalesAMM(thalesAMM).buyFromAmmQuote(markets[i], position, ONE);
        }
        return activeMarkets;
    }

    /// @notice getMaturityDates all strike dates currently available
    /// @param markets to get info for
    /// @param position asset to get info for
    /// @return all available dates per asset
    function getRangedActiveMarketsInfoPerPosition(address[] calldata markets, RangedMarket.Position position)
        external
        view
        returns (RangedMarketsInfoPerPosition[] memory)
    {
        RangedMarketsInfoPerPosition[] memory activeMarkets = new RangedMarketsInfoPerPosition[](markets.length);
        RangedMarketsAMM rangedAMMContract = RangedMarketsAMM(rangedMarketsAMM);

        for (uint i = 0; i < markets.length; i++) {
            activeMarkets[i].market = markets[i];
            IPositionalMarket leftMarket = IPositionalMarket(RangedMarket(markets[i]).leftMarket());
            IPositionalMarket rightMarket = IPositionalMarket(RangedMarket(markets[i]).rightMarket());
            (, uint leftStrikePrice, ) = leftMarket.getOracleDetails();
            (, uint rightStrikePrice, ) = rightMarket.getOracleDetails();
            activeMarkets[i].leftPrice = leftStrikePrice;
            activeMarkets[i].rightPrice = rightStrikePrice;

            activeMarkets[i].liquidity = rangedAMMContract.availableToBuyFromAMM(RangedMarket(markets[i]), position);
            activeMarkets[i].price = rangedAMMContract.buyFromAmmQuote(RangedMarket(markets[i]), position, ONE);

            activeMarkets[i].priceImpact = rangedAMMContract.getPriceImpact(RangedMarket(markets[i]), position);
        }
        return activeMarkets;
    }

    /// @notice getAmmMarketData returns AMM market data
    /// @param market market address
    /// @return AmmMarketData
    function getAmmMarketData(address market) external view returns (AmmMarketData memory) {
        (bytes32 key, , ) = IPositionalMarket(market).getOracleDetails();

        return
            AmmMarketData(
                IThalesAMM(thalesAMM).availableToBuyFromAMM(market, IThalesAMM.Position.Up),
                IThalesAMM(thalesAMM).availableToBuyFromAMM(market, IThalesAMM.Position.Down),
                IThalesAMM(thalesAMM).availableToSellToAMM(market, IThalesAMM.Position.Up),
                IThalesAMM(thalesAMM).availableToSellToAMM(market, IThalesAMM.Position.Down),
                IThalesAMM(thalesAMM).buyFromAmmQuote(market, IThalesAMM.Position.Up, ONE),
                IThalesAMM(thalesAMM).buyFromAmmQuote(market, IThalesAMM.Position.Down, ONE),
                IThalesAMM(thalesAMM).sellToAmmQuote(market, IThalesAMM.Position.Up, ONE),
                IThalesAMM(thalesAMM).sellToAmmQuote(market, IThalesAMM.Position.Down, ONE),
                IThalesAMM(thalesAMM).buyPriceImpact(market, IThalesAMM.Position.Up, ONE),
                IThalesAMM(thalesAMM).buyPriceImpact(market, IThalesAMM.Position.Down, ONE),
                IThalesAMM(thalesAMM).sellPriceImpact(market, IThalesAMM.Position.Up, ONE),
                IThalesAMM(thalesAMM).sellPriceImpact(market, IThalesAMM.Position.Down, ONE),
                IThalesAMM(thalesAMM).impliedVolatilityPerAsset(key),
                IThalesAMM(thalesAMM).isMarketInAMMTrading(market)
            );
    }

    /// @notice RangedAmmMarketData returns Ranged AMM market data
    /// @param market ranged market
    /// @return RangedAmmMarketData
    function getRangedAmmMarketData(RangedMarket market) external view returns (RangedAmmMarketData memory) {
        return
            RangedAmmMarketData(
                RangedMarketsAMM(rangedMarketsAMM).availableToBuyFromAMM(market, RangedMarket.Position.In),
                RangedMarketsAMM(rangedMarketsAMM).availableToBuyFromAMM(market, RangedMarket.Position.Out),
                RangedMarketsAMM(rangedMarketsAMM).availableToSellToAMM(market, RangedMarket.Position.In),
                RangedMarketsAMM(rangedMarketsAMM).availableToSellToAMM(market, RangedMarket.Position.Out),
                RangedMarketsAMM(rangedMarketsAMM).buyFromAmmQuote(market, RangedMarket.Position.In, ONE),
                RangedMarketsAMM(rangedMarketsAMM).buyFromAmmQuote(market, RangedMarket.Position.Out, ONE),
                RangedMarketsAMM(rangedMarketsAMM).sellToAmmQuote(market, RangedMarket.Position.In, ONE),
                RangedMarketsAMM(rangedMarketsAMM).sellToAmmQuote(market, RangedMarket.Position.Out, ONE),
                RangedMarketsAMM(rangedMarketsAMM).getPriceImpact(market, RangedMarket.Position.In),
                RangedMarketsAMM(rangedMarketsAMM).getPriceImpact(market, RangedMarket.Position.Out)
            );
    }

    function setPositionalMarketManager(address _manager) external onlyOwner {
        manager = _manager;
        emit PositionalMarketManagerChanged(_manager);
    }

    function setThalesAMM(address _thalesAMM) external onlyOwner {
        thalesAMM = _thalesAMM;
        emit SetThalesAMM(_thalesAMM);
    }

    function setRangedMarketsAMM(address _rangedMarketsAMM) external onlyOwner {
        rangedMarketsAMM = _rangedMarketsAMM;
        emit SetRangedMarketsAMM(_rangedMarketsAMM);
    }

    event PositionalMarketManagerChanged(address _manager);
    event SetThalesAMM(address _thalesAMM);
    event SetRangedMarketsAMM(address _rangedMarketsAMM);
}

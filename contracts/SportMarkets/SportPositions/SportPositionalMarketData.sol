// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "../../interfaces/ISportsAMM.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/ISportPositionalMarketManager.sol";
import "../../interfaces/IGamesOddsObtainer.sol";

import "../../interfaces/IParlayMarketsAMM.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./SportPositionalMarket.sol";
import "./SportPositionalMarketManager.sol";
import "../Rundown/GamesOddsObtainer.sol";
import "../Rundown/TherundownConsumer.sol";
import "../Voucher/OvertimeVoucherEscrow.sol";

contract SportPositionalMarketData is Initializable, ProxyOwned, ProxyPausable {
    uint private constant TAG_NUMBER_SPREAD = 10001;
    uint private constant TAG_NUMBER_TOTAL = 10002;
    uint private constant DOUBLE_CHANCE_TAG = 10003;
    struct ActiveMarketsOdds {
        address market;
        uint[] odds;
    }

    struct ActiveMarketsPriceImpact {
        address market;
        int[] priceImpact;
    }

    struct MarketData {
        bytes32 gameId;
        string gameLabel;
        uint firstTag;
        uint secondTag;
        uint maturity;
        bool resolved;
        uint finalResult;
        bool cancelled;
        bool paused;
        uint[] odds;
        address[] childMarkets;
        address[] doubleChanceMarkets;
        uint8 homeScore;
        uint8 awayScore;
        int16 spread;
        uint24 total;
    }

    struct MarketLiquidityAndPriceImpact {
        int homePriceImpact;
        int awayPriceImpact;
        int drawPriceImpact;
        uint homeLiquidity;
        uint awayLiquidity;
        uint drawLiquidity;
    }

    struct PositionDetails {
        int priceImpact;
        uint liquidity;
        uint quote;
        uint quoteDifferentCollateral;
    }

    struct VoucherEscrowData {
        uint period;
        bool isWhitelisted;
        bool isClaimed;
        uint voucherAmount;
        bool isPeriodEnded;
        uint periodEnd;
    }
    struct CombinedOdds {
        uint[2] tags;
        uint[6] odds;
    }
    struct SameGameParlayMarket {
        address mainMarket;
        CombinedOdds[] combinedOdds;
    }

    uint private constant ONE = 1e18;

    address public manager;
    address public sportsAMM;
    address public oddsObtainer;
    address public consumer;
    address public voucherEscrow;

    function initialize(address _owner) external initializer {
        setOwner(_owner);
    }

    function getOddsForAllActiveMarkets() external view returns (ActiveMarketsOdds[] memory) {
        address[] memory activeMarkets = SportPositionalMarketManager(manager).activeMarkets(
            0,
            SportPositionalMarketManager(manager).numActiveMarkets()
        );
        ActiveMarketsOdds[] memory marketOdds = new ActiveMarketsOdds[](activeMarkets.length);
        for (uint i = 0; i < activeMarkets.length; i++) {
            marketOdds[i].market = activeMarkets[i];
            marketOdds[i].odds = ISportsAMM(sportsAMM).getMarketDefaultOdds(activeMarkets[i], false);
        }
        return marketOdds;
    }

    function getOddsForAllActiveMarketsInBatches(uint batchNumber, uint batchSize)
        external
        view
        returns (ActiveMarketsOdds[] memory)
    {
        address[] memory activeMarkets = SportPositionalMarketManager(manager).activeMarkets(
            batchNumber * batchSize,
            batchSize
        );
        ActiveMarketsOdds[] memory marketOdds = new ActiveMarketsOdds[](activeMarkets.length);
        for (uint i = 0; i < activeMarkets.length; i++) {
            marketOdds[i].market = activeMarkets[i];
            marketOdds[i].odds = ISportsAMM(sportsAMM).getMarketDefaultOdds(activeMarkets[i], false);
        }
        return marketOdds;
    }

    function getBaseOddsForAllActiveMarkets() external view returns (ActiveMarketsOdds[] memory) {
        address[] memory activeMarkets = SportPositionalMarketManager(manager).activeMarkets(
            0,
            SportPositionalMarketManager(manager).numActiveMarkets()
        );
        ActiveMarketsOdds[] memory marketOdds = new ActiveMarketsOdds[](activeMarkets.length);
        for (uint i = 0; i < activeMarkets.length; i++) {
            marketOdds[i].market = activeMarkets[i];
            marketOdds[i].odds = new uint[](SportPositionalMarket(activeMarkets[i]).optionsCount());

            for (uint j = 0; j < marketOdds[i].odds.length; j++) {
                if (ISportsAMM(sportsAMM).isMarketInAMMTrading(activeMarkets[i])) {
                    ISportsAMM.Position position;
                    if (j == 0) {
                        position = ISportsAMM.Position.Home;
                    } else if (j == 1) {
                        position = ISportsAMM.Position.Away;
                    } else {
                        position = ISportsAMM.Position.Draw;
                    }
                    marketOdds[i].odds[j] = ISportsAMM(sportsAMM).obtainOdds(activeMarkets[i], position);
                }
            }
        }
        return marketOdds;
    }

    function getPriceImpactForAllActiveMarketsInBatches(uint batchNumber, uint batchSize)
        external
        view
        returns (ActiveMarketsPriceImpact[] memory)
    {
        address[] memory activeMarkets = SportPositionalMarketManager(manager).activeMarkets(
            batchNumber * batchSize,
            batchSize
        );
        ActiveMarketsPriceImpact[] memory marketPriceImpact = new ActiveMarketsPriceImpact[](activeMarkets.length);
        for (uint i = 0; i < activeMarkets.length; i++) {
            marketPriceImpact[i].market = activeMarkets[i];
            marketPriceImpact[i].priceImpact = new int[](SportPositionalMarket(activeMarkets[i]).optionsCount());

            for (uint j = 0; j < marketPriceImpact[i].priceImpact.length; j++) {
                if (ISportsAMM(sportsAMM).isMarketInAMMTrading(activeMarkets[i])) {
                    ISportsAMM.Position position;
                    if (j == 0) {
                        position = ISportsAMM.Position.Home;
                    } else if (j == 1) {
                        position = ISportsAMM.Position.Away;
                    } else {
                        position = ISportsAMM.Position.Draw;
                    }
                    marketPriceImpact[i].priceImpact[j] = ISportsAMM(sportsAMM).buyPriceImpact(
                        activeMarkets[i],
                        position,
                        ONE
                    );
                }
            }
        }
        return marketPriceImpact;
    }

    function getPriceImpactForAllActiveMarkets() external view returns (ActiveMarketsPriceImpact[] memory) {
        address[] memory activeMarkets = SportPositionalMarketManager(manager).activeMarkets(
            0,
            SportPositionalMarketManager(manager).numActiveMarkets()
        );
        ActiveMarketsPriceImpact[] memory marketPriceImpact = new ActiveMarketsPriceImpact[](activeMarkets.length);
        for (uint i = 0; i < activeMarkets.length; i++) {
            marketPriceImpact[i].market = activeMarkets[i];
            marketPriceImpact[i].priceImpact = new int[](SportPositionalMarket(activeMarkets[i]).optionsCount());

            for (uint j = 0; j < marketPriceImpact[i].priceImpact.length; j++) {
                if (ISportsAMM(sportsAMM).isMarketInAMMTrading(activeMarkets[i])) {
                    ISportsAMM.Position position;
                    if (j == 0) {
                        position = ISportsAMM.Position.Home;
                    } else if (j == 1) {
                        position = ISportsAMM.Position.Away;
                    } else {
                        position = ISportsAMM.Position.Draw;
                    }
                    marketPriceImpact[i].priceImpact[j] = ISportsAMM(sportsAMM).buyPriceImpact(
                        activeMarkets[i],
                        position,
                        ONE
                    );
                }
            }
        }
        return marketPriceImpact;
    }

    function getCombinedOddsForBatchOfMarkets(address[] memory _marketBatch)
        external
        view
        returns (SameGameParlayMarket[] memory sgpMarkets)
    {
        sgpMarkets = new SameGameParlayMarket[](_marketBatch.length);
        for (uint i = 0; i < _marketBatch.length; i++) {
            sgpMarkets[i] = _getCombinedOddsForMarket(_marketBatch[i]);
        }
    }

    function getCombinedOddsForMarket(address _mainMarket) external view returns (SameGameParlayMarket memory sgpMarket) {
        sgpMarket = _getCombinedOddsForMarket(_mainMarket);
    }

    function _getCombinedOddsForMarket(address _mainMarket) internal view returns (SameGameParlayMarket memory sgpMarket) {
        if (ISportPositionalMarketManager(manager).isActiveMarket(_mainMarket)) {
            uint joinedPosition;
            uint sgpFee;
            sgpMarket.mainMarket = _mainMarket;
            (address totalsMarket, address spreadMarket) = IGamesOddsObtainer(
                ISportPositionalMarketManager(manager).getOddsObtainer()
            ).getActiveChildMarketsFromParent(_mainMarket);
            CombinedOdds[] memory totalCombainedOdds = new CombinedOdds[](2);
            if (totalsMarket != address(0)) {
                CombinedOdds memory newCombinedOdds;
                newCombinedOdds.tags = [
                    ISportPositionalMarket(totalsMarket).tags(0),
                    ISportPositionalMarket(totalsMarket).tags(1)
                ];
                if (
                    IParlayMarketsAMM(ISportsAMM(sportsAMM).parlayAMM()).getSgpFeePerCombination(
                        newCombinedOdds.tags[0],
                        0,
                        newCombinedOdds.tags[1],
                        3,
                        3
                    ) > 0
                ) {
                    uint numOfOdds = ISportPositionalMarket(_mainMarket).optionsCount() > 2 ? 6 : 4;
                    for (uint j = 0; j < numOfOdds; j++) {
                        address[] memory markets = new address[](2);
                        markets[0] = _mainMarket;
                        markets[1] = totalsMarket;
                        uint[] memory positions = new uint[](2);
                        positions[0] = j > 1 ? (j > 3 ? 2 : 1) : 0;
                        positions[1] = j % 2;
                        joinedPosition = 100 + (10 * positions[0] + positions[1]);
                        sgpFee = IParlayMarketsAMM(ISportsAMM(sportsAMM).parlayAMM()).getSgpFeePerCombination(
                            newCombinedOdds.tags[0],
                            0,
                            newCombinedOdds.tags[1],
                            3,
                            3
                        );

                        if (sgpFee > 0) {
                            (, , newCombinedOdds.odds[j], , , , ) = IParlayMarketsAMM(ISportsAMM(sportsAMM).parlayAMM())
                                .buyQuoteFromParlay(
                                    markets,
                                    positions,
                                    ISportPositionalMarketManager(manager).transformCollateral(ONE)
                                );
                        }
                    }
                    newCombinedOdds.tags[0] = 0;
                    totalCombainedOdds[0] = newCombinedOdds;
                }
            }
            if (spreadMarket != address(0)) {
                CombinedOdds memory newCombinedOdds;
                newCombinedOdds.tags = [
                    ISportPositionalMarket(spreadMarket).tags(1),
                    ISportPositionalMarket(totalsMarket).tags(1)
                ];
                if (
                    IParlayMarketsAMM(ISportsAMM(sportsAMM).parlayAMM()).getSgpFeePerCombination(
                        ISportPositionalMarket(totalsMarket).tags(0),
                        newCombinedOdds.tags[0],
                        newCombinedOdds.tags[1],
                        3,
                        3
                    ) > 0
                ) {
                    for (uint j = 0; j < 4; j++) {
                        address[] memory markets = new address[](2);
                        markets[0] = totalsMarket;
                        markets[1] = spreadMarket;
                        uint[] memory positions = new uint[](2);
                        positions[0] = j > 1 ? 1 : 0;
                        positions[1] = j % 2;
                        joinedPosition = 100 + (10 * positions[0] + positions[1]);
                        sgpFee = IParlayMarketsAMM(ISportsAMM(sportsAMM).parlayAMM()).getSgpFeePerCombination(
                            newCombinedOdds.tags[0],
                            0,
                            newCombinedOdds.tags[1],
                            3,
                            3
                        );

                        if (sgpFee > 0) {
                            (, , newCombinedOdds.odds[j], , , , ) = IParlayMarketsAMM(ISportsAMM(sportsAMM).parlayAMM())
                                .buyQuoteFromParlay(
                                    markets,
                                    positions,
                                    ISportPositionalMarketManager(manager).transformCollateral(ONE)
                                );
                        }
                    }
                    totalCombainedOdds[1] = newCombinedOdds;
                }
            }
            sgpMarket.combinedOdds = totalCombainedOdds;
        }
    }

    function getMarketData(address market) external view returns (MarketData memory) {
        SportPositionalMarket sportMarket = SportPositionalMarket(market);

        (bytes32 gameId, string memory gameLabel) = sportMarket.getGameDetails();
        uint secondTag = sportMarket.isDoubleChance() || sportMarket.isChild() ? sportMarket.tags(1) : 0;
        (uint maturity, ) = sportMarket.times();
        (, uint8 homeScore, uint8 awayScore, , ) = TherundownConsumer(consumer).gameResolved(gameId);

        return
            MarketData(
                gameId,
                gameLabel,
                sportMarket.tags(0),
                secondTag,
                maturity,
                sportMarket.resolved(),
                sportMarket.finalResult(),
                sportMarket.cancelled(),
                sportMarket.paused(),
                ISportsAMM(sportsAMM).getMarketDefaultOdds(market, false),
                GamesOddsObtainer(oddsObtainer).getAllChildMarketsFromParent(market),
                SportPositionalMarketManager(manager).getDoubleChanceMarketsByParentMarket(market),
                homeScore,
                awayScore,
                GamesOddsObtainer(oddsObtainer).childMarketSread(market),
                GamesOddsObtainer(oddsObtainer).childMarketTotal(market)
            );
    }

    function getMarketLiquidityAndPriceImpact(address market) external view returns (MarketLiquidityAndPriceImpact memory) {
        SportPositionalMarket sportMarket = SportPositionalMarket(market);
        uint optionsCount = sportMarket.optionsCount();

        MarketLiquidityAndPriceImpact memory marketLiquidityAndPriceImpact = MarketLiquidityAndPriceImpact(0, 0, 0, 0, 0, 0);

        for (uint i = 0; i < optionsCount; i++) {
            ISportsAMM.Position position;
            if (i == 0) {
                position = ISportsAMM.Position.Home;
                marketLiquidityAndPriceImpact.homePriceImpact = ISportsAMM(sportsAMM).buyPriceImpact(market, position, ONE);
                marketLiquidityAndPriceImpact.homeLiquidity = ISportsAMM(sportsAMM).availableToBuyFromAMM(market, position);
            } else if (i == 1) {
                position = ISportsAMM.Position.Away;
                marketLiquidityAndPriceImpact.awayPriceImpact = ISportsAMM(sportsAMM).buyPriceImpact(market, position, ONE);
                marketLiquidityAndPriceImpact.awayLiquidity = ISportsAMM(sportsAMM).availableToBuyFromAMM(market, position);
            } else {
                position = ISportsAMM.Position.Draw;
                marketLiquidityAndPriceImpact.drawPriceImpact = ISportsAMM(sportsAMM).buyPriceImpact(market, position, ONE);
                marketLiquidityAndPriceImpact.drawLiquidity = ISportsAMM(sportsAMM).availableToBuyFromAMM(market, position);
            }
        }

        return marketLiquidityAndPriceImpact;
    }

    function getPositionDetails(
        address market,
        ISportsAMM.Position position,
        uint amount,
        address collateral
    ) external view returns (PositionDetails memory) {
        uint quoteDifferentCollateral = 0;
        if (collateral != address(0)) {
            (uint collateralQuote, uint sUSDToPay) = ISportsAMM(sportsAMM).buyFromAmmQuoteWithDifferentCollateral(
                market,
                position,
                amount,
                collateral
            );
            quoteDifferentCollateral = collateralQuote;
        }

        return
            PositionDetails(
                ISportsAMM(sportsAMM).buyPriceImpact(market, position, amount),
                ISportsAMM(sportsAMM).availableToBuyFromAMM(market, position),
                ISportsAMM(sportsAMM).buyFromAmmQuote(market, position, amount),
                quoteDifferentCollateral
            );
    }

    function getVoucherEscrowData(address user) external view returns (VoucherEscrowData memory) {
        uint period = OvertimeVoucherEscrow(voucherEscrow).period();

        return
            VoucherEscrowData(
                period,
                OvertimeVoucherEscrow(voucherEscrow).isWhitelistedAddress(user),
                OvertimeVoucherEscrow(voucherEscrow).addressClaimedVoucherPerPeriod(period, user),
                OvertimeVoucherEscrow(voucherEscrow).voucherAmount(),
                OvertimeVoucherEscrow(voucherEscrow).claimingPeriodEnded(),
                OvertimeVoucherEscrow(voucherEscrow).periodEnd(period)
            );
    }

    function setSportPositionalMarketManager(address _manager) external onlyOwner {
        manager = _manager;
        emit SportPositionalMarketManagerChanged(_manager);
    }

    function setSportsAMM(address _sportsAMM) external onlyOwner {
        sportsAMM = _sportsAMM;
        emit SetSportsAMM(_sportsAMM);
    }

    function setOddsObtainer(address _oddsObtainer) external onlyOwner {
        oddsObtainer = _oddsObtainer;
        emit SetOddsObtainer(_oddsObtainer);
    }

    function setConsumer(address _consumer) external onlyOwner {
        consumer = _consumer;
        emit SetConsumer(_consumer);
    }

    function setVoucherEscrow(address _voucherEscrow) external onlyOwner {
        voucherEscrow = _voucherEscrow;
        emit SetVoucherEscrow(_voucherEscrow);
    }

    event SportPositionalMarketManagerChanged(address _manager);
    event SetSportsAMM(address _sportsAMM);
    event SetOddsObtainer(address _oddsObtainer);
    event SetConsumer(address _consumer);
    event SetVoucherEscrow(address _voucherEscrow);
}

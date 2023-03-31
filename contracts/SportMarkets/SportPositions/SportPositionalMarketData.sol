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
    struct CombinedOdds {
        uint[2] tags;
        uint[4] odds;
    }
    struct SameGameParlayMarket {
        address mainMarket;
        CombinedOdds[] combinedOdds;
    }

    uint private constant ONE = 1e18;

    address public manager;
    address public sportsAMM;

    function initialize(address _owner) external initializer {
        setOwner(_owner);
    }

    function getOddsForAllActiveMarkets() external view returns (ActiveMarketsOdds[] memory) {
        address[] memory activeMarkets = ISportPositionalMarketManager(manager).activeMarkets(
            0,
            ISportPositionalMarketManager(manager).numActiveMarkets()
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
        address[] memory activeMarkets = ISportPositionalMarketManager(manager).activeMarkets(
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
        address[] memory activeMarkets = ISportPositionalMarketManager(manager).activeMarkets(
            0,
            ISportPositionalMarketManager(manager).numActiveMarkets()
        );
        ActiveMarketsOdds[] memory marketOdds = new ActiveMarketsOdds[](activeMarkets.length);
        for (uint i = 0; i < activeMarkets.length; i++) {
            marketOdds[i].market = activeMarkets[i];
            marketOdds[i].odds = new uint[](ISportPositionalMarket(activeMarkets[i]).optionsCount());

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
        address[] memory activeMarkets = ISportPositionalMarketManager(manager).activeMarkets(
            batchNumber * batchSize,
            batchSize
        );
        ActiveMarketsPriceImpact[] memory marketPriceImpact = new ActiveMarketsPriceImpact[](activeMarkets.length);
        for (uint i = 0; i < activeMarkets.length; i++) {
            marketPriceImpact[i].market = activeMarkets[i];
            marketPriceImpact[i].priceImpact = new int[](ISportPositionalMarket(activeMarkets[i]).optionsCount());

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
        address[] memory activeMarkets = ISportPositionalMarketManager(manager).activeMarkets(
            0,
            ISportPositionalMarketManager(manager).numActiveMarkets()
        );
        ActiveMarketsPriceImpact[] memory marketPriceImpact = new ActiveMarketsPriceImpact[](activeMarkets.length);
        for (uint i = 0; i < activeMarkets.length; i++) {
            marketPriceImpact[i].market = activeMarkets[i];
            marketPriceImpact[i].priceImpact = new int[](ISportPositionalMarket(activeMarkets[i]).optionsCount());

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

    function getCombinedOddsForMarket(address _mainMarket) external view returns (SameGameParlayMarket memory sgpMarket) {
        if (ISportPositionalMarketManager(manager).isActiveMarket(_mainMarket)) {
            sgpMarket.mainMarket = _mainMarket;
            (
                uint numOfSpread,
                address[] memory spreadMarkets,
                uint numOfTotals,
                address[] memory totalsMarkets
            ) = IGamesOddsObtainer(ISportPositionalMarketManager(manager).getOddsObtainer())
                    .getSpreadTotalsChildMarketsFromParent(_mainMarket);
            CombinedOdds[] memory totalCombainedOdds = new CombinedOdds[](3 * numOfTotals);
            for (uint i = 0; i < numOfTotals; i++) {
                CombinedOdds memory newCombinedOdds;
                newCombinedOdds.tags = [
                    ISportPositionalMarket(totalsMarkets[i]).tags(0),
                    ISportPositionalMarket(totalsMarkets[i]).tags(1)
                ];
                for (uint j = 0; j < 4; j++) {
                    address[] memory markets = new address[](2);
                    markets[0] = _mainMarket;
                    markets[1] = totalsMarkets[i];
                    uint[] memory positions = new uint[](2);
                    positions[0] = j > 1 ? 1 : 0;
                    positions[1] = j % 2;
                    (, , newCombinedOdds.odds[j], , , , ) = IParlayMarketsAMM(ISportsAMM(sportsAMM).parlayAMM())
                        .buyQuoteFromParlay(markets, positions, ONE);
                }
                totalCombainedOdds[i] = newCombinedOdds;
            }
            sgpMarket.combinedOdds = totalCombainedOdds;
        }
    }

    function getSameGameParlayQuotes(address[] memory _mainMarkets) external returns (SameGameParlayMarket[] memory) {
        address mainMarket = _mainMarkets[0];
        (uint numOfSpread, , uint numOfTotals, ) = IGamesOddsObtainer(
            ISportPositionalMarketManager(manager).getOddsObtainer()
        ).getSpreadTotalsChildMarketsFromParent(mainMarket);
        address[] memory spreadMarkets = new address[](numOfSpread);
        address[] memory totalsMarkets = new address[](numOfTotals);
        (numOfSpread, spreadMarkets, numOfTotals, totalsMarkets) = IGamesOddsObtainer(
            ISportPositionalMarketManager(manager).getOddsObtainer()
        ).getSpreadTotalsChildMarketsFromParent(mainMarket);
        SameGameParlayMarket[] memory sgpMarkets = new SameGameParlayMarket[](
            (_mainMarkets.length * numOfTotals) + (numOfSpread * numOfTotals)
        );
        uint sgpCounter;
        for (uint i = 0; i < _mainMarkets.length; i++) {
            // todo: get odds for main*(totals+spread)
            // import parlayAMM to obtain odds
        }
        for (uint i = 0; i < _mainMarkets.length; i++) {
            // todo: get odds for (totals*spread)
            // import parlayAMM to import odds
        }
    }

    function setSportPositionalMarketManager(address _manager) external onlyOwner {
        manager = _manager;
        emit SportPositionalMarketManagerChanged(_manager);
    }

    function setSportsAMM(address _sportsAMM) external onlyOwner {
        sportsAMM = _sportsAMM;
        emit SetSportsAMM(_sportsAMM);
    }

    event SportPositionalMarketManagerChanged(address _manager);
    event SetSportsAMM(address _sportsAMM);
}

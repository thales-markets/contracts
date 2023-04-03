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
        uint[6] odds;
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

                uint numOfOdds = ISportPositionalMarket(_mainMarket).optionsCount() > 2 ? 6 : 4;
                for (uint j = 0; j < numOfOdds; j++) {
                    address[] memory markets = new address[](2);
                    markets[0] = _mainMarket;
                    markets[1] = totalsMarket;
                    uint[] memory positions = new uint[](2);
                    positions[0] = j > 1 ? j % numOfOdds < 2 ? 2 : 1 : 0;
                    positions[1] = j % 2;
                    (, , newCombinedOdds.odds[j], , , , ) = IParlayMarketsAMM(ISportsAMM(sportsAMM).parlayAMM())
                        .buyQuoteFromParlay(markets, positions, ONE);
                }
                totalCombainedOdds[0] = newCombinedOdds;
            }
            if (spreadMarket != address(0)) {
                CombinedOdds memory newCombinedOdds;
                newCombinedOdds.tags = [
                    ISportPositionalMarket(spreadMarket).tags(1),
                    ISportPositionalMarket(totalsMarket).tags(1)
                ];
                for (uint j = 0; j < 4; j++) {
                    address[] memory markets = new address[](2);
                    markets[0] = totalsMarket;
                    markets[1] = spreadMarket;
                    uint[] memory positions = new uint[](2);
                    positions[0] = j > 1 ? 1 : 0;
                    positions[1] = j % 2;
                    (, , newCombinedOdds.odds[j], , , , ) = IParlayMarketsAMM(ISportsAMM(sportsAMM).parlayAMM())
                        .buyQuoteFromParlay(markets, positions, ONE);
                }
                totalCombainedOdds[1] = newCombinedOdds;
            }
            sgpMarket.combinedOdds = totalCombainedOdds;
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

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "../../interfaces/ISportsAMM.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/ISportPositionalMarketManager.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract SportPositionalMarketData is Initializable, ProxyOwned, ProxyPausable {
    struct ActiveMarketsOdds {
        address market;
        uint[] odds;
    }

    struct ActiveMarketsPriceImpact {
        address market;
        int[] priceImpact;
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

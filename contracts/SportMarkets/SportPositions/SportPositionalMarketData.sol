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
        bytes32 market;
        uint[] odds;
    }

    address public manager;
    address public sportsAMM;

    function initialize(address _owner) external initializer {
        setOwner(_owner);
    }

    function getOddsForAllActiveMarkets() external view returns (ActiveMarketsOdds[] memory) {
        address[] memory activeMarkets =
            ISportPositionalMarketManager(manager).activeMarkets(
                0,
                ISportPositionalMarketManager(manager).numActiveMarkets()
            );
        ActiveMarketsOdds[] memory marketOdds = new ActiveMarketsOdds[](activeMarkets.length);
        for (uint i = 0; i < activeMarkets.length; i++) {
            marketOdds[i].market = ISportPositionalMarket(activeMarkets[i]).getGameId();
            marketOdds[i].odds = ISportsAMM(sportsAMM).getMarketDefaultOdds(activeMarkets[i], false);
        }
        return marketOdds;
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

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

// interfaces
import "../interfaces/IPriceFeed.sol";
import "../interfaces/IThalesAMM.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

contract RangedMarketsAMM is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    IThalesAMM public thalesAmm;

    enum ThalesAmmPosition {Up, Down}
    enum Position {In, Out}

    function initialize(address _owner, IThalesAMM _thalesAmm) public initializer {
        setOwner(_owner);
        initNonReentrant();
        thalesAmm = _thalesAmm;
    }

    function availableToBuyFromAMM(
        address leftMarket,
        address rightMarket,
        Position position
    ) public view returns (uint) {
        // do all checks that markets are compatible

        if (position == Position.Out) {
            uint availableLeft = thalesAmm.availableToBuyFromAMM(leftMarket, ThalesAmmPosition.Down);
            uint availableRight = thalesAmm.availableToBuyFromAMM(rightMarket, ThalesAmmPosition.Up);
            return availableLeft < availableRight ? availableLeft : availableRight;
        }
        else{
            uint availableLeft = thalesAmm.availableToBuyFromAMM(leftMarket, ThalesAmmPosition.Up);
            uint availableRight = thalesAmm.availableToBuyFromAMM(rightMarket, ThalesAmmPosition.Down);
            uint min = availableLeft < availableRight ? availableLeft : availableRight;
            return min*2;

        }
        return 0;
    }

    function availableToSellToAMM(
        address leftMarket,
        address rightMarket,
        Position position
    ) public view returns (uint) {
        // do all checks that markets are compatible

        if (position == Position.Out) {
            uint availableLeft = thalesAmm.availableToSellToAMM(leftMarket, ThalesAmmPosition.Down);
            uint availableRight = thalesAmm.availableToSellToAMM(rightMarket, ThalesAmmPosition.Up);
            return availableLeft < availableRight ? availableLeft : availableRight;
        }
        else{
            uint availableLeft = thalesAmm.availableToBuyFromAMM(leftMarket, ThalesAmmPosition.Up);
            uint availableRight = thalesAmm.availableToBuyFromAMM(rightMarket, ThalesAmmPosition.Down);
            uint min = availableLeft < availableRight ? availableLeft : availableRight;
            return min*2;

        }
        return 0;
    }


    //buyInOutPosition

    //sellInOutPosition

    //availableToBuyInOutPositions

    //availableToSellInOutPositions

    //buyQoute
    //sellQoute
}

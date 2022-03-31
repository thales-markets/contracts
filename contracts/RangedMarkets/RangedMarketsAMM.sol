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
import "@openzeppelin/contracts-4.4.1/proxy/Clones.sol";

// interfaces
import "../interfaces/IPriceFeed.sol";
import "../interfaces/IThalesAMM.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "../utils/libraries/AddressSetLib.sol";

import "./InPosition.sol";
import "./OutPosition.sol";
import "./RangedMarket.sol";
import "../interfaces/IPositionalMarket.sol";

contract RangedMarketsAMM is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;

    IThalesAMM public thalesAmm;

    uint public rangedAmmFee;

    mapping(address => mapping(address => address)) public createdRangedMarkets;
    AddressSetLib.AddressSet internal _knownMarkets;

    address public rangedMarketMastercopy;
    address public rangedPositionINMastercopy;
    address public rangedPositionOUTMastercopy;

    IERC20Upgradeable public sUSD;

    function initialize(
        address _owner,
        IThalesAMM _thalesAmm,
        uint _rangedAmmFee,
        IERC20Upgradeable _sUSD
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        thalesAmm = _thalesAmm;
        rangedAmmFee = _rangedAmmFee;
        sUSD = _sUSD;
    }

    function availableToBuyFromAMM(
        address leftMarket,
        address rightMarket,
        RangedMarket.Position position
    ) public view returns (uint) {
        // do all checks that markets are compatible

        if (position == RangedMarket.Position.Out) {
            uint availableLeft = thalesAmm.availableToBuyFromAMM(leftMarket, IThalesAMM.Position.Down);
            uint availableRight = thalesAmm.availableToBuyFromAMM(rightMarket, IThalesAMM.Position.Up);
            return availableLeft < availableRight ? availableLeft : availableRight;
        } else {
            uint availableLeft = thalesAmm.availableToBuyFromAMM(leftMarket, IThalesAMM.Position.Up);
            uint availableRight = thalesAmm.availableToBuyFromAMM(rightMarket, IThalesAMM.Position.Down);
            uint min = availableLeft < availableRight ? availableLeft : availableRight;
            return min * 2;
        }
        return 0;
    }

    function availableToSellToAMM(
        address leftMarket,
        address rightMarket,
        RangedMarket.Position position
    ) public view returns (uint) {
        // do all checks that markets are compatible

        if (position == RangedMarket.Position.Out) {
            uint availableLeft = thalesAmm.availableToSellToAMM(leftMarket, IThalesAMM.Position.Down);
            uint availableRight = thalesAmm.availableToSellToAMM(rightMarket, IThalesAMM.Position.Up);
            return availableLeft < availableRight ? availableLeft : availableRight;
        } else {
            uint availableLeft = thalesAmm.availableToBuyFromAMM(leftMarket, IThalesAMM.Position.Up);
            uint availableRight = thalesAmm.availableToBuyFromAMM(rightMarket, IThalesAMM.Position.Down);
            uint min = availableLeft < availableRight ? availableLeft : availableRight;
            return min * 2;
        }
        return 0;
    }

    function buyFromAmmQuote(
        address leftMarket,
        address rightMarket,
        RangedMarket.Position position,
        uint amount
    ) public view returns (uint) {
        if (position == RangedMarket.Position.Out) {
            uint leftQuote = thalesAmm.buyFromAmmQuote(leftMarket, IThalesAMM.Position.Down, amount);
            uint rightQuote = thalesAmm.buyFromAmmQuote(rightMarket, IThalesAMM.Position.Up, amount);
            return (leftQuote + rightQuote) * rangedAmmFee;
        } else {
            uint leftQuote = thalesAmm.buyFromAmmQuote(leftMarket, IThalesAMM.Position.Down, amount / 2);
            uint rightQuote = thalesAmm.buyFromAmmQuote(rightMarket, IThalesAMM.Position.Up, amount / 2);
            uint quotedPrice = ((leftQuote + rightQuote) - (ONE - leftQuote - rightQuote)) * rangedAmmFee;
            return quotedPrice;
        }
    }

    function buyFromAMM(
        address leftMarket,
        address rightMarket,
        RangedMarket.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) public nonReentrant notPaused {
        uint availableToBuyFromAMMatm = availableToBuyFromAMM(leftMarket, rightMarket, position);
        require(amount <= availableToBuyFromAMMatm, "Not enough liquidity.");

        uint sUSDPaid = buyFromAmmQuote(leftMarket, rightMarket, position, amount);
        require(sUSD.balanceOf(msg.sender) >= sUSDPaid, "You dont have enough sUSD.");
        require(sUSD.allowance(msg.sender, address(this)) >= sUSDPaid, "No allowance.");
        require((sUSDPaid * ONE) / expectedPayout <= (ONE + additionalSlippage), "Slippage too high");

        sUSD.safeTransferFrom(msg.sender, address(this), sUSDPaid);

        if (position == RangedMarket.Position.Out) {
            uint leftQuote = thalesAmm.buyFromAmmQuote(leftMarket, IThalesAMM.Position.Down, amount);
            thalesAmm.buyFromAMM(leftMarket, IThalesAMM.Position.Down,amount, leftQuote, additionalSlippage);

            uint rightQuote = thalesAmm.buyFromAmmQuote(rightMarket, IThalesAMM.Position.Up, amount);
            thalesAmm.buyFromAMM(rightMarket, IThalesAMM.Position.Up,amount, rightQuote, additionalSlippage);

            if (createdRangedMarkets[leftMarket][rightMarket] == address(0)) {
                RangedMarket rm = RangedMarket(Clones.clone(rangedMarketMastercopy));
                createdRangedMarkets[leftMarket][rightMarket] = address(rm);

                InPosition inp = InPosition(Clones.clone(rangedPositionINMastercopy));
                inp.initialize(address(rm), "Position IN", "IN", address(this));

                OutPosition outp = OutPosition(Clones.clone(rangedPositionOUTMastercopy));
                outp.initialize(address(rm), "Position OUT", "OUT", address(this));

                rm.initialize(leftMarket, rightMarket, address(inp), address(outp), address(this));
            }
            RangedMarket rm = RangedMarket(createdRangedMarkets[leftMarket][rightMarket]);

            (IPosition up, IPosition down) = IPositionalMarket(leftMarket).getOptions();
            IERC20Upgradeable(address(down)).safeTransfer(address(rm), amount);

            (IPosition up, IPosition down) = IPositionalMarket(rightMarket).getOptions();
            IERC20Upgradeable(address(up)).safeTransfer(address(rm), amount);

            rm.mint(amount, RangedMarket.Position.Out, msg.sender);
            //mint
        } else {
            uint leftQuote = thalesAmm.buyFromAmmQuote(leftMarket, IThalesAMM.Position.Up, amount / 2);
            thalesAmm.buyFromAMM(leftMarket, IThalesAMM.Position.Up, amount / 2, leftQuote, additionalSlippage);

            uint rightQuote = thalesAmm.buyFromAmmQuote(rightMarket, IThalesAMM.Position.Down, amount / 2);
            thalesAmm.buyFromAMM(leftMarket, IThalesAMM.Position.Down, amount / 2, leftQuote, additionalSlippage);

            //mint

            if (createdRangedMarkets[leftMarket][rightMarket] == address(0)) {
                RangedMarket rm = RangedMarket(Clones.clone(rangedMarketMastercopy));
                createdRangedMarkets[leftMarket][rightMarket] = address(rm);

                InPosition inp = InPosition(Clones.clone(rangedPositionINMastercopy));
                inp.initialize(address(rm), "Position IN", "IN", address(this));

                OutPosition outp = OutPosition(Clones.clone(rangedPositionOUTMastercopy));
                outp.initialize(address(rm), "Position OUT", "OUT", address(this));

                rm.initialize(leftMarket, rightMarket, address(inp), address(outp), address(this));
            }
            RangedMarket rm = RangedMarket(createdRangedMarkets[leftMarket][rightMarket]);

            (IPosition up, IPosition down) = IPositionalMarket(leftMarket).getOptions();
            IERC20Upgradeable(address(up)).safeTransfer(address(rm), amount / 2);

            (IPosition up, IPosition down) = IPositionalMarket(rightMarket).getOptions();
            IERC20Upgradeable(address(down)).safeTransfer(address(rm), amount / 2);

            rm.mint(amount, RangedMarket.Position.In, msg.sender);
        }
    }

    function sellToAmmQuote(
        address leftMarket,
        address rightMarket,
        RangedMarket.Position position,
        uint amount
    ) public view returns (uint) {
        if (position == RangedMarket.Position.Out) {
            uint leftQuote = thalesAmm.buyFromAmmQuote(leftMarket, IThalesAMM.Position.Down, amount);
            uint rightQuote = thalesAmm.buyFromAmmQuote(rightMarket, IThalesAMM.Position.Up, amount);
            return (leftQuote + rightQuote) - (leftQuote + rightQuote) * rangedAmmFee;
        } else {
            uint leftQuote = thalesAmm.buyFromAmmQuote(leftMarket, IThalesAMM.Position.Down, amount / 2);
            uint rightQuote = thalesAmm.buyFromAmmQuote(rightMarket, IThalesAMM.Position.Up, amount / 2);
            uint quotedPrice = ((leftQuote + rightQuote) - (ONE - leftQuote - rightQuote));
            quotedPrice = quotedPrice - quotedPrice * rangedAmmFee;
            return quotedPrice;
        }
    }

    function sellToAMM(
        address leftMarket,
        address rightMarket,
        RangedMarket.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) public nonReentrant notPaused {
        uint availableToSellToAMMATM = availableToSellToAMM(leftMarket, rightMarket, position);
        require(availableToSellToAMMATM > 0 && amount <= availableToSellToAMMATM, "Not enough liquidity.");

        uint pricePaid = sellToAmmQuote(leftMarket, rightMarket, position, amount);
        require((expectedPayout * ONE) / pricePaid <= (ONE + additionalSlippage), "Slippage too high");

        if (position == RangedMarket.Position.Out) {
            RangedMarket rm = RangedMarket(createdRangedMarkets[leftMarket][rightMarket]);
            rm.burn(amount, RangedMarket.Position.Out, msg.sender);

            uint leftQuote = thalesAmm.sellToAmmQuote(leftMarket, IThalesAMM.Position.Down, amount);
            thalesAmm.sellToAMM(leftMarket, IThalesAMM.Position.Down, amount, leftQuote, additionalSlippage);

            uint rightQuote = thalesAmm.sellToAmmQuote(rightMarket, IThalesAMM.Position.Up, amount);
            thalesAmm.sellToAMM(rightMarket, IThalesAMM.Position.Up, amount, rightQuote, additionalSlippage);

            //mint
        } else {
            RangedMarket rm = RangedMarket(createdRangedMarkets[leftMarket][rightMarket]);
            rm.burn(amount, RangedMarket.Position.In, msg.sender);

            uint leftQuote = thalesAmm.sellToAmmQuote(leftMarket, IThalesAMM.Position.Up, amount);
            thalesAmm.sellToAMM(leftMarket, IThalesAMM.Position.Up, amount, leftQuote, additionalSlippage);

            uint rightQuote = thalesAmm.sellToAmmQuote(rightMarket, IThalesAMM.Position.Down, amount);
            thalesAmm.sellToAMM(rightMarket, IThalesAMM.Position.Down, amount, rightQuote, additionalSlippage);
        }

        sUSD.transfer(msg.sender, pricePaid);
    }

    function setRangedMarketMastercopy(address _rangedMarketMastercopy) external onlyOwner {
        rangedMarketMastercopy = _rangedMarketMastercopy;
    }

    function setRangedPositionINMastercopy(address _rangedPositionINMastercopy) external onlyOwner {
        rangedPositionINMastercopy = _rangedPositionINMastercopy;
    }

    function setRangedPositionOUTMastercopy(address _rangedPositionOUTMastercopy) external onlyOwner {
        rangedPositionOUTMastercopy = _rangedPositionOUTMastercopy;
    }
}

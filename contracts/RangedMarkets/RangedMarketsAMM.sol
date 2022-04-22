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
    using AddressSetLib for AddressSetLib.AddressSet;
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

    mapping(address => uint) public spentOnMarket;

    // IMPORTANT: AMM risks only half or the payout effectively, but it risks the whole amount on price movements
    uint public capPerMarket;

    uint public minSupportedPrice;
    uint public maxSupportedPrice;

    function initialize(
        address _owner,
        IThalesAMM _thalesAmm,
        uint _rangedAmmFee,
        uint _capPerMarket,
        IERC20Upgradeable _sUSD
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        thalesAmm = _thalesAmm;
        capPerMarket = _capPerMarket;
        rangedAmmFee = _rangedAmmFee;
        sUSD = _sUSD;
    }

    function createRangedMarket(address leftMarket, address rightMarket) external {
        require(thalesAmm.isMarketInAMMTrading(leftMarket), "Unsupported left market!");
        require(thalesAmm.isMarketInAMMTrading(rightMarket), "Unsupported right market!");
        (uint maturityLeft, ) = IPositionalMarket(leftMarket).times();
        (uint maturityRight, ) = IPositionalMarket(rightMarket).times();
        require(maturityLeft == maturityRight, "Markets do not mature at the same time!");

        (bytes32 leftkey, uint leftstrikePrice, ) = IPositionalMarket(leftMarket).getOracleDetails();
        (bytes32 rightkey, uint rightstrikePrice, ) = IPositionalMarket(rightMarket).getOracleDetails();
        require(leftkey == rightkey, "Markets do not have the same asset!");
        require(leftstrikePrice < rightstrikePrice, "Left market's strike is not lower than the one of right market!");

        // strike prices need to be at least 5% apart
        require(((ONE + 5 * ONE_PERCENT) * leftstrikePrice) / ONE < rightstrikePrice, "Range of strikes too low!");

        require(createdRangedMarkets[leftMarket][rightMarket] == address(0), "Ranged market already exists");

        require(address(rangedMarketMastercopy) != address(0), "Mastercopy not set");
        require(address(rangedPositionINMastercopy) != address(0), "In Mastercopy not set");
        require(address(rangedPositionOUTMastercopy) != address(0), "Out Mastercopy not set");

        RangedMarket rm = RangedMarket(Clones.clone(rangedMarketMastercopy));
        createdRangedMarkets[leftMarket][rightMarket] = address(rm);

        InPosition inp = InPosition(Clones.clone(rangedPositionINMastercopy));
        inp.initialize(address(rm), "Position IN", "IN", address(this));

        OutPosition outp = OutPosition(Clones.clone(rangedPositionOUTMastercopy));
        outp.initialize(address(rm), "Position OUT", "OUT", address(this));

        rm.initialize(leftMarket, rightMarket, address(inp), address(outp), address(this));

        _knownMarkets.add(address(rm));

        emit RangedMarketCreated(address(rm), leftMarket, rightMarket);
    }

    function availableToBuyFromAMM(RangedMarket rangedMarket, RangedMarket.Position position)
        public
        view
        knownRangedMarket(address(rangedMarket))
        returns (uint)
    {
        uint basePrice = buyFromAmmQuote(rangedMarket, position, ONE);
        if (basePrice <= minSupportedPrice || basePrice >= maxSupportedPrice) {
            return 0;
        }

        if (position == RangedMarket.Position.Out) {
            return _availableToBuyFromAMMOut(rangedMarket);
        } else {
            return _availableToBuyFromAMMIn(rangedMarket);
        }
    }

    function _availableToBuyFromAMMOut(RangedMarket rangedMarket) internal view returns (uint) {
        uint availableLeft = thalesAmm.availableToBuyFromAMM(address(rangedMarket.leftMarket()), IThalesAMM.Position.Down);
        uint availableRight = thalesAmm.availableToBuyFromAMM(address(rangedMarket.rightMarket()), IThalesAMM.Position.Up);
        return availableLeft < availableRight ? availableLeft : availableRight;
    }

    function _availableToBuyFromAMMIn(RangedMarket rangedMarket) internal view returns (uint) {
        uint availableLeft = thalesAmm.availableToBuyFromAMM(address(rangedMarket.leftMarket()), IThalesAMM.Position.Up);
        uint availableRight = thalesAmm.availableToBuyFromAMM(address(rangedMarket.rightMarket()), IThalesAMM.Position.Down);
        uint availableThalesAMM = (availableLeft < availableRight ? availableLeft : availableRight) * 2;
        uint leftoverOnMarket = capPerMarket - spentOnMarket[address(rangedMarket)];
        uint rangedAMMRisk = ONE - minInPrice(rangedMarket);
        uint availableRangedAmm = (leftoverOnMarket * ONE) / rangedAMMRisk;
        return availableThalesAMM > availableRangedAmm ? availableRangedAmm : availableThalesAMM;
    }

    function minInPrice(RangedMarket rangedMarket) public view knownRangedMarket(address(rangedMarket)) returns (uint) {
        uint leftQuote = thalesAmm.buyFromAmmQuote(address(rangedMarket.leftMarket()), IThalesAMM.Position.Up, ONE);
        uint rightQuote = thalesAmm.buyFromAmmQuote(address(rangedMarket.rightMarket()), IThalesAMM.Position.Down, ONE);
        uint quotedPrice = ((leftQuote + rightQuote) - ((ONE - leftQuote) + (ONE - rightQuote))) / 2;
        return quotedPrice;
    }

    function buyFromAmmQuote(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount
    ) public view knownRangedMarket(address(rangedMarket)) returns (uint) {
        if (position == RangedMarket.Position.Out) {
            uint quoteWithoutFees =
                (thalesAmm.buyFromAmmQuote(address(rangedMarket.leftMarket()), IThalesAMM.Position.Down, amount) +
                    thalesAmm.buyFromAmmQuote(address(rangedMarket.rightMarket()), IThalesAMM.Position.Up, amount));
            return (quoteWithoutFees * (rangedAmmFee + ONE)) / ONE;
        } else {
            uint leftQuote =
                thalesAmm.buyFromAmmQuote(address(rangedMarket.leftMarket()), IThalesAMM.Position.Up, amount / 2);
            uint rightQuote =
                thalesAmm.buyFromAmmQuote(address(rangedMarket.rightMarket()), IThalesAMM.Position.Down, amount / 2);
            uint quoteWithoutFees = ((leftQuote + rightQuote) - ((amount / 2 - leftQuote) + (amount / 2 - rightQuote)));
            return (quoteWithoutFees * (rangedAmmFee + ONE)) / ONE;
        }
    }

    function buyFromAmmQuoteDetailed(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount
    )
        public
        view
        knownRangedMarket(address(rangedMarket))
        returns (
            uint,
            uint,
            uint
        )
    {
        if (position == RangedMarket.Position.Out) {
            uint leftQuote = thalesAmm.buyFromAmmQuote(address(rangedMarket.leftMarket()), IThalesAMM.Position.Down, amount);
            uint rightQuote = thalesAmm.buyFromAmmQuote(address(rangedMarket.rightMarket()), IThalesAMM.Position.Up, amount);
            uint quoteWithoutFees = leftQuote + rightQuote;
            uint quoteWithFees = (quoteWithoutFees * (rangedAmmFee + ONE)) / ONE;
            return (quoteWithFees, leftQuote, rightQuote);
        } else {
            uint leftQuote =
                thalesAmm.buyFromAmmQuote(address(rangedMarket.leftMarket()), IThalesAMM.Position.Up, amount / 2);
            uint rightQuote =
                thalesAmm.buyFromAmmQuote(address(rangedMarket.rightMarket()), IThalesAMM.Position.Down, amount / 2);
            uint quoteWithoutFees = ((leftQuote + rightQuote) - ((amount / 2 - leftQuote) + (amount / 2 - rightQuote)));
            uint quoteWithFees = (quoteWithoutFees * (rangedAmmFee + ONE)) / ONE;
            return (quoteWithFees, leftQuote, rightQuote);
        }
    }

    function buyFromAMM(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) public knownRangedMarket(address(rangedMarket)) nonReentrant notPaused {
        require(amount <= availableToBuyFromAMM(rangedMarket, position), "Not enough liquidity.");

        (uint sUSDPaid, uint leftQuote, uint rightQuote) = buyFromAmmQuoteDetailed(rangedMarket, position, amount);
        require(sUSD.balanceOf(msg.sender) >= sUSDPaid, "You dont have enough sUSD.");
        require(sUSD.allowance(msg.sender, address(this)) >= sUSDPaid, "No allowance.");
        require((sUSDPaid * ONE) / expectedPayout <= (ONE + additionalSlippage), "Slippage too high");

        sUSD.safeTransferFrom(msg.sender, address(this), sUSDPaid);
        uint spentForThalesAMM = leftQuote + rightQuote;

        if (position == RangedMarket.Position.Out) {
            thalesAmm.buyFromAMM(
                address(rangedMarket.leftMarket()),
                IThalesAMM.Position.Down,
                amount,
                leftQuote,
                additionalSlippage
            );

            thalesAmm.buyFromAMM(
                address(rangedMarket.rightMarket()),
                IThalesAMM.Position.Up,
                amount,
                rightQuote,
                additionalSlippage
            );

            (, IPosition down) = IPositionalMarket(rangedMarket.leftMarket()).getOptions();
            IERC20Upgradeable(address(down)).safeTransfer(address(rangedMarket), amount);

            (IPosition up1, ) = IPositionalMarket(rangedMarket.rightMarket()).getOptions();
            IERC20Upgradeable(address(up1)).safeTransfer(address(rangedMarket), amount);

            rangedMarket.mint(amount, RangedMarket.Position.Out, msg.sender);
        } else {
            thalesAmm.buyFromAMM(
                address(rangedMarket.leftMarket()),
                IThalesAMM.Position.Up,
                amount / 2,
                leftQuote,
                additionalSlippage
            );

            thalesAmm.buyFromAMM(
                address(rangedMarket.rightMarket()),
                IThalesAMM.Position.Down,
                amount / 2,
                rightQuote,
                additionalSlippage
            );

            (IPosition up, ) = IPositionalMarket(rangedMarket.leftMarket()).getOptions();
            IERC20Upgradeable(address(up)).safeTransfer(address(rangedMarket), amount / 2);

            (, IPosition down1) = IPositionalMarket(rangedMarket.rightMarket()).getOptions();
            IERC20Upgradeable(address(down1)).safeTransfer(address(rangedMarket), amount / 2);

            rangedMarket.mint(amount, RangedMarket.Position.In, msg.sender);
        }
        // TODO:safeBoxFee
        spentOnMarket[address(rangedMarket)] = spentOnMarket[address(rangedMarket)] + spentForThalesAMM - sUSDPaid;
    }

    function availableToSellToAMM(RangedMarket rangedMarket, RangedMarket.Position position)
        public
        view
        knownRangedMarket(address(rangedMarket))
        returns (uint)
    {
        uint basePrice = sellToAmmQuote(rangedMarket, position, ONE);
        if (basePrice <= minSupportedPrice || basePrice >= maxSupportedPrice) {
            return 0;
        }
        if (position == RangedMarket.Position.Out) {
            uint availableLeft =
                thalesAmm.availableToSellToAMM(address(rangedMarket.leftMarket()), IThalesAMM.Position.Down);
            uint availableRight =
                thalesAmm.availableToSellToAMM(address(rangedMarket.rightMarket()), IThalesAMM.Position.Up);
            return availableLeft < availableRight ? availableLeft : availableRight;
        } else {
            uint availableLeft = thalesAmm.availableToBuyFromAMM(address(rangedMarket.leftMarket()), IThalesAMM.Position.Up);
            uint availableRight =
                thalesAmm.availableToBuyFromAMM(address(rangedMarket.rightMarket()), IThalesAMM.Position.Down);
            uint min = availableLeft < availableRight ? availableLeft : availableRight;
            return min * 2;
        }
    }

    function sellToAmmQuote(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount
    ) public view knownRangedMarket(address(rangedMarket)) returns (uint) {
        if (position == RangedMarket.Position.Out) {
            uint leftQuote = thalesAmm.sellToAmmQuote(address(rangedMarket.leftMarket()), IThalesAMM.Position.Down, amount);
            uint rightQuote = thalesAmm.sellToAmmQuote(address(rangedMarket.rightMarket()), IThalesAMM.Position.Up, amount);
            uint quoteWithoutFees = leftQuote + rightQuote;
            return (quoteWithoutFees * (ONE - rangedAmmFee)) / ONE;
        } else {
            uint leftQuote =
                thalesAmm.sellToAmmQuote(address(rangedMarket.leftMarket()), IThalesAMM.Position.Down, amount / 2);
            uint rightQuote =
                thalesAmm.sellToAmmQuote(address(rangedMarket.rightMarket()), IThalesAMM.Position.Up, amount / 2);
            uint quoteWithoutFees = ((leftQuote + rightQuote) - ((amount / 2 - leftQuote) + (amount / 2 - rightQuote)));
            return (quoteWithoutFees * (ONE - rangedAmmFee)) / ONE;
        }
    }

    function sellToAmmQuoteDetailed(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount
    )
        public
        view
        knownRangedMarket(address(rangedMarket))
        returns (
            uint,
            uint,
            uint
        )
    {
        if (position == RangedMarket.Position.Out) {
            uint leftQuote = thalesAmm.sellToAmmQuote(address(rangedMarket.leftMarket()), IThalesAMM.Position.Down, amount);
            uint rightQuote = thalesAmm.sellToAmmQuote(address(rangedMarket.rightMarket()), IThalesAMM.Position.Up, amount);
            uint quoteWithoutFees = leftQuote + rightQuote;
            uint quoteWithFees = (quoteWithoutFees * (ONE - rangedAmmFee)) / ONE;
            return (quoteWithFees, leftQuote, rightQuote);
        } else {
            uint leftQuote =
                thalesAmm.sellToAmmQuote(address(rangedMarket.leftMarket()), IThalesAMM.Position.Down, amount / 2);
            uint rightQuote =
                thalesAmm.sellToAmmQuote(address(rangedMarket.rightMarket()), IThalesAMM.Position.Up, amount / 2);
            uint quoteWithoutFees = ((leftQuote + rightQuote) - ((amount / 2 - leftQuote) + (amount / 2 - rightQuote)));
            uint quoteWithFees = (quoteWithoutFees * (ONE - rangedAmmFee)) / ONE;
            return (quoteWithFees, leftQuote, rightQuote);
        }
    }

    function sellToAMM(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) public knownRangedMarket(address(rangedMarket)) nonReentrant notPaused {
        uint availableToSellToAMMATM = availableToSellToAMM(rangedMarket, position);
        require(availableToSellToAMMATM > 0 && amount <= availableToSellToAMMATM, "Not enough liquidity.");

        (uint pricePaid, uint leftQuote, uint rightQuote) = sellToAmmQuoteDetailed(rangedMarket, position, amount);
        require((expectedPayout * ONE) / pricePaid <= (ONE + additionalSlippage), "Slippage too high");

        uint gotFromThalesAMM = leftQuote + rightQuote;

        if (position == RangedMarket.Position.Out) {
            rangedMarket.burn(amount, RangedMarket.Position.Out, msg.sender);

            thalesAmm.sellToAMM(
                address(rangedMarket.leftMarket()),
                IThalesAMM.Position.Down,
                amount,
                leftQuote,
                additionalSlippage
            );

            thalesAmm.sellToAMM(
                address(rangedMarket.rightMarket()),
                IThalesAMM.Position.Up,
                amount,
                rightQuote,
                additionalSlippage
            );
            // maybe include left and right quotes as part of buyFromAMMQuote return, or just review the pricing is correct
        } else {
            rangedMarket.burn(amount, RangedMarket.Position.In, msg.sender);

            thalesAmm.sellToAMM(
                address(rangedMarket.leftMarket()),
                IThalesAMM.Position.Up,
                amount,
                leftQuote,
                additionalSlippage
            );

            thalesAmm.sellToAMM(
                address(rangedMarket.rightMarket()),
                IThalesAMM.Position.Down,
                amount,
                rightQuote,
                additionalSlippage
            );
        }
        // TODO: update safeBoxFee
        spentOnMarket[address(rangedMarket)] = spentOnMarket[address(rangedMarket)] - gotFromThalesAMM + pricePaid;
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

    function setMinSupportedPrice(uint _minSupportedPrice) public onlyOwner {
        minSupportedPrice = _minSupportedPrice;
    }

    function setMaxSupportedPrice(uint _maxSupportedPrice) public onlyOwner {
        maxSupportedPrice = _maxSupportedPrice;
    }

    modifier knownRangedMarket(address market) {
        require(_knownMarkets.contains(market), "Not a known ranged market");
        _;
    }

    event RangedMarketCreated(address market, address leftMarket, address rightMarket);
}

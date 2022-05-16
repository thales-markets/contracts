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

import "./RangedPosition.sol";
import "./RangedPosition.sol";
import "./RangedMarket.sol";
import "../interfaces/IPositionalMarket.sol";
import "../interfaces/IStakingThales.sol";

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
    address public rangedPositionMastercopy;

    IERC20Upgradeable public sUSD;

    mapping(address => uint) public spentOnMarket;

    // IMPORTANT: AMM risks only half or the payout effectively, but it risks the whole amount on price movements
    uint public capPerMarket;

    uint public minSupportedPrice;
    uint public maxSupportedPrice;

    address public safeBox;
    uint public safeBoxImpact;

    uint public minimalDifBetweenStrikes;

    IStakingThales public stakingThales;

    function initialize(
        address _owner,
        IThalesAMM _thalesAmm,
        uint _rangedAmmFee,
        uint _capPerMarket,
        IERC20Upgradeable _sUSD,
        address _safeBox,
        uint _safeBoxImpact
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        thalesAmm = _thalesAmm;
        capPerMarket = _capPerMarket;
        rangedAmmFee = _rangedAmmFee;
        sUSD = _sUSD;
        safeBox = _safeBox;
        safeBoxImpact = _safeBoxImpact;

        sUSD.approve(address(thalesAmm), type(uint256).max);
    }

    function createRangedMarket(address leftMarket, address rightMarket) external nonReentrant notPaused {
        require(canCreateRangedMarket(leftMarket, rightMarket), "Can't create such a ranged market!");

        RangedMarket rm = RangedMarket(Clones.clone(rangedMarketMastercopy));
        createdRangedMarkets[leftMarket][rightMarket] = address(rm);

        RangedPosition inp = RangedPosition(Clones.clone(rangedPositionMastercopy));
        inp.initialize(address(rm), "Position IN", "IN", address(this));

        RangedPosition outp = RangedPosition(Clones.clone(rangedPositionMastercopy));
        outp.initialize(address(rm), "Position OUT", "OUT", address(this));

        rm.initialize(leftMarket, rightMarket, address(inp), address(outp), address(this));

        _knownMarkets.add(address(rm));

        emit RangedMarketCreated(address(rm), leftMarket, rightMarket);
    }

    function canCreateRangedMarket(address leftMarket, address rightMarket) public view returns (bool) {
        if (!thalesAmm.isMarketInAMMTrading(leftMarket) || !thalesAmm.isMarketInAMMTrading(rightMarket)) {
            return false;
        }
        (uint maturityLeft, ) = IPositionalMarket(leftMarket).times();
        (uint maturityRight, ) = IPositionalMarket(rightMarket).times();
        if (maturityLeft != maturityRight) {
            return false;
        }

        (bytes32 leftkey, uint leftstrikePrice, ) = IPositionalMarket(leftMarket).getOracleDetails();
        (bytes32 rightkey, uint rightstrikePrice, ) = IPositionalMarket(rightMarket).getOracleDetails();
        if (leftkey != rightkey) {
            return false;
        }
        if (leftstrikePrice >= rightstrikePrice) {
            return false;
        }

        if (!(((ONE + minimalDifBetweenStrikes * ONE_PERCENT) * leftstrikePrice) / ONE < rightstrikePrice)) {
            return false;
        }

        if (createdRangedMarkets[leftMarket][rightMarket] != address(0)) {
            return false;
        }

        return true;
    }

    function _availableToBuyFromAMMOnlyRanged(RangedMarket rangedMarket, RangedMarket.Position position)
        internal
        view
        knownRangedMarket(address(rangedMarket))
        returns (uint)
    {
        if (position == RangedMarket.Position.Out) {
            return type(uint256).max;
        } else {
            return _availableToBuyFromAMMInOnlyRanged(rangedMarket);
        }
    }

    function availableToBuyFromAMM(RangedMarket rangedMarket, RangedMarket.Position position)
        public
        view
        knownRangedMarket(address(rangedMarket))
        returns (uint)
    {
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
        uint availableRangedAmm = _availableToBuyFromAMMInOnlyRanged(rangedMarket);
        return availableThalesAMM > availableRangedAmm ? availableRangedAmm : availableThalesAMM;
    }

    function _availableToBuyFromAMMInOnlyRanged(RangedMarket rangedMarket) internal view returns (uint) {
        uint leftoverOnMarket = capPerMarket - spentOnMarket[address(rangedMarket)];
        uint minPrice = minInPrice(rangedMarket);
        if (minPrice <= minSupportedPrice || minPrice >= maxSupportedPrice) {
            return 0;
        }
        uint rangedAMMRisk = ONE - minInPrice(rangedMarket);
        uint availableRangedAmm = (leftoverOnMarket * ONE) / rangedAMMRisk;
        return availableRangedAmm;
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
        (uint sUSDPaid, , ) = buyFromAmmQuoteDetailed(rangedMarket, position, amount);
        uint basePrice = (sUSDPaid * ONE) / amount;
        if (basePrice < minSupportedPrice || basePrice >= ONE) {
            return 0;
        }
        return sUSDPaid;
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
            uint quoteWithFees = (quoteWithoutFees * (rangedAmmFee + safeBoxImpact + ONE)) / ONE;
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
        require(amount <= _availableToBuyFromAMMOnlyRanged(rangedMarket, position), "Not enough liquidity");

        (uint sUSDPaid, uint leftQuote, uint rightQuote) = buyFromAmmQuoteDetailed(rangedMarket, position, amount);

        uint basePrice = (sUSDPaid * ONE) / amount;
        require(basePrice > minSupportedPrice && basePrice < ONE, "Invalid price");
        require((sUSDPaid * ONE) / expectedPayout <= (ONE + additionalSlippage), "Slippage too high");

        sUSD.safeTransferFrom(msg.sender, address(this), sUSDPaid);

        address target;
        (RangedPosition inp, RangedPosition outp) = rangedMarket.positions();

        if (position == RangedMarket.Position.Out) {
            target = address(outp);

            _buyOUT(rangedMarket, amount, leftQuote, rightQuote, additionalSlippage);

            rangedMarket.mint(amount, RangedMarket.Position.Out, msg.sender);
        } else {
            target = address(inp);

            _buyIN(rangedMarket, amount, leftQuote, rightQuote, additionalSlippage);

            rangedMarket.mint(amount, RangedMarket.Position.In, msg.sender);
            _updateSpentOnMarketAndSafeBoxOnBuy(address(rangedMarket), amount, sUSDPaid);
        }
        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(msg.sender, sUSDPaid);
        }
        emit BoughtFromAmm(msg.sender, address(rangedMarket), position, amount, sUSDPaid, address(sUSD), target);
    }

    function _buyOUT(
        RangedMarket rangedMarket,
        uint amount,
        uint leftQuote,
        uint rightQuote,
        uint additionalSlippage
    ) internal {
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
    }

    function _buyIN(
        RangedMarket rangedMarket,
        uint amount,
        uint leftQuote,
        uint rightQuote,
        uint additionalSlippage
    ) internal {
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
    }

    function _updateSpentOnMarketAndSafeBoxOnBuy(
        address rangedMarket,
        uint amount,
        uint sUSDPaid
    ) internal {
        uint safeBoxShare = sUSDPaid - ((sUSDPaid * ONE) / (ONE + safeBoxImpact));
        if (safeBoxImpact > 0) {
            sUSD.transfer(safeBox, safeBoxShare);
        } else {
            safeBoxShare = 0;
        }

        spentOnMarket[rangedMarket] = spentOnMarket[rangedMarket] + amount + safeBoxShare - sUSDPaid;
    }

    function availableToSellToAMM(RangedMarket rangedMarket, RangedMarket.Position position)
        public
        view
        knownRangedMarket(address(rangedMarket))
        returns (uint)
    {
        if (position == RangedMarket.Position.Out) {
            uint availableLeft =
                thalesAmm.availableToSellToAMM(address(rangedMarket.leftMarket()), IThalesAMM.Position.Down);
            uint availableRight =
                thalesAmm.availableToSellToAMM(address(rangedMarket.rightMarket()), IThalesAMM.Position.Up);
            return availableLeft < availableRight ? availableLeft : availableRight;
        } else {
            uint availableLeft = thalesAmm.availableToSellToAMM(address(rangedMarket.leftMarket()), IThalesAMM.Position.Up);
            uint availableRight =
                thalesAmm.availableToSellToAMM(address(rangedMarket.rightMarket()), IThalesAMM.Position.Down);
            uint min = availableLeft < availableRight ? availableLeft : availableRight;
            return min * 2;
        }
    }

    function sellToAmmQuote(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount
    ) public view knownRangedMarket(address(rangedMarket)) returns (uint) {
        (uint pricePaid, , ) = sellToAmmQuoteDetailed(rangedMarket, position, amount);
        return pricePaid;
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
                thalesAmm.sellToAmmQuote(address(rangedMarket.leftMarket()), IThalesAMM.Position.Up, amount / 2);
            uint rightQuote =
                thalesAmm.sellToAmmQuote(address(rangedMarket.rightMarket()), IThalesAMM.Position.Down, amount / 2);
            uint quoteWithoutFees = ((leftQuote + rightQuote) - ((amount / 2 - leftQuote) + (amount / 2 - rightQuote)));
            uint quoteWithFees = (quoteWithoutFees * (ONE - rangedAmmFee - safeBoxImpact)) / ONE;
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

        address target;
        (RangedPosition inp, RangedPosition outp) = rangedMarket.positions();

        if (position == RangedMarket.Position.Out) {
            target = address(outp);
            rangedMarket.burnOut(amount, msg.sender);
            _sellOUT(rangedMarket, amount, leftQuote, rightQuote, additionalSlippage);
        } else {
            target = address(inp);
            rangedMarket.burnIn(amount, msg.sender);

            _sellIN(rangedMarket, amount, leftQuote, rightQuote, additionalSlippage);

            _updateSpentOnMarketAndSafeBoxOnSell(amount, rangedMarket, pricePaid);
        }

        sUSD.safeTransfer(msg.sender, pricePaid);

        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(msg.sender, pricePaid);
        }

        emit SoldToAMM(msg.sender, address(rangedMarket), position, amount, pricePaid, address(sUSD), target);
    }

    function _sellOUT(
        RangedMarket rangedMarket,
        uint amount,
        uint leftQuote,
        uint rightQuote,
        uint additionalSlippage
    ) internal {
        //TODO: remove this after Positional Market have the correct AMM address
        (, IPosition down) = IPositionalMarket(rangedMarket.leftMarket()).getOptions();
        (IPosition up, ) = IPositionalMarket(rangedMarket.rightMarket()).getOptions();
        IERC20Upgradeable(address(down)).approve(address(thalesAmm), type(uint256).max);
        IERC20Upgradeable(address(up)).approve(address(thalesAmm), type(uint256).max);
        //TODO: to here

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
    }

    function _sellIN(
        RangedMarket rangedMarket,
        uint amount,
        uint leftQuote,
        uint rightQuote,
        uint additionalSlippage
    ) internal {
        //TODO: remove this after Positional Market have the correct AMM address
        (IPosition up, ) = IPositionalMarket(rangedMarket.leftMarket()).getOptions();
        (, IPosition down) = IPositionalMarket(rangedMarket.rightMarket()).getOptions();
        IERC20Upgradeable(address(down)).approve(address(thalesAmm), type(uint256).max);
        IERC20Upgradeable(address(up)).approve(address(thalesAmm), type(uint256).max);
        //TODO: to here
        thalesAmm.sellToAMM(
            address(rangedMarket.leftMarket()),
            IThalesAMM.Position.Up,
            amount / 2,
            leftQuote,
            additionalSlippage
        );

        thalesAmm.sellToAMM(
            address(rangedMarket.rightMarket()),
            IThalesAMM.Position.Down,
            amount / 2,
            rightQuote,
            additionalSlippage
        );
    }

    function _updateSpentOnMarketAndSafeBoxOnSell(
        uint amount,
        RangedMarket rangedMarket,
        uint sUSDPaid
    ) internal {
        uint safeBoxShare = ((sUSDPaid * ONE) / (ONE - safeBoxImpact)) - sUSDPaid;

        if (safeBoxImpact > 0) {
            sUSD.transfer(safeBox, safeBoxShare);
        } else {
            safeBoxShare = 0;
        }

        // consider that amount might be 18 decimals
        if (amount > (spentOnMarket[address(rangedMarket)] + sUSDPaid + safeBoxShare)) {
            spentOnMarket[address(rangedMarket)] = 0;
        } else {
            spentOnMarket[address(rangedMarket)] = spentOnMarket[address(rangedMarket)] + sUSDPaid + safeBoxShare - amount;
        }
    }

    function withdrawCollateral(RangedMarket rangedMarket)
        external
        onlyOwner
        knownRangedMarket(address(rangedMarket))
        nonReentrant
        notPaused
    {
        rangedMarket.withdrawCollateral(safeBox);
    }

    function setRangedMarketMastercopy(address _rangedMarketMastercopy) external onlyOwner {
        rangedMarketMastercopy = _rangedMarketMastercopy;
    }

    function setRangedPositionMastercopy(address _rangedPositionMastercopy) external onlyOwner {
        rangedPositionMastercopy = _rangedPositionMastercopy;
    }

    function setMinMaxSupportedPrice(
        uint _minSupportedPrice,
        uint _maxSupportedPrice,
        uint _minDiffBetweenStrikes
    ) public onlyOwner {
        minSupportedPrice = _minSupportedPrice;
        maxSupportedPrice = _maxSupportedPrice;
        minimalDifBetweenStrikes = _minDiffBetweenStrikes;
        emit SetMinSupportedPrice(minSupportedPrice);
        emit SetMaxSupportedPrice(maxSupportedPrice);
        emit SetMinimalDifBetweenStrikes(minimalDifBetweenStrikes);
    }

    function setSafeBoxData(address _safeBox, uint _safeBoxImpact) external onlyOwner {
        safeBoxImpact = _safeBoxImpact;
        safeBox = _safeBox;
        emit SetSafeBoxImpact(_safeBoxImpact);
        emit SetSafeBox(_safeBox);
    }

    function setCapPerMarketAndRangedAMMFee(uint _capPerMarket, uint _rangedAMMFee) external onlyOwner {
        capPerMarket = _capPerMarket;
        rangedAmmFee = _rangedAMMFee;
        emit SetCapPerMarket(capPerMarket);
        emit SetRangedAmmFee(rangedAmmFee);
    }

    function setThalesAMM(address _thalesAMM) external onlyOwner {
        thalesAmm = IThalesAMM(_thalesAMM);
        sUSD.approve(address(thalesAmm), type(uint256).max);
        emit SetThalesAMM(_thalesAMM);
    }

    function setStakingThales(IStakingThales _stakingThales) external onlyOwner {
        stakingThales = _stakingThales;
        emit SetStakingThales(address(_stakingThales));
    }

    modifier knownRangedMarket(address market) {
        require(_knownMarkets.contains(market), "Not a known ranged market");
        _;
    }

    event SoldToAMM(
        address seller,
        address market,
        RangedMarket.Position position,
        uint amount,
        uint sUSDPaid,
        address susd,
        address asset
    );
    event BoughtFromAmm(
        address buyer,
        address market,
        RangedMarket.Position position,
        uint amount,
        uint sUSDPaid,
        address susd,
        address asset
    );

    event SetAmm(address amm);
    event SetSUSD(address sUSD);
    event SetThalesAMM(address amm);
    event RangedMarketCreated(address market, address leftMarket, address rightMarket);
    event SetSafeBoxImpact(uint _safeBoxImpact);
    event SetSafeBox(address _safeBox);
    event SetMinSupportedPrice(uint _spread);
    event SetMaxSupportedPrice(uint _spread);
    event SetMinimalDifBetweenStrikes(uint _spread);
    event SetCapPerMarket(uint capPerMarket);
    event SetRangedAmmFee(uint rangedAmmFee);
    event SetStakingThales(address _stakingThales);
}

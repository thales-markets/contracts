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
import "../interfaces/IReferrals.sol";
import "../interfaces/ICurveSUSD.sol";

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

    uint public maximalDifBetweenStrikes;

    address public referrals;
    uint public referrerFee;

    ICurveSUSD public curveSUSD;

    address public usdc;
    address public usdt;
    address public dai;

    bool public curveOnrampEnabled;

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

        if (!(((ONE + maximalDifBetweenStrikes * ONE_PERCENT) * leftstrikePrice) / ONE > rightstrikePrice)) {
            return false;
        }

        return createdRangedMarkets[leftMarket][rightMarket] == address(0);
    }

    function availableToBuyFromAMM(RangedMarket rangedMarket, RangedMarket.Position position)
        public
        view
        knownRangedMarket(address(rangedMarket))
        returns (uint)
    {
        uint availableLeft =
            thalesAmm.availableToBuyFromAMM(
                address(rangedMarket.leftMarket()),
                position == RangedMarket.Position.Out ? IThalesAMM.Position.Down : IThalesAMM.Position.Up
            );
        uint availableRight =
            thalesAmm.availableToBuyFromAMM(
                address(rangedMarket.rightMarket()),
                position == RangedMarket.Position.Out ? IThalesAMM.Position.Up : IThalesAMM.Position.Down
            );
        if (position == RangedMarket.Position.Out) {
            return availableLeft < availableRight ? availableLeft : availableRight;
        } else {
            uint availableThalesAMM = (availableLeft < availableRight ? availableLeft : availableRight) * 2;
            uint availableRangedAmm = _availableToBuyFromAMMOnlyRangedIN(rangedMarket);
            return availableThalesAMM > availableRangedAmm ? availableRangedAmm : availableThalesAMM;
        }
    }

    function _availableToBuyFromAMMOnlyRangedIN(RangedMarket rangedMarket)
        internal
        view
        knownRangedMarket(address(rangedMarket))
        returns (uint availableRangedAmm)
    {
        uint minPrice = IPositionalMarketManager(thalesAmm.manager()).reverseTransformCollateral(minInPrice(rangedMarket));
        if (minPrice <= minSupportedPrice || minPrice >= maxSupportedPrice) {
            return 0;
        }
        uint rangedAMMRisk = ONE - minPrice;
        availableRangedAmm = ((capPerMarket - spentOnMarket[address(rangedMarket)]) * ONE) / rangedAMMRisk;
    }

    function minInPrice(RangedMarket rangedMarket)
        public
        view
        knownRangedMarket(address(rangedMarket))
        returns (uint quotedPrice)
    {
        uint leftQuote = thalesAmm.buyFromAmmQuote(address(rangedMarket.leftMarket()), IThalesAMM.Position.Up, ONE);
        uint rightQuote = thalesAmm.buyFromAmmQuote(address(rangedMarket.rightMarket()), IThalesAMM.Position.Down, ONE);
        quotedPrice = ((leftQuote + rightQuote) - ((ONE - leftQuote) + (ONE - rightQuote))) / 2;
    }

    function buyFromAmmQuote(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount
    ) public view knownRangedMarket(address(rangedMarket)) returns (uint sUSDPaid) {
        (sUSDPaid, , ) = buyFromAmmQuoteDetailed(rangedMarket, position, amount);
        uint basePrice = (sUSDPaid * ONE) / amount;
        if (basePrice < minSupportedPrice || basePrice >= ONE) {
            sUSDPaid = 0;
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
            uint quoteWithFees,
            uint leftQuote,
            uint rightQuote
        )
    {
        amount = position == RangedMarket.Position.Out ? amount : amount / 2;
        leftQuote = thalesAmm.buyFromAmmQuote(
            address(rangedMarket.leftMarket()),
            position == RangedMarket.Position.Out ? IThalesAMM.Position.Down : IThalesAMM.Position.Up,
            amount
        );
        rightQuote = thalesAmm.buyFromAmmQuote(
            address(rangedMarket.rightMarket()),
            position == RangedMarket.Position.Out ? IThalesAMM.Position.Up : IThalesAMM.Position.Down,
            amount
        );
        uint summedQuotes = leftQuote + rightQuote;
        if (position == RangedMarket.Position.Out) {
            quoteWithFees = (summedQuotes * (rangedAmmFee + ONE)) / ONE;
        } else {
            uint quoteWithoutFees = ((summedQuotes) - ((amount - leftQuote) + (amount - rightQuote)));
            quoteWithFees = (quoteWithoutFees * (rangedAmmFee + safeBoxImpact + ONE)) / ONE;
        }
    }

    function buyFromAmmQuoteWithDifferentCollateral(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount,
        address collateral
    ) public view returns (uint collateralQuote, uint sUSDToPay) {
        int128 curveIndex = _mapCollateralToCurveIndex(collateral);
        if (curveIndex == 0 || !curveOnrampEnabled) {
            return (0, 0);
        }

        sUSDToPay = buyFromAmmQuote(rangedMarket, position, amount);
        //cant get a quote on how much collateral is needed from curve for sUSD,
        //so rather get how much of collateral you get for the sUSD quote and add 0.2% to that
        collateralQuote = (curveSUSD.get_dy_underlying(0, curveIndex, sUSDToPay) * (ONE + (ONE_PERCENT / 5))) / ONE;
    }

    function buyFromAMMWithReferrer(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        address referrer
    ) public knownRangedMarket(address(rangedMarket)) nonReentrant notPaused {
        if (referrer != address(0)) {
            IReferrals(referrals).setReferrer(referrer, msg.sender);
        }
        _buyFromAMM(rangedMarket, position, amount, expectedPayout, additionalSlippage, true);
    }

    function buyFromAMMWithDifferentCollateralAndReferrer(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        address collateral,
        address _referrer
    ) public nonReentrant notPaused {
        if (_referrer != address(0)) {
            IReferrals(referrals).setReferrer(_referrer, msg.sender);
        }

        int128 curveIndex = _mapCollateralToCurveIndex(collateral);
        require(curveIndex > 0 && curveOnrampEnabled, "unsupported collateral");

        (uint collateralQuote, uint susdQuote) =
            buyFromAmmQuoteWithDifferentCollateral(rangedMarket, position, amount, collateral);

        require((collateralQuote * ONE) / expectedPayout <= (ONE + additionalSlippage), "Slippage too high");

        IERC20Upgradeable collateralToken = IERC20Upgradeable(collateral);
        collateralToken.safeTransferFrom(msg.sender, address(this), collateralQuote);
        curveSUSD.exchange_underlying(curveIndex, 0, collateralQuote, susdQuote);

        _buyFromAMM(rangedMarket, position, amount, susdQuote, additionalSlippage, false);
    }

    function buyFromAMM(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) public knownRangedMarket(address(rangedMarket)) nonReentrant notPaused {
        _buyFromAMM(rangedMarket, position, amount, expectedPayout, additionalSlippage, true);
    }

    function _buyFromAMM(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        bool sendSUSD
    ) internal {
        require(
            position == RangedMarket.Position.Out || amount <= _availableToBuyFromAMMOnlyRangedIN(rangedMarket),
            "Not enough liquidity"
        );

        (uint sUSDPaid, uint leftQuote, uint rightQuote) = buyFromAmmQuoteDetailed(rangedMarket, position, amount);

        uint basePrice = (sUSDPaid * ONE) / amount;
        require(basePrice > minSupportedPrice && basePrice < ONE, "Invalid price");
        require((sUSDPaid * ONE) / expectedPayout <= (ONE + additionalSlippage), "Slippage too high");

        if (sendSUSD) {
            sUSD.safeTransferFrom(msg.sender, address(this), sUSDPaid);
        }

        address target;
        (RangedPosition inp, RangedPosition outp) = rangedMarket.positions();

        if (position == RangedMarket.Position.Out) {
            target = address(outp);
            _buyOUT(rangedMarket, amount, leftQuote, rightQuote, additionalSlippage);
        } else {
            target = address(inp);
            _buyIN(rangedMarket, amount, leftQuote, rightQuote, additionalSlippage);
            _updateSpentOnMarketAndSafeBoxOnBuy(address(rangedMarket), amount, sUSDPaid);
        }

        rangedMarket.mint(amount, position, msg.sender);

        _handleReferrer(msg.sender, sUSDPaid);

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
        // TODO: what if I got 1% less than amount via Thales AMM? set additional slippage to 0 for internal trades
        // apply the same in all places
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

    function availableToSellToAMM(RangedMarket rangedMarket, RangedMarket.Position position)
        public
        view
        knownRangedMarket(address(rangedMarket))
        returns (uint _available)
    {
        uint availableLeft =
            thalesAmm.availableToSellToAMM(
                address(rangedMarket.leftMarket()),
                position == RangedMarket.Position.Out ? IThalesAMM.Position.Down : IThalesAMM.Position.Up
            );
        uint availableRight =
            thalesAmm.availableToSellToAMM(
                address(rangedMarket.rightMarket()),
                position == RangedMarket.Position.Out ? IThalesAMM.Position.Up : IThalesAMM.Position.Down
            );

        _available = availableLeft < availableRight ? availableLeft : availableRight;
        if (position == RangedMarket.Position.In) {
            _available = _available * 2;
        }
    }

    function sellToAmmQuote(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount
    ) public view knownRangedMarket(address(rangedMarket)) returns (uint pricePaid) {
        (pricePaid, , ) = sellToAmmQuoteDetailed(rangedMarket, position, amount);
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
            uint quoteWithFees,
            uint leftQuote,
            uint rightQuote
        )
    {
        amount = position == RangedMarket.Position.Out ? amount : amount / 2;
        leftQuote = thalesAmm.sellToAmmQuote(
            address(rangedMarket.leftMarket()),
            position == RangedMarket.Position.Out ? IThalesAMM.Position.Down : IThalesAMM.Position.Up,
            amount
        );
        rightQuote = thalesAmm.sellToAmmQuote(
            address(rangedMarket.rightMarket()),
            position == RangedMarket.Position.Out ? IThalesAMM.Position.Up : IThalesAMM.Position.Down,
            amount
        );
        uint summedQuotes = leftQuote + rightQuote;
        if (position == RangedMarket.Position.Out) {
            quoteWithFees = (summedQuotes * (ONE - rangedAmmFee)) / ONE;
        } else {
            uint amountTransformed = IPositionalMarketManager(thalesAmm.manager()).transformCollateral(amount);
            if (
                amountTransformed > leftQuote &&
                amountTransformed > rightQuote &&
                summedQuotes > ((amountTransformed - leftQuote) + (amountTransformed - rightQuote))
            ) {
                uint quoteWithoutFees = summedQuotes - ((amountTransformed - leftQuote) + (amountTransformed - rightQuote));
                quoteWithFees = (quoteWithoutFees * (ONE - rangedAmmFee - safeBoxImpact)) / ONE;
            }
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
        require(pricePaid > 0 && (expectedPayout * ONE) / pricePaid <= (ONE + additionalSlippage), "Slippage too high");

        _handleApprovals(rangedMarket);

        if (position == RangedMarket.Position.Out) {
            rangedMarket.burnOut(amount, msg.sender);
        } else {
            rangedMarket.burnIn(amount, msg.sender);
            _updateSpentOnMarketAndSafeBoxOnSell(amount, rangedMarket, pricePaid);
        }

        _handleSellToAmm(rangedMarket, position, amount, additionalSlippage, leftQuote, rightQuote);

        sUSD.safeTransfer(msg.sender, pricePaid);

        _handleReferrer(msg.sender, pricePaid);

        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(msg.sender, pricePaid);
        }

        (RangedPosition inp, RangedPosition outp) = rangedMarket.positions();
        address target = position == RangedMarket.Position.Out ? address(outp) : address(inp);
        emit SoldToAMM(msg.sender, address(rangedMarket), position, amount, pricePaid, address(sUSD), target);
    }

    function _handleSellToAmm(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount,
        uint additionalSlippage,
        uint leftQuote,
        uint rightQuote
    ) internal {
        uint baseAMMAmount = position == RangedMarket.Position.Out ? amount : amount / 2;
        thalesAmm.sellToAMM(
            address(rangedMarket.leftMarket()),
            position == RangedMarket.Position.Out ? IThalesAMM.Position.Down : IThalesAMM.Position.Up,
            baseAMMAmount,
            leftQuote,
            additionalSlippage
        );

        thalesAmm.sellToAMM(
            address(rangedMarket.rightMarket()),
            position == RangedMarket.Position.Out ? IThalesAMM.Position.Up : IThalesAMM.Position.Down,
            baseAMMAmount,
            rightQuote,
            additionalSlippage
        );
    }

    function _handleApprovals(RangedMarket rangedMarket) internal {
        (IPosition up, IPosition down) = IPositionalMarket(rangedMarket.leftMarket()).getOptions();
        (IPosition up1, IPosition down1) = IPositionalMarket(rangedMarket.rightMarket()).getOptions();
        IERC20Upgradeable(address(up)).approve(address(thalesAmm), type(uint256).max);
        IERC20Upgradeable(address(down)).approve(address(thalesAmm), type(uint256).max);
        IERC20Upgradeable(address(up1)).approve(address(thalesAmm), type(uint256).max);
        IERC20Upgradeable(address(down1)).approve(address(thalesAmm), type(uint256).max);
    }

    function _handleReferrer(address buyer, uint sUSDPaid) internal {
        if (referrerFee > 0 && referrals != address(0)) {
            address referrer = IReferrals(referrals).referrals(buyer);
            if (referrer != address(0)) {
                uint referrerShare = (sUSDPaid * (ONE + referrerFee)) / ONE - sUSDPaid;
                sUSD.transfer(referrer, referrerShare);
                emit ReferrerPaid(referrer, buyer, referrerShare, sUSDPaid);
            }
        }
    }

    function _mapCollateralToCurveIndex(address collateral) internal view returns (int128) {
        if (collateral == dai) {
            return 1;
        }
        if (collateral == usdc) {
            return 2;
        }
        if (collateral == usdt) {
            return 3;
        }
        return 0;
    }

    function _updateSpentOnMarketAndSafeBoxOnBuy(
        address rangedMarket,
        uint amount,
        uint sUSDPaid
    ) internal {
        uint safeBoxShare = 0;
        if (safeBoxImpact > 0) {
            safeBoxShare = sUSDPaid - ((sUSDPaid * ONE) / (ONE + safeBoxImpact));
            sUSD.transfer(safeBox, safeBoxShare);
        }

        spentOnMarket[rangedMarket] =
            spentOnMarket[rangedMarket] +
            amount -
            IPositionalMarketManager(thalesAmm.manager()).reverseTransformCollateral(sUSDPaid - safeBoxShare);
    }

    function _updateSpentOnMarketAndSafeBoxOnSell(
        uint amount,
        RangedMarket rangedMarket,
        uint sUSDPaid
    ) internal {
        uint safeBoxShare = 0;

        if (safeBoxImpact > 0) {
            safeBoxShare = ((sUSDPaid * ONE) / (ONE - safeBoxImpact)) - sUSDPaid;
            sUSD.transfer(safeBox, safeBoxShare);
        }

        uint intermediateSum =
            IPositionalMarketManager(thalesAmm.manager()).reverseTransformCollateral(sUSDPaid + safeBoxShare);

        if (amount > (spentOnMarket[address(rangedMarket)] + intermediateSum)) {
            spentOnMarket[address(rangedMarket)] = 0;
        } else {
            spentOnMarket[address(rangedMarket)] = spentOnMarket[address(rangedMarket)] + intermediateSum - amount;
        }
    }

    function transferSusdTo(address receiver, uint amount) external {
        require(_knownMarkets.contains(msg.sender), "Not a known ranged market");
        sUSD.safeTransfer(receiver, amount);
    }

    function retrieveSUSDAmount(address payable account, uint amount) external onlyOwner {
        sUSD.safeTransfer(account, amount);
    }

    function setRangedMarketMastercopies(address _rangedMarketMastercopy, address _rangedPositionMastercopy)
        external
        onlyOwner
    {
        rangedMarketMastercopy = _rangedMarketMastercopy;
        rangedPositionMastercopy = _rangedPositionMastercopy;
    }

    function setMinMaxSupportedPrice(
        uint _minSupportedPrice,
        uint _maxSupportedPrice,
        uint _minDiffBetweenStrikes,
        uint _maxDiffBetweenStrikes
    ) public onlyOwner {
        minSupportedPrice = _minSupportedPrice;
        maxSupportedPrice = _maxSupportedPrice;
        minimalDifBetweenStrikes = _minDiffBetweenStrikes;
        maximalDifBetweenStrikes = _maxDiffBetweenStrikes;
        emit SetMinMaxSupportedPrice(minSupportedPrice, maxSupportedPrice);
        emit SetMinimalMaximalDifBetweenStrikes(minimalDifBetweenStrikes, maximalDifBetweenStrikes);
    }

    function setSafeBoxData(address _safeBox, uint _safeBoxImpact) external onlyOwner {
        safeBoxImpact = _safeBoxImpact;
        safeBox = _safeBox;
        emit SafeBoxChanged(_safeBoxImpact, _safeBox);
    }

    function setCapPerMarketAndRangedAMMFee(uint _capPerMarket, uint _rangedAMMFee) external onlyOwner {
        capPerMarket = _capPerMarket;
        rangedAmmFee = _rangedAMMFee;
        emit SetCapPerMarketAndRangedFee(capPerMarket, rangedAmmFee);
    }

    function setThalesAMMStakingThalesAndReferrals(
        address _thalesAMM,
        IStakingThales _stakingThales,
        address _referrals,
        uint _referrerFee
    ) external onlyOwner {
        thalesAmm = IThalesAMM(_thalesAMM);
        sUSD.approve(address(thalesAmm), type(uint256).max);
        stakingThales = _stakingThales;
        referrals = _referrals;
        referrerFee = _referrerFee;
    }

    function setCurveSUSD(
        address _curveSUSD,
        address _dai,
        address _usdc,
        address _usdt,
        bool _curveOnrampEnabled
    ) external onlyOwner {
        curveSUSD = ICurveSUSD(_curveSUSD);
        dai = _dai;
        usdc = _usdc;
        usdt = _usdt;
        IERC20(dai).approve(_curveSUSD, type(uint256).max);
        IERC20(usdc).approve(_curveSUSD, type(uint256).max);
        IERC20(usdt).approve(_curveSUSD, type(uint256).max);
        // not needed unless selling into different collateral is enabled
        //sUSD.approve(_curveSUSD, type(uint256).max);
        curveOnrampEnabled = _curveOnrampEnabled;
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

    event RangedMarketCreated(address market, address leftMarket, address rightMarket);
    event SafeBoxChanged(uint _safeBoxImpact, address _safeBox);
    event SetMinMaxSupportedPrice(uint minSupportedPrice, uint maxSupportedPrice);
    event SetMinimalMaximalDifBetweenStrikes(uint minSupportedPrice, uint maxSupportedPrice);
    event SetCapPerMarketAndRangedFee(uint capPerMarket, uint rangedAmmFee);
    event ReferrerPaid(address refferer, address trader, uint amount, uint volume);
}

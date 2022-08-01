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
import "../../interfaces/ISportsAMM.sol";

// internal
import "../../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "../../utils/libraries/AddressSetLib.sol";

import "./ParlayPosition.sol";
import "./ParlayMarket.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/IStakingThales.sol";
import "../../interfaces/IReferrals.sol";
import "../../interfaces/ICurveSUSD.sol";

contract ParlayMarketsAMM is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using AddressSetLib for AddressSetLib.AddressSet;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;

    ISportsAMM public sportsAmm;

    uint public parlayAmmFee;

    mapping(address => mapping(address => address)) public createdParlayMarkets;
    AddressSetLib.AddressSet internal _knownMarkets;

    address public parlayMarketMastercopy;
    address public parlayPositionMastercopy;

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
        ISportsAMM _sportsAmm,
        uint _parlayAmmFee,
        uint _capPerMarket,
        IERC20Upgradeable _sUSD,
        address _safeBox,
        uint _safeBoxImpact
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        sportsAmm = _sportsAmm;
        capPerMarket = _capPerMarket;
        parlayAmmFee = _parlayAmmFee;
        sUSD = _sUSD;
        safeBox = _safeBox;
        safeBoxImpact = _safeBoxImpact;

        sUSD.approve(address(sportsAmm), type(uint256).max);
    }

    function createParlayMarket(address[] calldata _sportMarkets) external nonReentrant notPaused {
        require(canCreateParlayMarket(_sportMarkets), "Can't create such a parlay market!");

        // emit ParlayMarketCreated(address(rm), leftMarket, rightMarket);
    }

    function canCreateParlayMarket(address[] calldata _sportMarkets) public view returns (bool canBeCreated) {
        
    }

    function availableToBuyFromAMM(ParlayMarket parlayMarket)
        public
        view
        knownParlayMarket(address(parlayMarket))
        returns (uint)
    {
    }

    function buyFromAmmQuote(
        ParlayMarket parlayMarket,
        uint amount
    ) public view knownParlayMarket(address(parlayMarket)) returns (uint sUSDPaid) {
        
    }

    function buyFromAmmQuoteDetailed(
        ParlayMarket parlayMarket,
        uint amount
    )
        public
        view
        knownParlayMarket(address(parlayMarket))
        returns (
            uint quoteWithFees
            )
    {
    }

    function buyFromAmmQuoteWithDifferentCollateral(
        ParlayMarket parlayMarket,
        uint amount,
        address collateral
    ) public view returns (uint collateralQuote, uint sUSDToPay) {
        int128 curveIndex = _mapCollateralToCurveIndex(collateral);
        if (curveIndex == 0 || !curveOnrampEnabled) {
            return (0, 0);
        }

        sUSDToPay = buyFromAmmQuote(parlayMarket, amount);
        //cant get a quote on how much collateral is needed from curve for sUSD,
        //so rather get how much of collateral you get for the sUSD quote and add 0.2% to that
        collateralQuote = (curveSUSD.get_dy_underlying(0, curveIndex, sUSDToPay) * (ONE + (ONE_PERCENT / 5))) / ONE;
    }

    function buyFromAMMWithReferrer(
        ParlayMarket parlayMarket,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        address referrer
    ) public knownParlayMarket(address(parlayMarket)) nonReentrant notPaused {
        if (referrer != address(0)) {
            IReferrals(referrals).setReferrer(referrer, msg.sender);
        }
        // _buyFromAMM(parlayMarket, amount, expectedPayout, additionalSlippage, true);
    }

    function buyFromAMMWithDifferentCollateralAndReferrer(
        ParlayMarket parlayMarket,
        ParlayPosition position,
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

        // (uint collateralQuote, uint susdQuote) =
        //     buyFromAmmQuoteWithDifferentCollateral(parlayMarket, position, amount, collateral);

        // require((collateralQuote * ONE) / expectedPayout <= (ONE + additionalSlippage), "Slippage too high");

        // IERC20Upgradeable collateralToken = IERC20Upgradeable(collateral);
        // collateralToken.safeTransferFrom(msg.sender, address(this), collateralQuote);
        // curveSUSD.exchange_underlying(curveIndex, 0, collateralQuote, susdQuote);

        // _buyFromAMM(parlayMarket, amount, susdQuote, additionalSlippage, false);
    }

    function buyFromAMM(
        ParlayMarket parlayMarket,
        ParlayPosition position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) public knownParlayMarket(address(parlayMarket)) nonReentrant notPaused {
        _buyFromAMM(parlayMarket, position, amount, expectedPayout, additionalSlippage, true);
    }

    function _buyFromAMM(
        ParlayMarket parlayMarket,
        ParlayPosition position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        bool sendSUSD
    ) internal {
        // require(
        //     position == ParlayMarket.Position.Out || amount <= availableToBuyFromAMM(parlayMarket),
        //     "Not enough liquidity"
        // );

        // (uint sUSDPaid, uint leftQuote, uint rightQuote) = buyFromAmmQuoteDetailed(parlayMarket, amount);

        // uint basePrice = (sUSDPaid * ONE) / amount;
        // require(basePrice > minSupportedPrice && basePrice < ONE, "Invalid price");
        // require((sUSDPaid * ONE) / expectedPayout <= (ONE + additionalSlippage), "Slippage too high");

        // if (sendSUSD) {
        //     sUSD.safeTransferFrom(msg.sender, address(this), sUSDPaid);
        // }

        // address target;
        // (ParlayPosition inp, ParlayPosition outp) = parlayMarket.positions();

        // // buying parlays code here

        // // parlayMarket.mint(amount, position, msg.sender);

        // _handleReferrer(msg.sender, sUSDPaid);

        // if (address(stakingThales) != address(0)) {
        //     stakingThales.updateVolume(msg.sender, sUSDPaid);
        // }

        // emit BoughtFromAmm(msg.sender, address(parlayMarket), position, amount, sUSDPaid, address(sUSD), target);
    }

    function availableToSellToAMM(ParlayMarket parlayMarket)
        public
        view
        knownParlayMarket(address(parlayMarket))
        returns (uint available)
    {
        
    }

    function sellToAmmQuote(
        ParlayMarket parlayMarket,
        uint amount
    ) public view knownParlayMarket(address(parlayMarket)) returns (uint pricePaid) {
        // (pricePaid, , ) = sellToAmmQuoteDetailed(parlayMarket, amount);
    }

    function sellToAmmQuoteDetailed(
        ParlayMarket parlayMarket,
        uint amount
    )
        public
        view
        knownParlayMarket(address(parlayMarket))
        returns (
            uint quoteWithFees
      )
    {
    }

    function sellToAMM(
        ParlayMarket parlayMarket,
        ParlayPosition position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) public knownParlayMarket(address(parlayMarket)) nonReentrant notPaused {
        // uint availableToSellToAMMATM = availableToSellToAMM(parlayMarket);
        // require(availableToSellToAMMATM > 0 && amount <= availableToSellToAMMATM, "Not enough liquidity.");

        // (uint pricePaid, uint leftQuote, uint rightQuote) = sellToAmmQuoteDetailed(parlayMarket, position, amount);
        // require(pricePaid > 0 && (expectedPayout * ONE) / pricePaid <= (ONE + additionalSlippage), "Slippage too high");

        // _handleApprovals(parlayMarket);

        // // Parlay sells

        // _handleSellToAmm(parlayMarket, position, amount, additionalSlippage, leftQuote, rightQuote);

        // sUSD.safeTransfer(msg.sender, pricePaid);

        // _handleReferrer(msg.sender, pricePaid);

        // if (address(stakingThales) != address(0)) {
        //     stakingThales.updateVolume(msg.sender, pricePaid);
        // }

        // (ParlayPosition inp, ParlayPosition outp) = parlayMarket.positions();
        // address target = position == ParlayMarket.Position.Out ? address(outp) : address(inp);
        // emit SoldToAMM(msg.sender, address(parlayMarket), position, amount, pricePaid, address(sUSD), target);
    }

    function _handleSellToAmm(
        ParlayMarket parlayMarket,
        ParlayMarket.Position position,
        uint amount,
        uint additionalSlippage,
        uint leftQuote,
        uint rightQuote
    ) internal {
        // uint baseAMMAmount = position == ParlayMarket.Position.Out ? amount : amount / 2;
        // sportsAmm.sellToAMM(
        //     address(parlayMarket.leftMarket()),
        //     position == ParlayMarket.Position.Out ? ISportsAMM.Position.Down : ISportsAMM.Position.Up,
        //     baseAMMAmount,
        //     leftQuote,
        //     additionalSlippage
        // );

        // sportsAmm.sellToAMM(
        //     address(parlayMarket.rightMarket()),
        //     position == ParlayMarket.Position.Out ? ISportsAMM.Position.Up : ISportsAMM.Position.Down,
        //     baseAMMAmount,
        //     rightQuote,
        //     additionalSlippage
        // );
    }

    function _handleApprovals(ParlayMarket parlayMarket) internal {
        // (IPosition up, IPosition down) = IPositionalMarket(parlayMarket.leftMarket()).getOptions();
        // (IPosition up1, IPosition down1) = IPositionalMarket(parlayMarket.rightMarket()).getOptions();
        // IERC20Upgradeable(address(up)).approve(address(sportsAmm), type(uint256).max);
        // IERC20Upgradeable(address(down)).approve(address(sportsAmm), type(uint256).max);
        // IERC20Upgradeable(address(up1)).approve(address(sportsAmm), type(uint256).max);
        // IERC20Upgradeable(address(down1)).approve(address(sportsAmm), type(uint256).max);
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
        address parlayMarket,
        uint amount,
        uint sUSDPaid
    ) internal {
        uint safeBoxShare = 0;
        if (safeBoxImpact > 0) {
            safeBoxShare = sUSDPaid - ((sUSDPaid * ONE) / (ONE + safeBoxImpact));
            sUSD.transfer(safeBox, safeBoxShare);
        }

        spentOnMarket[parlayMarket] = spentOnMarket[parlayMarket] + amount + safeBoxShare - sUSDPaid;
    }

    function _updateSpentOnMarketAndSafeBoxOnSell(
        uint amount,
        ParlayMarket parlayMarket,
        uint sUSDPaid
    ) internal {
        uint safeBoxShare = 0;

        if (safeBoxImpact > 0) {
            safeBoxShare = ((sUSDPaid * ONE) / (ONE - safeBoxImpact)) - sUSDPaid;
            sUSD.transfer(safeBox, safeBoxShare);
        }

        if (amount > (spentOnMarket[address(parlayMarket)] + sUSDPaid + safeBoxShare)) {
            spentOnMarket[address(parlayMarket)] = 0;
        } else {
            spentOnMarket[address(parlayMarket)] = spentOnMarket[address(parlayMarket)] + sUSDPaid + safeBoxShare - amount;
        }
    }

    function transferSusdTo(address receiver, uint amount) external {
        require(_knownMarkets.contains(msg.sender), "Not a known parlay market");
        sUSD.safeTransfer(receiver, amount);
    }

    function retrieveSUSDAmount(address payable account, uint amount) external onlyOwner {
        sUSD.safeTransfer(account, amount);
    }

    function setParlayMarketMastercopies(address _parlayMarketMastercopy, address _parlayPositionMastercopy)
        external
        onlyOwner
    {
        parlayMarketMastercopy = _parlayMarketMastercopy;
        parlayPositionMastercopy = _parlayPositionMastercopy;
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
        emit SetMinSupportedPrice(minSupportedPrice);
        emit SetMaxSupportedPrice(maxSupportedPrice);
        emit SetMinimalDifBetweenStrikes(minimalDifBetweenStrikes);
        emit SetMaxinalDifBetweenStrikes(maximalDifBetweenStrikes);
    }

    function setSafeBoxData(address _safeBox, uint _safeBoxImpact) external onlyOwner {
        safeBoxImpact = _safeBoxImpact;
        safeBox = _safeBox;
        emit SetSafeBoxImpact(_safeBoxImpact);
        emit SetSafeBox(_safeBox);
    }

    function setCapPerMarketAndParlayAMMFee(uint _capPerMarket, uint _parlayAMMFee) external onlyOwner {
        capPerMarket = _capPerMarket;
        parlayAmmFee = _parlayAMMFee;
        emit SetCapPerMarket(capPerMarket);
        emit SetParlayAmmFee(parlayAmmFee);
    }

    function setThalesAMMStakingThalesAndReferrals(
        address _thalesAMM,
        IStakingThales _stakingThales,
        address _referrals,
        uint _referrerFee
    ) external onlyOwner {
        sportsAmm = ISportsAMM(_thalesAMM);
        sUSD.approve(address(sportsAmm), type(uint256).max);
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

    modifier knownParlayMarket(address market) {
        require(_knownMarkets.contains(market), "Not a known parlay market");
        _;
    }

    event SoldToAMM(
        address seller,
        address market,
        ParlayMarket.Position position,
        uint amount,
        uint sUSDPaid,
        address susd,
        address asset
    );
    event BoughtFromAmm(
        address buyer,
        address market,
        ParlayMarket.Position position,
        uint amount,
        uint sUSDPaid,
        address susd,
        address asset
    );

    event SetSUSD(address sUSD);
    event ParlayMarketCreated(address market, address leftMarket, address rightMarket);
    event SetSafeBoxImpact(uint _safeBoxImpact);
    event SetSafeBox(address _safeBox);
    event SetMinSupportedPrice(uint _spread);
    event SetMaxSupportedPrice(uint _spread);
    event SetMinimalDifBetweenStrikes(uint _spread);
    event SetMaxinalDifBetweenStrikes(uint _spread);
    event SetCapPerMarket(uint capPerMarket);
    event SetParlayAmmFee(uint parlayAmmFee);
    event SetStakingThales(address _stakingThales);
    event ReferrerPaid(address refferer, address trader, uint amount, uint volume);
}

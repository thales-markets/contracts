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
import "../interfaces/IMultiCollateralOnOffRamp.sol";

contract RangedMarketsAMM is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using AddressSetLib for AddressSetLib.AddressSet;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant MAX_APPROVAL = type(uint256).max;

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

    ICurveSUSD public curveSUSD; // deprecated see MultiCollateralOnOffRamp.sol

    address private usdc; // deprecated see MultiCollateralOnOffRamp.sol
    address private usdt; // deprecated see MultiCollateralOnOffRamp.sol
    address private dai; // deprecated see MultiCollateralOnOffRamp.sol
    bool private curveOnrampEnabled; // deprecated see MultiCollateralOnOffRamp.sol
    uint private maxAllowedPegSlippagePercentage; // deprecated see MultiCollateralOnOffRamp.sol

    IMultiCollateralOnOffRamp public multiCollateralOnOffRamp;
    bool public multicollateralEnabled;

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
        _createRangedMarket(leftMarket, rightMarket);
    }

    function createRangedMarkets(address[] calldata leftMarkets, address[] calldata rightMarkets)
        external
        nonReentrant
        notPaused
    {
        require(
            leftMarkets.length > 0 && rightMarkets.length == leftMarkets.length,
            "Both arrays have to be non-empty and same size"
        );
        for (uint i = 0; i < leftMarkets.length; i++) {
            if (canCreateRangedMarket(leftMarkets[i], rightMarkets[i])) {
                _createRangedMarket(leftMarkets[i], rightMarkets[i]);
            }
        }
    }

    function canCreateRangedMarket(address leftMarket, address rightMarket) public view returns (bool toReturn) {
        if (thalesAmm.isMarketInAMMTrading(leftMarket) && thalesAmm.isMarketInAMMTrading(rightMarket)) {
            (uint maturityLeft, ) = IPositionalMarket(leftMarket).times();
            (uint maturityRight, ) = IPositionalMarket(rightMarket).times();
            (bytes32 leftkey, uint leftstrikePrice, ) = IPositionalMarket(leftMarket).getOracleDetails();
            (bytes32 rightkey, uint rightstrikePrice, ) = IPositionalMarket(rightMarket).getOracleDetails();

            if ((leftkey == rightkey) && (leftstrikePrice < rightstrikePrice) && (maturityLeft == maturityRight)) {
                if (!(((ONE + minimalDifBetweenStrikes * ONE_PERCENT) * leftstrikePrice) / ONE < rightstrikePrice)) {
                    toReturn = false;
                } else if (!(((ONE + maximalDifBetweenStrikes * ONE_PERCENT) * leftstrikePrice) / ONE > rightstrikePrice)) {
                    toReturn = false;
                } else {
                    toReturn = createdRangedMarkets[leftMarket][rightMarket] == address(0);
                }
            }
        }
    }

    function availableToBuyFromAMM(RangedMarket rangedMarket, RangedMarket.Position position)
        public
        view
        knownRangedMarket(address(rangedMarket))
        returns (uint)
    {
        uint availableLeft = thalesAmm.availableToBuyFromAMM(
            address(rangedMarket.leftMarket()),
            position == RangedMarket.Position.Out ? IThalesAMM.Position.Down : IThalesAMM.Position.Up
        );
        uint availableRight = thalesAmm.availableToBuyFromAMM(
            address(rangedMarket.rightMarket()),
            position == RangedMarket.Position.Out ? IThalesAMM.Position.Up : IThalesAMM.Position.Down
        );
        return availableLeft < availableRight ? availableLeft : availableRight;
    }

    function buyFromAmmQuote(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount
    ) public view knownRangedMarket(address(rangedMarket)) returns (uint sUSDPaid) {
        (sUSDPaid, , ) = buyFromAmmQuoteDetailed(rangedMarket, position, amount);
        uint basePrice = _transformCollateral((sUSDPaid * ONE) / amount, true);
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
        quoteWithFees = _buyFromAmmQuoteWithLeftAndRightQuote(position, amount, leftQuote, rightQuote);
    }

    function buyFromAmmQuoteWithDifferentCollateral(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount,
        address collateral
    ) public view returns (uint collateralQuote, uint sUSDToPay) {
        sUSDToPay = buyFromAmmQuote(rangedMarket, position, amount);
        collateralQuote = multiCollateralOnOffRamp.getMinimumNeeded(collateral, sUSDToPay);
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
        RangedMarket _rangedMarket,
        RangedMarket.Position _position,
        uint _amount,
        uint _expectedPayout,
        uint _additionalSlippage,
        address _collateral,
        address _referrer
    ) external nonReentrant notPaused {
        _buyFromAMMWithDifferentCollateralAndReferrer(
            _rangedMarket,
            _position,
            _amount,
            _expectedPayout,
            _additionalSlippage,
            _collateral,
            _referrer,
            false
        );
    }

    function buyFromAMMWithEth(
        RangedMarket _rangedMarket,
        RangedMarket.Position _position,
        uint _amount,
        uint _expectedPayout,
        uint _additionalSlippage,
        address _collateral,
        address _referrer
    ) external payable nonReentrant notPaused {
        _buyFromAMMWithDifferentCollateralAndReferrer(
            _rangedMarket,
            _position,
            _amount,
            _expectedPayout,
            _additionalSlippage,
            _collateral,
            _referrer,
            true
        );
    }

    function _buyFromAMMWithDifferentCollateralAndReferrer(
        RangedMarket _rangedMarket,
        RangedMarket.Position _position,
        uint _amount,
        uint _expectedPayout,
        uint _additionalSlippage,
        address _collateral,
        address _referrer,
        bool _isEth
    ) internal {
        require(multicollateralEnabled, "Multicollateral onramp not enabled");
        if (_referrer != address(0)) {
            IReferrals(referrals).setReferrer(_referrer, msg.sender);
        }

        (uint collateralQuote, uint susdQuote) = buyFromAmmQuoteWithDifferentCollateral(
            _rangedMarket,
            _position,
            _amount,
            _collateral
        );

        require((collateralQuote * ONE) / _expectedPayout <= (ONE + _additionalSlippage), "Slippage too high!");

        uint exactReceived;

        if (_isEth) {
            require(_collateral == multiCollateralOnOffRamp.WETH9(), "Wrong collateral sent");
            require(msg.value >= collateralQuote, "not enough ETH sent");
            exactReceived = multiCollateralOnOffRamp.onrampWithEth{value: msg.value}(msg.value);
        } else {
            IERC20Upgradeable(_collateral).safeTransferFrom(msg.sender, address(this), collateralQuote);
            IERC20Upgradeable(_collateral).approve(address(multiCollateralOnOffRamp), collateralQuote);
            exactReceived = multiCollateralOnOffRamp.onramp(_collateral, collateralQuote);
        }

        require(exactReceived >= susdQuote, "Not enough sUSD received");

        //send the surplus to SB
        if (exactReceived > susdQuote) {
            sUSD.safeTransfer(safeBox, exactReceived - susdQuote);
        }

        _buyFromAMM(_rangedMarket, _position, _amount, susdQuote, _additionalSlippage, false);
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

    function _buyFromAmmQuoteWithLeftAndRightQuote(
        RangedMarket.Position position,
        uint amount,
        uint leftQuote,
        uint rightQuote
    ) internal view returns (uint quoteWithFees) {
        if (leftQuote > 0 && rightQuote > 0) {
            uint summedQuotes = leftQuote + rightQuote;
            if (position == RangedMarket.Position.Out) {
                quoteWithFees = (summedQuotes * (rangedAmmFee + ONE)) / ONE;
            } else {
                if (
                    summedQuotes >
                    ((_transformCollateral(amount, false) - leftQuote) + (_transformCollateral(amount, false) - rightQuote))
                ) {
                    uint quoteWithoutFees = summedQuotes -
                        (_transformCollateral(amount, false) - leftQuote) -
                        (_transformCollateral(amount, false) - rightQuote);
                    quoteWithFees = (quoteWithoutFees * (rangedAmmFee + safeBoxImpact + ONE)) / ONE;
                }
            }
        }
    }

    function _buyFromAMM(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        bool sendSUSD
    ) internal {
        require(availableToBuyFromAMM(rangedMarket, position) >= amount, "ID4");

        uint sUSDPaid;
        address target;
        (RangedPosition inp, RangedPosition outp) = rangedMarket.positions();

        if (position == RangedMarket.Position.Out) {
            target = address(outp);
            sUSDPaid = _buyOUT(rangedMarket, amount);
        } else {
            target = address(inp);
            sUSDPaid = _buyIN(rangedMarket, amount);
            _handleSafeBoxFeeOnBuy(address(rangedMarket), amount, sUSDPaid);
        }

        uint basePrice = _transformCollateral((sUSDPaid * ONE) / amount, true);
        require(basePrice > minSupportedPrice && basePrice < ONE, "ID5");
        require(sUSDPaid > 0 && ((sUSDPaid * ONE) / expectedPayout <= (ONE + additionalSlippage)), "ID2");

        if (sendSUSD) {
            sUSD.safeTransferFrom(msg.sender, address(this), sUSDPaid);
        }

        rangedMarket.mint(amount, position, msg.sender);

        _handleReferrer(msg.sender, sUSDPaid);

        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(msg.sender, sUSDPaid);
        }

        emit BoughtFromAmm(msg.sender, address(rangedMarket), position, amount, sUSDPaid, address(sUSD), target);

        (bytes32 leftkey, uint leftstrikePrice, ) = IPositionalMarket(rangedMarket.leftMarket()).getOracleDetails();
        (, uint rightstrikePrice, ) = IPositionalMarket(rangedMarket.rightMarket()).getOracleDetails();
        uint currentAssetPrice = thalesAmm.priceFeed().rateForCurrency(leftkey);
        bool inTheMoney = position == RangedMarket.Position.In
            ? currentAssetPrice >= leftstrikePrice && currentAssetPrice < rightstrikePrice
            : currentAssetPrice < leftstrikePrice || currentAssetPrice >= rightstrikePrice;
        emit BoughtOptionType(msg.sender, sUSDPaid, inTheMoney);
    }

    function _buyOUT(RangedMarket rangedMarket, uint amount) internal returns (uint) {
        uint paidLeft = thalesAmm.buyFromAMM(
            address(rangedMarket.leftMarket()),
            IThalesAMM.Position.Down,
            amount,
            type(uint256).max,
            0
        );

        uint paidRight = thalesAmm.buyFromAMM(
            address(rangedMarket.rightMarket()),
            IThalesAMM.Position.Up,
            amount,
            type(uint256).max,
            0
        );
        (, IPosition down) = IPositionalMarket(rangedMarket.leftMarket()).getOptions();
        IERC20Upgradeable(address(down)).safeTransfer(address(rangedMarket), amount);

        (IPosition up1, ) = IPositionalMarket(rangedMarket.rightMarket()).getOptions();
        IERC20Upgradeable(address(up1)).safeTransfer(address(rangedMarket), amount);
        return _buyFromAmmQuoteWithLeftAndRightQuote(RangedMarket.Position.Out, amount, paidLeft, paidRight);
    }

    function _buyIN(RangedMarket rangedMarket, uint amount) internal returns (uint) {
        uint paidLeft = thalesAmm.buyFromAMM(
            address(rangedMarket.leftMarket()),
            IThalesAMM.Position.Up,
            amount / 2,
            type(uint256).max,
            0
        );

        uint paidRight = thalesAmm.buyFromAMM(
            address(rangedMarket.rightMarket()),
            IThalesAMM.Position.Down,
            amount / 2,
            type(uint256).max,
            0
        );
        (IPosition up, ) = IPositionalMarket(rangedMarket.leftMarket()).getOptions();
        IERC20Upgradeable(address(up)).safeTransfer(address(rangedMarket), amount / 2);

        (, IPosition down1) = IPositionalMarket(rangedMarket.rightMarket()).getOptions();
        IERC20Upgradeable(address(down1)).safeTransfer(address(rangedMarket), amount / 2);

        return _buyFromAmmQuoteWithLeftAndRightQuote(RangedMarket.Position.In, amount / 2, paidLeft, paidRight);
    }

    function availableToSellToAMM(RangedMarket rangedMarket, RangedMarket.Position position)
        public
        view
        knownRangedMarket(address(rangedMarket))
        returns (uint _available)
    {
        uint availableLeft = thalesAmm.availableToSellToAMM(
            address(rangedMarket.leftMarket()),
            position == RangedMarket.Position.Out ? IThalesAMM.Position.Down : IThalesAMM.Position.Up
        );
        uint availableRight = thalesAmm.availableToSellToAMM(
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
        quoteWithFees = _sellToAmmQuoteDetailedWithLeftAndRightQuotes(position, amount, leftQuote, rightQuote);
    }

    /// @notice sell positions of the defined type of a given market to the RANGED AMM
    /// @param _rangedMarket a Ranged Market known to Market Manager
    /// @param _position IN or OUT
    /// @param _amount how many positions
    /// @param _expectedPayout how much does the seller to receive(retrieved via quote)
    /// @param _additionalSlippage how much of a slippage on the sUSD expectedPayout will the seller accept
    function sellToAMM(
        RangedMarket _rangedMarket,
        RangedMarket.Position _position,
        uint _amount,
        uint _expectedPayout,
        uint _additionalSlippage
    ) public knownRangedMarket(address(rangedMarket)) nonReentrant notPaused returns (uint) {
        return _sellToAMM(_rangedMarket, _position, _amount, _expectedPayout, _additionalSlippage);
    }

    /// @notice sell positions of the defined type of a given market to the RANGED AMM
    /// @param _rangedMarket a Ranged Market known to Market Manager
    /// @param _position IN or OUT
    /// @param _amount how many positions
    /// @param _expectedPayout how much does the seller to receive(retrieved via quote)
    /// @param _additionalSlippage how much of a slippage on the sUSD expectedPayout will the seller accept
    /// @param _collateral address of collateral to offramp into and send to user
    /// @param _isEth flag that indicated should the offramp be performed in ETH
    function sellToAMMWithDifferentCollateral(
        RangedMarket _rangedMarket,
        RangedMarket.Position _position,
        uint _amount,
        uint _expectedPayout,
        uint _additionalSlippage,
        address _collateral,
        bool _isEth
    ) public knownRangedMarket(address(_rangedMarket)) nonReentrant notPaused returns (uint) {
        uint pricePaid = _sellToAMM(_rangedMarket, _position, _amount, _expectedPayout, _additionalSlippage);
        sUSD.safeTransferFrom(msg.sender, address(this), pricePaid);

        if (_isEth) {
            uint offramped = multiCollateralOnOffRamp.offrampIntoEth(pricePaid);
            address payable _to = payable(msg.sender);
            bool sent = _to.send(offramped);
            require(sent, "Failed to send Ether");
        } else {
            uint offramped = multiCollateralOnOffRamp.offramp(_collateral, pricePaid);
            IERC20Upgradeable(_collateral).safeTransfer(msg.sender, offramped);
        }
    }

    function _sellToAMM(
        RangedMarket _rangedMarket,
        RangedMarket.Position _position,
        uint _amount,
        uint _expectedPayout,
        uint _additionalSlippage
    ) internal knownRangedMarket(address(rangedMarket)) nonReentrant notPaused returns (uint) {
        uint pricePaid;

        _handleApprovals(_rangedMarket);

        if (position == RangedMarket.Position.Out) {
            _rangedMarket.burnOut(_amount, msg.sender);
        } else {
            _rangedMarket.burnIn(_amount, msg.sender);
        }

        pricePaid = _handleSellToAmm(_rangedMarket, position, _amount);
        require(pricePaid > 0 && (_expectedPayout * ONE) / pricePaid <= (ONE + _additionalSlippage), "ID2");

        if (_position == RangedMarket.Position.In) {
            _handleSafeBoxFeeOnSell(_amount, _rangedMarket, pricePaid);
        }

        sUSD.safeTransfer(msg.sender, pricePaid);

        _handleReferrer(msg.sender, pricePaid);

        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(msg.sender, pricePaid);
        }

        (RangedPosition inp, RangedPosition outp) = _rangedMarket.positions();
        address target = _position == RangedMarket.Position.Out ? address(outp) : address(inp);
        emit SoldToAMM(msg.sender, address(_rangedMarket), _position, _amount, pricePaid, address(sUSD), target);
        return pricePaid;
    }

    /// @notice resolveRangedMarketsBatch resolve all markets in the batch
    /// @param markets the batch
    function resolveRangedMarketsBatch(address[] calldata markets) external {
        for (uint i = 0; i < markets.length; i++) {
            address market = markets[i];
            if (_knownMarkets.contains(market) && !RangedMarket(market).resolved()) {
                RangedMarket(market).resolveMarket();
            }
        }
    }

    function getPriceImpact(RangedMarket rangedMarket, RangedMarket.Position position) external view returns (int _impact) {
        int buyPriceImpactLeft = thalesAmm.buyPriceImpact(
            address(rangedMarket.leftMarket()),
            position == RangedMarket.Position.Out ? IThalesAMM.Position.Down : IThalesAMM.Position.Up,
            ONE
        );
        int buyPriceImpactRight = thalesAmm.buyPriceImpact(
            address(rangedMarket.rightMarket()),
            position == RangedMarket.Position.Out ? IThalesAMM.Position.Up : IThalesAMM.Position.Down,
            ONE
        );

        _impact = buyPriceImpactLeft + buyPriceImpactRight;
        if (position == RangedMarket.Position.Out) {
            _impact = _impact / 2;
        }
    }

    function _sellToAmmQuoteDetailedWithLeftAndRightQuotes(
        RangedMarket.Position position,
        uint amount,
        uint leftQuote,
        uint rightQuote
    ) internal view returns (uint quoteWithFees) {
        if (leftQuote > 0 && rightQuote > 0) {
            uint summedQuotes = leftQuote + rightQuote;
            if (position == RangedMarket.Position.Out) {
                quoteWithFees = (summedQuotes * (ONE - rangedAmmFee)) / ONE;
            } else {
                uint amountTransformed = _transformCollateral(amount, false);
                if (
                    amountTransformed > leftQuote &&
                    amountTransformed > rightQuote &&
                    summedQuotes > ((amountTransformed - leftQuote) + (amountTransformed - rightQuote))
                ) {
                    uint quoteWithoutFees = summedQuotes -
                        ((amountTransformed - leftQuote) + (amountTransformed - rightQuote));
                    quoteWithFees = (quoteWithoutFees * (ONE - rangedAmmFee - safeBoxImpact)) / ONE;
                }
            }
        }
    }

    function _handleSellToAmm(
        RangedMarket rangedMarket,
        RangedMarket.Position position,
        uint amount
    ) internal returns (uint) {
        uint baseAMMAmount = position == RangedMarket.Position.Out ? amount : amount / 2;
        uint sellLeft = thalesAmm.sellToAMM(
            address(rangedMarket.leftMarket()),
            position == RangedMarket.Position.Out ? IThalesAMM.Position.Down : IThalesAMM.Position.Up,
            baseAMMAmount,
            0,
            0
        );

        uint sellRight = thalesAmm.sellToAMM(
            address(rangedMarket.rightMarket()),
            position == RangedMarket.Position.Out ? IThalesAMM.Position.Up : IThalesAMM.Position.Down,
            baseAMMAmount,
            0,
            0
        );

        return _sellToAmmQuoteDetailedWithLeftAndRightQuotes(position, baseAMMAmount, sellLeft, sellRight);
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

    function _handleSafeBoxFeeOnBuy(
        address rangedMarket,
        uint amount,
        uint sUSDPaid
    ) internal {
        uint safeBoxShare;
        if (safeBoxImpact > 0) {
            safeBoxShare = sUSDPaid - ((sUSDPaid * ONE) / (ONE + safeBoxImpact));
            sUSD.transfer(safeBox, safeBoxShare);
        }
    }

    function _handleSafeBoxFeeOnSell(
        uint amount,
        RangedMarket rangedMarket,
        uint sUSDPaid
    ) internal {
        uint safeBoxShare = 0;

        if (safeBoxImpact > 0) {
            safeBoxShare = ((sUSDPaid * ONE) / (ONE - safeBoxImpact)) - sUSDPaid;
            sUSD.transfer(safeBox, safeBoxShare);
        }
    }

    function _createRangedMarket(address leftMarket, address rightMarket) internal {
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

    function _transformCollateral(uint collateral, bool reverse) internal view returns (uint transformed) {
        transformed = reverse
            ? IPositionalMarketManager(thalesAmm.manager()).reverseTransformCollateral(collateral)
            : IPositionalMarketManager(thalesAmm.manager()).transformCollateral(collateral);
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

    function setSafeBoxDataAndRangedAMMFee(
        address _safeBox,
        uint _safeBoxImpact,
        uint _rangedAMMFee
    ) external onlyOwner {
        safeBoxImpact = _safeBoxImpact;
        safeBox = _safeBox;
        emit SafeBoxChanged(_safeBoxImpact, _safeBox);
        rangedAmmFee = _rangedAMMFee;
        emit SetRangedFee(rangedAmmFee);
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

    /// @notice set multicollateral onramp contract
    function setMultiCollateralOnOffRamp(address _onramper, bool enabled) external onlyOwner {
        if (address(multiCollateralOnOffRamp) != address(0)) {
            sUSD.approve(address(multiCollateralOnOffRamp), 0);
        }
        multiCollateralOnOffRamp = IMultiCollateralOnOffRamp(_onramper);
        multicollateralEnabled = enabled;
        sUSD.approve(_onramper, MAX_APPROVAL);
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
    event BoughtOptionType(address buyer, uint sUSDPaid, bool inTheMoney);

    event RangedMarketCreated(address market, address leftMarket, address rightMarket);
    event SafeBoxChanged(uint _safeBoxImpact, address _safeBox);
    event SetMinMaxSupportedPrice(uint minSupportedPrice, uint maxSupportedPrice);
    event SetMinimalMaximalDifBetweenStrikes(uint minSupportedPrice, uint maxSupportedPrice);
    event SetRangedFee(uint rangedAmmFee);
    event ReferrerPaid(address refferer, address trader, uint amount, uint volume);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-4.4.1/proxy/Clones.sol";

// interfaces
import "../../interfaces/ISportsAMM.sol";

// internal
import "../../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "../../utils/libraries/AddressSetLib.sol";

import "./ParlayMarket.sol";
import "../../interfaces/IParlayMarketData.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/ISportPositionalMarketManager.sol";
import "../../interfaces/IStakingThales.sol";
import "../../interfaces/IReferrals.sol";
import "../../interfaces/ICurveSUSD.sol";

// import "hardhat/console.sol";

contract ParlayMarketsAMM is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using SafeMathUpgradeable for uint;
    using AddressSetLib for AddressSetLib.AddressSet;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant DEFAULT_PARLAY_SIZE = 4;
    uint private constant MAX_APPROVAL = type(uint256).max;

    ISportsAMM public sportsAmm;
    ISportPositionalMarketManager public sportManager;
    IERC20Upgradeable public sUSD;
    IStakingThales public stakingThales;
    ICurveSUSD public curveSUSD;

    address public parlayMarketMastercopy;
    address public parlayMarketData;
    address public safeBox;
    address public referrals;
    address public usdc;
    address public usdt;
    address public dai;

    uint public parlayAmmFee;
    uint public parlaySize;
    // IMPORTANT: AMM risks only half or the payout effectively, but it risks the whole amount on price movements
    uint public maxSupportedAmount;
    uint public maxSupportedOdds;
    uint public safeBoxImpact;
    uint public referrerFee;

    bool public curveOnrampEnabled;
    bool public reducedFeesEnabled;

    AddressSetLib.AddressSet internal _knownMarkets;
    mapping(address => bool) public resolvedParlay;
    uint maxAllowedPegSlippagePercentage;

    function initialize(
        address _owner,
        ISportsAMM _sportsAmm,
        ISportPositionalMarketManager _sportManager,
        uint _parlayAmmFee,
        uint _maxSupportedAmount,
        uint _maxSupportedOdds,
        IERC20Upgradeable _sUSD,
        address _safeBox,
        uint _safeBoxImpact
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        sportsAmm = _sportsAmm;
        sportManager = _sportManager;
        maxSupportedAmount = _maxSupportedAmount;
        maxSupportedOdds = _maxSupportedOdds;
        parlayAmmFee = _parlayAmmFee;
        sUSD = _sUSD;
        safeBox = _safeBox;
        safeBoxImpact = _safeBoxImpact;
        parlaySize = DEFAULT_PARLAY_SIZE;
        sUSD.approve(address(sportsAmm), type(uint256).max);
    }

    /* ========== VIEW FUNCTIONS ========== */

    function isActiveParlay(address _parlayMarket) external view returns (bool isActiveParlayMarket) {
        isActiveParlayMarket = _knownMarkets.contains(_parlayMarket);
    }

    function activeParlayMarkets(uint index, uint pageSize) external view returns (address[] memory) {
        return _knownMarkets.getPage(index, pageSize);
    }

    function buyQuoteFromParlay(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDPaid
    )
        external
        view
        returns (
            uint sUSDAfterFees,
            uint totalBuyAmount,
            uint totalQuote,
            uint initialQuote,
            uint skewImpact,
            uint[] memory finalQuotes,
            uint[] memory amountsToBuy
        )
    {
        (
            sUSDAfterFees,
            totalBuyAmount,
            totalQuote,
            initialQuote,
            skewImpact,
            finalQuotes,
            amountsToBuy
        ) = _buyQuoteFromParlay(_sportMarkets, _positions, _sUSDPaid);
    }

    function buyQuoteFromParlayWithDifferentCollateral(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDPaid,
        address _collateral
    )
        external
        view
        returns (
            uint collateralQuote,
            uint sUSDAfterFees,
            uint totalBuyAmount,
            uint totalQuote
        )
    {
        int128 curveIndex = _mapCollateralToCurveIndex(_collateral);
        if (curveIndex == 0 || !curveOnrampEnabled) {
            return (collateralQuote, sUSDAfterFees, totalBuyAmount, totalQuote);
        }

        (sUSDAfterFees, totalBuyAmount, totalQuote, , , , ) = _buyQuoteFromParlay(_sportMarkets, _positions, _sUSDPaid);
        //cant get a quote on how much collateral is needed from curve for sUSD,
        //so rather get how much of collateral you get for the sUSD quote and add 0.2% to that
        collateralQuote = curveSUSD.get_dy_underlying(0, curveIndex, _sUSDPaid).mul(ONE.add(ONE_PERCENT.div(5))).div(ONE);
    }

    function canCreateParlayMarket(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDToPay
    ) external view returns (bool canBeCreated) {
        (, uint totalBuyAmount, uint totalQuote, , , , ) = _buyQuoteFromParlay(_sportMarkets, _positions, _sUSDToPay);
        canBeCreated = totalQuote > maxSupportedOdds && totalBuyAmount <= maxSupportedAmount;
    }

    function exercisableSportPositionsInParlay(address _parlayMarket)
        external
        view
        returns (bool isExercisable, address[] memory exercisableMarkets)
    {
        if (_knownMarkets.contains(_parlayMarket)) {
            (isExercisable, exercisableMarkets) = ParlayMarket(_parlayMarket).isAnySportMarketExercisable();
        }
    }

    function resolvableSportPositionsInParlay(address _parlayMarket)
        external
        view
        returns (bool isAnyResolvable, address[] memory resolvableMarkets)
    {
        if (_knownMarkets.contains(_parlayMarket)) {
            (isAnyResolvable, resolvableMarkets) = ParlayMarket(_parlayMarket).isAnySportMarketResolved();
        }
    }

    /* ========== EXTERNAL FUNCTIONS ========== */

    function buyFromParlay(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDPaid,
        uint _additionalSlippage,
        uint _expectedPayout
    ) external nonReentrant notPaused {
        _buyFromParlay(_sportMarkets, _positions, _sUSDPaid, _additionalSlippage, _expectedPayout, true);
    }

    function buyFromParlayWithDifferentCollateralAndReferrer(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDPaid,
        uint _additionalSlippage,
        uint _expectedPayout,
        address collateral,
        address _referrer
    ) external nonReentrant notPaused {
        if (_referrer != address(0)) {
            IReferrals(referrals).setReferrer(_referrer, msg.sender);
        }
        int128 curveIndex = _mapCollateralToCurveIndex(collateral);
        require(curveIndex > 0 && curveOnrampEnabled, "unsupported collateral");

        //cant get a quote on how much collateral is needed from curve for sUSD,
        //so rather get how much of collateral you get for the sUSD quote and add 0.2% to that
        uint collateralQuote = curveSUSD.get_dy_underlying(0, curveIndex, _sUSDPaid).mul(ONE.add(ONE_PERCENT.div(5))).div(
            ONE
        );

        uint transformedCollateralForPegCheck = collateral == usdc || collateral == usdt
            ? collateralQuote.mul(1e12)
            : collateralQuote;
        require(
            maxAllowedPegSlippagePercentage > 0 &&
                transformedCollateralForPegCheck >= _sUSDPaid.mul(ONE.sub(maxAllowedPegSlippagePercentage)).div(ONE),
            "Amount below max allowed peg slippage"
        );

        require(collateralQuote.mul(ONE).div(_sUSDPaid) <= ONE.add(_additionalSlippage), "Slippage too high!");

        IERC20Upgradeable collateralToken = IERC20Upgradeable(collateral);
        collateralToken.safeTransferFrom(msg.sender, address(this), collateralQuote);
        curveSUSD.exchange_underlying(curveIndex, 0, collateralQuote, _sUSDPaid);

        _buyFromParlay(_sportMarkets, _positions, _sUSDPaid, _additionalSlippage, _expectedPayout, false);
    }

    function exerciseParlay(address _parlayMarket) external nonReentrant notPaused {
        require(_knownMarkets.contains(_parlayMarket), "Unknown/Expired parlay");
        ParlayMarket parlayMarket = ParlayMarket(_parlayMarket);
        parlayMarket.exerciseWiningSportMarkets();
    }

    function exerciseSportMarketInParlay(address _parlayMarket, address _sportMarket) external nonReentrant notPaused {
        require(_knownMarkets.contains(_parlayMarket), "Unknown/Expired parlay");
        ParlayMarket parlayMarket = ParlayMarket(_parlayMarket);
        parlayMarket.exerciseSpecificSportMarket(_sportMarket);
    }

    function resolveParlay() external notPaused {
        require(_knownMarkets.contains(msg.sender), "Unknown/Expired parlay");
        _resolveParlay(msg.sender);
    }

    function expireMarkets(address[] calldata _parlayMarkets) external onlyOwner {
        for (uint i = 0; i < _parlayMarkets.length; i++) {
            if (ParlayMarket(_parlayMarkets[i]).phase() == ParlayMarket.Phase.Expiry) {
                ParlayMarket(_parlayMarkets[i]).expire(payable(safeBox));
            }
        }
    }

    function setPausedMarkets(address[] calldata _parlayMarkets, bool _paused) external onlyOwner {
        for (uint i = 0; i < _parlayMarkets.length; i++) {
            ParlayMarket(_parlayMarkets[i]).setPaused(_paused);
        }
    }

    function triggerResolvedEvent(address _account, bool _userWon) external {
        require(_knownMarkets.contains(msg.sender), "Not valid Parlay");
        emit ParlayResolved(_account, _userWon);
    }

    function transferRestOfSUSDAmount(
        address receiver,
        uint amount,
        bool dueToCancellation
    ) external nonReentrant notPaused {
        require(_knownMarkets.contains(msg.sender), "Not a known parlay market");
        if (dueToCancellation) {
            emit ExtraAmountTransferredDueToCancellation(receiver, amount);
        }
        sUSD.safeTransfer(receiver, amount);
    }

    function transferSusdTo(address receiver, uint amount) external nonReentrant notPaused {
        require(_knownMarkets.contains(msg.sender), "Not a known parlay market");
        sUSD.safeTransfer(receiver, amount);
    }

    function retrieveSUSDAmount(address payable account, uint amount) external onlyOwner {
        sUSD.safeTransfer(account, amount);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function _buyFromParlay(
        address[] memory _sportMarkets,
        uint[] memory _positions,
        uint _sUSDPaid,
        uint _additionalSlippage,
        uint _expectedPayout,
        bool _sendSUSD
    ) internal {
        uint totalAmount;
        uint initialQuote;
        uint totalQuote;
        uint[] memory amountsToBuy = new uint[](_sportMarkets.length);
        uint[] memory marketQuotes = new uint[](_sportMarkets.length);
        uint sUSDAfterFees;
        uint skewImpact;
        (sUSDAfterFees, totalAmount, totalQuote, initialQuote, skewImpact, marketQuotes, amountsToBuy) = _buyQuoteFromParlay(
            _sportMarkets,
            _positions,
            _sUSDPaid
        );

        // apply all checks
        require(totalQuote > maxSupportedOdds, "Can't create this parlay market!");
        require(totalAmount <= maxSupportedAmount, "Amount exceeds MaxSupportedAmount");
        require(
            ((ONE * sUSDAfterFees) / totalQuote) <= (((ONE + _additionalSlippage) * _expectedPayout) / ONE),
            "Slippage too high"
        );

        if (_sendSUSD) {
            sUSD.safeTransferFrom(msg.sender, address(this), sUSDAfterFees);
            sUSD.safeTransferFrom(msg.sender, safeBox, _sUSDPaid.sub(sUSDAfterFees));
        } else {
            sUSD.safeTransfer(safeBox, _sUSDPaid.sub(sUSDAfterFees));
        }

        // mint the stateful token  (ERC-20)
        // clone a parlay market
        ParlayMarket parlayMarket = ParlayMarket(Clones.clone(parlayMarketMastercopy));
        parlayMarket.initialize(
            _sportMarkets,
            _positions,
            totalAmount,
            sUSDAfterFees,
            sportManager.getExpiryDuration(),
            address(this),
            msg.sender
        );

        emit NewParlayMarket(address(parlayMarket), _sportMarkets, _positions, totalAmount, sUSDAfterFees);

        _knownMarkets.add(address(parlayMarket));
        parlayMarket.updateQuotes(marketQuotes, totalQuote);

        // buy the positions
        _buyPositionsFromSportAMM(_sportMarkets, _positions, amountsToBuy, _additionalSlippage, address(parlayMarket));
        emit ParlayMarketCreated(
            address(parlayMarket),
            msg.sender,
            totalAmount,
            _sUSDPaid,
            sUSDAfterFees,
            totalQuote,
            initialQuote,
            skewImpact
        );
    }

    function _buyQuoteFromParlay(
        address[] memory _sportMarkets,
        uint[] memory _positions,
        uint _sUSDPaid
    )
        internal
        view
        returns (
            uint sUSDAfterFees,
            uint totalBuyAmount,
            uint totalQuote,
            uint initialQuote,
            uint skewImpact,
            uint[] memory finalQuotes,
            uint[] memory amountsToBuy
        )
    {
        uint sumQuotes;
        uint[] memory marketQuotes;
        uint[] memory inverseQuotes;
        uint inverseSum;
        sUSDAfterFees = ((ONE - ((safeBoxImpact + parlayAmmFee) * ONE_PERCENT)) * _sUSDPaid) / ONE;
        (initialQuote, sumQuotes, inverseSum, marketQuotes, inverseQuotes, ) = _calculateInitialQuotesForParlay(
            _sportMarkets,
            _positions,
            sUSDAfterFees
        );
        if (initialQuote > 0) {
            (totalBuyAmount, amountsToBuy) = _calculateBuyQuoteAmounts(
                initialQuote,
                sumQuotes,
                inverseSum,
                sUSDAfterFees,
                inverseQuotes
            );
            (totalQuote, totalBuyAmount, finalQuotes, ) = _calculateFinalQuotes(_sportMarkets, _positions, amountsToBuy);
            if (totalQuote > 0) {
                uint expectedPayout = ((sUSDAfterFees * ONE * ONE) / totalQuote) / ONE;
                skewImpact = expectedPayout > totalBuyAmount
                    ? (((ONE * expectedPayout) - (ONE * totalBuyAmount)) / (totalBuyAmount))
                    : (((ONE * totalBuyAmount) - (ONE * expectedPayout)) / (totalBuyAmount));
                amountsToBuy = _applySkewImpactBatch(amountsToBuy, skewImpact, (expectedPayout > totalBuyAmount));
                totalBuyAmount = _applySkewImpact(totalBuyAmount, skewImpact, (expectedPayout > totalBuyAmount));
            }
        }
    }

    function _applySkewImpact(
        uint _value,
        uint _skewImpact,
        bool _addition
    ) internal pure returns (uint newValue) {
        newValue = _addition ? (((ONE + _skewImpact) * _value) / ONE) : (((ONE - _skewImpact) * _value) / ONE);
    }

    function _applySkewImpactBatch(
        uint[] memory _values,
        uint _skewImpact,
        bool _addition
    ) internal pure returns (uint[] memory newValues) {
        uint totalAmount;
        newValues = new uint[](_values.length);
        for (uint i = 0; i < _values.length; i++) {
            newValues[i] = _applySkewImpact(_values[i], _skewImpact, _addition);
            totalAmount += newValues[i];
        }
    }

    function _calculateFinalQuotes(
        address[] memory _sportMarkets,
        uint[] memory _positions,
        uint[] memory _buyQuoteAmounts
    )
        internal
        view
        returns (
            uint totalQuote,
            uint totalBuyAmount,
            uint[] memory finalQuotes,
            uint[] memory buyAmountPerMarket
        )
    {
        buyAmountPerMarket = new uint[](_sportMarkets.length);
        finalQuotes = new uint[](_sportMarkets.length);
        for (uint i = 0; i < _sportMarkets.length; i++) {
            totalBuyAmount += _buyQuoteAmounts[i];
            if (reducedFeesEnabled) {
                buyAmountPerMarket[i] = sportsAmm.buyFromAmmQuoteForParlayAMM(
                    _sportMarkets[i],
                    _obtainSportsAMMPosition(_positions[i]),
                    _buyQuoteAmounts[i]
                );
            } else {
                buyAmountPerMarket[i] = sportsAmm.buyFromAmmQuote(
                    _sportMarkets[i],
                    _obtainSportsAMMPosition(_positions[i]),
                    _buyQuoteAmounts[i]
                );
            }
            if (buyAmountPerMarket[i] == 0) {
                totalQuote = 0;
                totalBuyAmount = 0;
                break;
            }
        }
        for (uint i = 0; i < _sportMarkets.length; i++) {
            finalQuotes[i] = ((buyAmountPerMarket[i] * ONE * ONE) / _buyQuoteAmounts[i]) / ONE;
            totalQuote = totalQuote == 0 ? finalQuotes[i] : (totalQuote * finalQuotes[i]) / ONE;
        }
    }

    function _calculateBuyQuoteAmounts(
        uint _totalQuote,
        uint _sumOfQuotes,
        uint _inverseSum,
        uint _sUSDPaid,
        uint[] memory _marketQuotes
    ) internal pure returns (uint totalAmount, uint[] memory buyQuoteAmounts) {
        buyQuoteAmounts = new uint[](_marketQuotes.length);
        for (uint i = 0; i < _marketQuotes.length; i++) {
            buyQuoteAmounts[i] =
                ((ONE * _marketQuotes[i] * _sUSDPaid * _sumOfQuotes)) /
                (_totalQuote * _inverseSum * _sumOfQuotes);
            totalAmount += buyQuoteAmounts[i];
        }
    }

    function _calculateInitialQuotesForParlay(
        address[] memory _sportMarkets,
        uint[] memory _positions,
        uint _totalSUSDToPay
    )
        internal
        view
        returns (
            uint totalResultQuote,
            uint sumQuotes,
            uint inverseSum,
            uint[] memory marketQuotes,
            uint[] memory inverseQuotes,
            uint totalAmount
        )
    {
        uint numOfMarkets = _sportMarkets.length;
        uint numOfPositions = _positions.length;
        if (_totalSUSDToPay < ONE) {
            _totalSUSDToPay = ONE;
        }
        if (numOfMarkets == numOfPositions && numOfMarkets > 0 && numOfMarkets <= parlaySize) {
            marketQuotes = new uint[](numOfMarkets);
            inverseQuotes = new uint[](numOfMarkets);
            uint[] memory marketOdds;
            for (uint i = 0; i < numOfMarkets; i++) {
                if (_positions[i] > 2) {
                    totalResultQuote = 0;
                    break;
                }
                marketOdds = sportsAmm.getMarketDefaultOdds(_sportMarkets[i], false);
                marketQuotes[i] = marketOdds[_positions[i]];
                totalResultQuote = totalResultQuote == 0 ? marketQuotes[i] : (totalResultQuote * marketQuotes[i]) / ONE;
                inverseQuotes[i] = ONE - marketQuotes[i];
                inverseSum = inverseSum + inverseQuotes[i];
                sumQuotes = sumQuotes + marketQuotes[i];
                if (totalResultQuote == 0) {
                    totalResultQuote = 0;
                    break;
                }
                // two markets can't be equal:
                for (uint j = 0; j < i; j++) {
                    if (_sportMarkets[i] == _sportMarkets[j]) {
                        totalResultQuote = 0;
                        break;
                    }
                }
            }
            totalAmount = totalResultQuote > 0 ? ((_totalSUSDToPay * ONE * ONE) / totalResultQuote) / ONE : 0;
        }
    }

    function _buyPositionsFromSportAMM(
        address[] memory _sportMarkets,
        uint[] memory _positions,
        uint[] memory _proportionalAmounts,
        uint _additionalSlippage,
        address _parlayMarket
    ) internal {
        uint numOfMarkets = _sportMarkets.length;
        uint buyAMMQuote;

        for (uint i = 0; i < numOfMarkets; i++) {
            buyAMMQuote = sportsAmm.buyFromAmmQuoteForParlayAMM(
                _sportMarkets[i],
                _obtainSportsAMMPosition(_positions[i]),
                _proportionalAmounts[i]
            );

            sportsAmm.buyFromAMM(
                _sportMarkets[i],
                _obtainSportsAMMPosition(_positions[i]),
                _proportionalAmounts[i],
                buyAMMQuote,
                _additionalSlippage
            );
            _sendPositionsToMarket(_sportMarkets[i], _positions[i], _parlayMarket, _proportionalAmounts[i]);
            _updateMarketData(_sportMarkets[i], _positions[i], _parlayMarket);
        }
    }

    function _updateMarketData(
        address _market,
        uint _position,
        address _parlayMarket
    ) internal {
        IParlayMarketData(parlayMarketData).addParlayForGamePosition(_market, _position, _parlayMarket);
    }

    function _sendPositionsToMarket(
        address _sportMarket,
        uint _position,
        address _parlayMarket,
        uint _amount
    ) internal {
        if (_position == 0) {
            (IPosition homePosition, , ) = ISportPositionalMarket(_sportMarket).getOptions();
            IERC20Upgradeable(address(homePosition)).safeTransfer(address(_parlayMarket), _amount);
        } else if (_position == 1) {
            (, IPosition awayPosition, ) = ISportPositionalMarket(_sportMarket).getOptions();
            IERC20Upgradeable(address(awayPosition)).safeTransfer(address(_parlayMarket), _amount);
        } else {
            (, , IPosition drawPosition) = ISportPositionalMarket(_sportMarket).getOptions();
            IERC20Upgradeable(address(drawPosition)).safeTransfer(address(_parlayMarket), _amount);
        }
    }

    function _obtainSportsAMMPosition(uint _position) internal pure returns (ISportsAMM.Position position) {
        if (_position == 0) {
            position = ISportsAMM.Position.Home;
        } else {
            position = _position == 1 ? ISportsAMM.Position.Away : ISportsAMM.Position.Draw;
        }
    }

    function _resolveParlay(address _parlayMarket) internal {
        if (ParlayMarket(_parlayMarket).numOfResolvedSportMarkets() == ParlayMarket(_parlayMarket).numOfSportMarkets()) {
            resolvedParlay[_parlayMarket] = true;
            _knownMarkets.remove(_parlayMarket);
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

    /* ========== SETTERS FUNCTIONS ========== */

    function setParlayMarketMastercopies(address _parlayMarketMastercopy) external onlyOwner {
        parlayMarketMastercopy = _parlayMarketMastercopy;
    }

    function setParameters(bool _reducedFeesEnabled) external onlyOwner {
        reducedFeesEnabled = _reducedFeesEnabled;
    }

    function setAmounts(
        uint _maxSupportedAmount,
        uint _maxSupportedOdds,
        uint _parlayAMMFee,
        uint _safeBoxImpact,
        uint _referrerFee
    ) external onlyOwner {
        maxSupportedAmount = _maxSupportedAmount;
        maxSupportedOdds = _maxSupportedOdds;
        parlayAmmFee = _parlayAMMFee;
        safeBoxImpact = _safeBoxImpact;
        referrerFee = _referrerFee;
        emit SetAmounts(_maxSupportedAmount, maxSupportedOdds, _parlayAMMFee, _safeBoxImpact, _referrerFee);
    }

    function setAddresses(
        address _sportsAMM,
        IStakingThales _stakingThales,
        address _safeBox,
        address _referrals,
        address _parlayMarketData
    ) external onlyOwner {
        sportsAmm = ISportsAMM(_sportsAMM);
        sUSD.approve(address(sportsAmm), type(uint256).max);
        stakingThales = _stakingThales;
        safeBox = _safeBox;
        referrals = _referrals;
        parlayMarketData = _parlayMarketData;
        emit AddressesSet(_sportsAMM, address(_stakingThales), _safeBox, _referrals, _parlayMarketData);
    }

    /// @notice Setting the Curve collateral addresses for all collaterals
    /// @param _curveSUSD Address of the Curve contract
    /// @param _dai Address of the DAI contract
    /// @param _usdc Address of the USDC contract
    /// @param _usdt Address of the USDT (Tether) contract
    /// @param _curveOnrampEnabled Enabling or restricting the use of multicollateral
    /// @param _maxAllowedPegSlippagePercentage maximum discount AMM accepts for sUSD purchases
    function setCurveSUSD(
        address _curveSUSD,
        address _dai,
        address _usdc,
        address _usdt,
        bool _curveOnrampEnabled,
        uint _maxAllowedPegSlippagePercentage
    ) external onlyOwner {
        curveSUSD = ICurveSUSD(_curveSUSD);
        dai = _dai;
        usdc = _usdc;
        usdt = _usdt;
        IERC20Upgradeable(dai).approve(_curveSUSD, MAX_APPROVAL);
        IERC20Upgradeable(usdc).approve(_curveSUSD, MAX_APPROVAL);
        IERC20Upgradeable(usdt).approve(_curveSUSD, MAX_APPROVAL);
        // not needed unless selling into different collateral is enabled
        //sUSD.approve(_curveSUSD, MAX_APPROVAL);
        curveOnrampEnabled = _curveOnrampEnabled;
        maxAllowedPegSlippagePercentage = _maxAllowedPegSlippagePercentage;
    }

    /* ========== MODIFIERS ========== */

    /* ========== EVENTS ========== */

    event SetSUSD(address sUSD);
    event NewParlayMarket(address market, address[] markets, uint[] positions, uint amount, uint sUSDpaid);
    event ParlayMarketCreated(
        address market,
        address account,
        uint amount,
        uint sUSDPaid,
        uint sUSDAfterFees,
        uint totalQuote,
        uint initialQuote,
        uint skewImpact
    );
    event SetAmounts(uint max_amount, uint max_odds, uint _parlayAMMFee, uint _safeBoxImpact, uint _referrerFee);
    event AddressesSet(
        address _thalesAMM,
        address _stakingThales,
        address _safeBox,
        address _referrals,
        address _parlayMarketData
    );
    event ReferrerPaid(address refferer, address trader, uint amount, uint volume);
    event ExtraAmountTransferredDueToCancellation(address receiver, uint amount);
    event ParlayResolved(address _parlayOwner, bool _userWon);
}

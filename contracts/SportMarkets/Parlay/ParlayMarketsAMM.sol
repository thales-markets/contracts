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
import "./ParlayVerifier.sol";
import "../../interfaces/IParlayMarketData.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/ISportPositionalMarketManager.sol";
import "../../interfaces/IStakingThales.sol";
import "../../interfaces/IReferrals.sol";
import "../../interfaces/ICurveSUSD.sol";

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
    //REMOVE stakingThales prior to deploy on mainnet
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
    bool public reducedFeesEnabled; // deprecated

    AddressSetLib.AddressSet internal _knownMarkets;
    mapping(address => bool) public resolvedParlay;
    uint maxAllowedPegSlippagePercentage;
    ParlayVerifier public parlayVerifier;
    uint public minUSDAmount;

    uint public maxAllowedRiskPerCombination;
    mapping(address => mapping(uint => mapping(address => mapping(uint => mapping(address => mapping(uint => mapping(address => mapping(uint => uint))))))))
        public riskPerCombination; // deprecated due to TIP-117

    mapping(address => mapping(address => mapping(address => mapping(address => mapping(address => mapping(address => mapping(address => mapping(address => uint))))))))
        public riskPerGameCombination;

    // @return specific SafeBoxFee per address
    mapping(address => uint) public safeBoxFeePerAddress;
    // @return specific parlayAmmFee per address
    mapping(address => uint) public parlayAmmFeePerAddress;

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

    function numActiveParlayMarkets() external view returns (uint) {
        return _knownMarkets.elements.length;
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
            uint totalQuote,
            uint skewImpact
        )
    {
        int128 curveIndex = _mapCollateralToCurveIndex(_collateral);
        if (curveIndex == 0 || !curveOnrampEnabled) {
            return (collateralQuote, sUSDAfterFees, totalBuyAmount, totalQuote, skewImpact);
        }

        (sUSDAfterFees, totalBuyAmount, totalQuote, , skewImpact, , ) = _buyQuoteFromParlay(
            _sportMarkets,
            _positions,
            _sUSDPaid
        );
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
        canBeCreated = totalQuote >= maxSupportedOdds && totalBuyAmount <= maxSupportedAmount;
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

    function isParlayOwnerTheWinner(address _parlayMarket) external view returns (bool isUserTheWinner) {
        if (_knownMarkets.contains(_parlayMarket)) {
            isUserTheWinner = ParlayMarket(_parlayMarket).isUserTheWinner();
        }
    }

    /* ========== EXTERNAL FUNCTIONS ========== */

    function buyFromParlay(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDPaid,
        uint _additionalSlippage,
        uint _expectedPayout,
        address _differentRecipient
    ) external nonReentrant notPaused {
        if (_differentRecipient == address(0)) {
            _differentRecipient = msg.sender;
        }
        _buyFromParlay(
            _sportMarkets,
            _positions,
            _sUSDPaid,
            _additionalSlippage,
            _expectedPayout,
            true,
            _differentRecipient
        );
        if (referrerFee > 0 && referrals != address(0)) {
            _handleReferrer(_differentRecipient, _sUSDPaid);
        }
    }

    function buyFromParlayWithReferrer(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDPaid,
        uint _additionalSlippage,
        uint _expectedPayout,
        address _differentRecipient,
        address _referrer
    ) external nonReentrant notPaused {
        if (_differentRecipient == address(0)) {
            _differentRecipient = msg.sender;
        }
        if (_referrer != address(0)) {
            IReferrals(referrals).setReferrer(_referrer, msg.sender);
        }
        _buyFromParlay(
            _sportMarkets,
            _positions,
            _sUSDPaid,
            _additionalSlippage,
            _expectedPayout,
            true,
            _differentRecipient
        );
        if (referrerFee > 0 && referrals != address(0)) {
            _handleReferrer(_differentRecipient, _sUSDPaid);
        }
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

        _buyFromParlay(_sportMarkets, _positions, _sUSDPaid, _additionalSlippage, _expectedPayout, false, msg.sender);
        if (referrerFee > 0 && referrals != address(0)) {
            _handleReferrer(msg.sender, _sUSDPaid);
        }
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
        emit ParlayResolved(msg.sender, _account, _userWon);
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
        bool _sendSUSD,
        address _differentRecipient
    ) internal {
        uint totalAmount;
        uint totalQuote;
        uint[] memory amountsToBuy = new uint[](_sportMarkets.length);
        uint[] memory marketQuotes = new uint[](_sportMarkets.length);
        uint sUSDAfterFees;
        (sUSDAfterFees, totalAmount, totalQuote, , , marketQuotes, amountsToBuy) = _buyQuoteFromParlay(
            _sportMarkets,
            _positions,
            _sUSDPaid
        );
        uint safeBoxAmount = _getSafeBoxAmount(_sUSDPaid, sUSDAfterFees, msg.sender);
        // apply all checks
        require(_sUSDPaid >= minUSDAmount, "Low sUSD buy");
        require(totalQuote >= maxSupportedOdds, "Can not create parlay market!");
        require((totalAmount - _sUSDPaid) <= maxSupportedAmount, "Amount exceeds MaxSupportedAmount");
        require(((ONE * _expectedPayout) / totalAmount) <= (ONE + _additionalSlippage), "Slippage too high");

        if (_sendSUSD) {
            sUSD.safeTransferFrom(msg.sender, address(this), _sUSDPaid);
        }
        sUSD.safeTransfer(safeBox, safeBoxAmount);

        // mint the stateful token  (ERC-20)
        // clone a parlay market
        ParlayMarket parlayMarket = ParlayMarket(Clones.clone(parlayMarketMastercopy));
        parlayMarket.initialize(
            _sportMarkets,
            _positions,
            totalAmount,
            sUSDAfterFees,
            (block.timestamp + sportManager.expiryDuration()),
            address(this),
            _differentRecipient
        );

        emit NewParlayMarket(address(parlayMarket), _sportMarkets, _positions, totalAmount, sUSDAfterFees);

        _knownMarkets.add(address(parlayMarket));
        parlayMarket.updateQuotes(marketQuotes, totalQuote);
        sportsAmm.updateParlayVolume(_differentRecipient, _sUSDPaid);
        // buy the positions
        _buyPositionsFromSportAMM(
            _sportMarkets,
            _positions,
            amountsToBuy,
            _additionalSlippage,
            address(parlayMarket),
            _differentRecipient
        );
        _sportMarkets = parlayVerifier.sort(_sportMarkets);
        _storeRisk(_sportMarkets, (totalAmount - sUSDAfterFees));

        emit ParlayMarketCreated(
            address(parlayMarket),
            _differentRecipient,
            totalAmount,
            _sUSDPaid,
            sUSDAfterFees,
            totalQuote,
            safeBoxAmount,
            marketQuotes
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
        if (parlayVerifier.verifyMarkets(_sportMarkets, _positions, _sUSDPaid, sportsAmm, address(this))) {
            sUSDAfterFees = ((ONE - ((safeBoxImpact + parlayAmmFee))) * _sUSDPaid) / ONE;
            (totalQuote, totalBuyAmount, skewImpact, finalQuotes, amountsToBuy) = parlayVerifier
                .calculateInitialQuotesForParlay(
                    ParlayVerifier.InitialQuoteParameters(
                        _sportMarkets,
                        _positions,
                        sportManager.reverseTransformCollateral(sUSDAfterFees),
                        parlaySize,
                        sportManager.reverseTransformCollateral(1),
                        sportsAmm
                    )
                );
        }
    }

    function _buyPositionsFromSportAMM(
        address[] memory _sportMarkets,
        uint[] memory _positions,
        uint[] memory _proportionalAmounts,
        uint _additionalSlippage,
        address _parlayMarket,
        address _parlayOwner
    ) internal {
        uint numOfMarkets = _sportMarkets.length;
        uint buyAMMQuote;
        ISportsAMM.Position sportPosition;
        for (uint i = 0; i < numOfMarkets; i++) {
            sportPosition = parlayVerifier.obtainSportsAMMPosition(_positions[i]);
            sportsAmm.buyFromAMM(
                _sportMarkets[i],
                sportPosition,
                _proportionalAmounts[i],
                type(uint256).max,
                _additionalSlippage
            );
            _sendPositionsToMarket(_sportMarkets[i], _positions[i], _parlayMarket, _proportionalAmounts[i]);
            _updateMarketData(_sportMarkets[i], _positions[i], _parlayMarket, _parlayOwner);
        }
    }

    function _updateMarketData(
        address _market,
        uint _position,
        address _parlayMarket,
        address _parlayOwner
    ) internal {
        IParlayMarketData(parlayMarketData).addParlayForGamePosition(_market, _position, _parlayMarket, _parlayOwner);
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

    function _storeRisk(address[] memory _sportMarkets, uint _sUSDPaid) internal {
        if (_sportMarkets.length > 1 && _sportMarkets.length < 9) {
            address first = _sportMarkets[0];
            address second = _sportMarkets[1];
            address third = _sportMarkets.length > 2 ? _sportMarkets[2] : address(0);
            address fourth = _sportMarkets.length > 3 ? _sportMarkets[3] : address(0);
            address fifth = _sportMarkets.length > 4 ? _sportMarkets[4] : address(0);
            address sixth = _sportMarkets.length > 5 ? _sportMarkets[5] : address(0);
            address seventh = _sportMarkets.length > 6 ? _sportMarkets[6] : address(0);
            address eight = _sportMarkets.length > 7 ? _sportMarkets[7] : address(0);
            riskPerGameCombination[first][second][third][fourth][fifth][sixth][seventh][eight] += _sUSDPaid;
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

    function _handleReferrer(address buyer, uint volume) internal {
        address referrer = IReferrals(referrals).sportReferrals(buyer);
        uint referrerShare = volume.mul(ONE).div(ONE.sub(referrerFee)).sub(volume);
        if (referrer != address(0) && referrerFee > 0) {
            sUSD.safeTransfer(referrer, referrerShare);
            emit ReferrerPaid(referrer, buyer, referrerShare, volume);
        }
    }

    function _getSafeBoxFeePerAddress(address toCheck) internal view returns (uint toReturn) {
        return safeBoxFeePerAddress[toCheck] > 0 ? safeBoxFeePerAddress[toCheck] : safeBoxImpact;
    }

    function _getParlayAmmFeePerAddress(address toCheck) internal view returns (uint toReturn) {
        return parlayAmmFeePerAddress[toCheck] > 0 ? parlayAmmFeePerAddress[toCheck] : parlayAmmFee;
    }

    function _getSafeBoxAmount(
        uint sUSDPaid,
        uint sUSDAfterFees,
        address toCheck
    ) internal view returns (uint safeBoxAmount) {
        uint safeBoxFee = _getSafeBoxFeePerAddress(toCheck);
        safeBoxAmount = ((sUSDPaid - sUSDAfterFees) * safeBoxFee) / (safeBoxFee + _getParlayAmmFeePerAddress(toCheck));
    }

    /* ========== SETTERS FUNCTIONS ========== */

    function setParlayMarketMastercopies(address _parlayMarketMastercopy) external onlyOwner {
        parlayMarketMastercopy = _parlayMarketMastercopy;
    }

    function setParameters(uint _parlaySize) external onlyOwner {
        require(_parlaySize < 9, "parlaySize invalid");
        parlaySize = _parlaySize;
    }

    function setAmounts(
        uint _minUSDAmount,
        uint _maxSupportedAmount,
        uint _maxSupportedOdds,
        uint _parlayAMMFee,
        uint _safeBoxImpact,
        uint _referrerFee,
        uint _maxAllowedRiskPerCombination
    ) external onlyOwner {
        minUSDAmount = _minUSDAmount;
        maxSupportedAmount = _maxSupportedAmount;
        maxSupportedOdds = _maxSupportedOdds;
        parlayAmmFee = _parlayAMMFee;
        safeBoxImpact = _safeBoxImpact;
        referrerFee = _referrerFee;
        maxAllowedRiskPerCombination = _maxAllowedRiskPerCombination;
        emit SetAmounts(
            _minUSDAmount,
            _maxSupportedAmount,
            maxSupportedOdds,
            _parlayAMMFee,
            _safeBoxImpact,
            _referrerFee,
            _maxAllowedRiskPerCombination
        );
    }

    function setAddresses(
        address _sportsAMM,
        address _safeBox,
        address _referrals,
        address _parlayMarketData,
        address _parlayVerifier
    ) external onlyOwner {
        sportsAmm = ISportsAMM(_sportsAMM);
        sUSD.approve(address(sportsAmm), type(uint256).max);
        safeBox = _safeBox;
        referrals = _referrals;
        parlayMarketData = _parlayMarketData;
        parlayVerifier = ParlayVerifier(_parlayVerifier);
        emit AddressesSet(_sportsAMM, _safeBox, _referrals, _parlayMarketData, _parlayVerifier);
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

    /// @notice Updates contract parametars
    /// @param _address which has a specific safe box fee
    /// @param newFee the fee
    function setSafeBoxFeePerAddress(address _address, uint newFee) external onlyOwner {
        safeBoxFeePerAddress[_address] = newFee;
        emit SafeBoxFeePerAddressChanged(_address, newFee);
    }

    /// @notice Updates contract parametars
    /// @param _address which has a specific parlay amm fee
    /// @param newFee the fee
    function setParlayAmmFeePerAddress(address _address, uint newFee) external onlyOwner {
        parlayAmmFeePerAddress[_address] = newFee;
        emit ParlayAmmFeePerAddressChanged(_address, newFee);
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
        uint skewImpact,
        uint[] marketQuotes
    );
    event SetAmounts(
        uint minUSDamount,
        uint max_amount,
        uint max_odds,
        uint _parlayAMMFee,
        uint _safeBoxImpact,
        uint _referrerFee,
        uint _maxAllowedRiskPerCombination
    );
    event AddressesSet(
        address _thalesAMM,
        address _safeBox,
        address _referrals,
        address _parlayMarketData,
        address _parlayVerifier
    );
    event ReferrerPaid(address refferer, address trader, uint amount, uint volume);
    event ExtraAmountTransferredDueToCancellation(address receiver, uint amount);
    event ParlayResolved(address _parlayMarket, address _parlayOwner, bool _userWon);
    event SafeBoxFeePerAddressChanged(address _address, uint newFee);
    event ParlayAmmFeePerAddressChanged(address _address, uint newFee);
}

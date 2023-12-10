// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
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

// interfaces
import "../../interfaces/IParlayMarketData.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/ISportPositionalMarketManager.sol";
import "../../interfaces/IStakingThales.sol";
import "../../interfaces/IReferrals.sol";
import "../../interfaces/ICurveSUSD.sol";
import "../../interfaces/IParlayAMMLiquidityPool.sol";
import "../../interfaces/IMultiCollateralOnOffRamp.sol";

contract ParlayMarketsAMM is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using AddressSetLib for AddressSetLib.AddressSet;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant DEFAULT_PARLAY_SIZE = 4;
    uint private constant MAX_APPROVAL = type(uint256).max;
    uint private constant POSITION_TAG_CONSTANT = 1e8;

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

    address private usdc; // deprecated see MultiCollateralOnOffRamp.sol
    address private usdt; // deprecated see MultiCollateralOnOffRamp.sol
    address private dai; // deprecated see MultiCollateralOnOffRamp.sol

    uint public parlayAmmFee;
    uint public parlaySize;
    uint public maxSupportedAmount;
    uint public maxSupportedOdds;
    uint public safeBoxImpact;

    uint private referrerFee; // deprecated, moved to Referrals.sol
    bool private curveOnrampEnabled; // deprecated see MultiCollateralOnOffRamp.sol
    bool private reducedFeesEnabled; // deprecated

    AddressSetLib.AddressSet internal _knownMarkets;
    mapping(address => bool) public resolvedParlay;

    // deprecated see MultiCollateralOnOffRamp.sol
    uint private maxAllowedPegSlippagePercentage;

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

    mapping(bytes32 => uint) public riskPerPackedGamesCombination;

    mapping(uint => mapping(uint => mapping(uint => uint))) public SGPFeePerCombination;

    address public parlayLP;

    address public parlayPolicy;

    /// @return The sUSD amount bought from AMM by users for the parent
    IMultiCollateralOnOffRamp public multiCollateralOnOffRamp;
    bool public multicollateralEnabled;

    mapping(address => mapping(uint => uint)) public riskPerMarketAndPosition;

    mapping(address => bool) public parlaysWithNewFormat;

    receive() external payable {}

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

    function getSgpFeePerCombination(
        uint tag1,
        uint tag2_1,
        uint tag2_2,
        uint position1,
        uint position2
    ) external view returns (uint sgpFee) {
        if (position1 > 2 || position2 > 2) {
            sgpFee = SGPFeePerCombination[tag1][tag2_1][tag2_2];
        } else {
            uint posTag2_1 = tag2_1 + (POSITION_TAG_CONSTANT + ((POSITION_TAG_CONSTANT / 10) * position1));
            uint posTag2_2 = tag2_2 + (POSITION_TAG_CONSTANT + ((POSITION_TAG_CONSTANT / 10) * position2));
            if (SGPFeePerCombination[tag1][posTag2_1][posTag2_2] > 0) {
                if (SGPFeePerCombination[tag1][posTag2_1][posTag2_2] < ONE) {
                    sgpFee = SGPFeePerCombination[tag1][posTag2_1][posTag2_2];
                }
            } else {
                sgpFee = SGPFeePerCombination[tag1][tag2_1][tag2_2];
            }
        }
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
            uint skewImpact,
            uint[] memory finalQuotes,
            uint[] memory amountsToBuy
        )
    {
        (sUSDAfterFees, totalBuyAmount, totalQuote, , skewImpact, finalQuotes, amountsToBuy) = _buyQuoteFromParlay(
            _sportMarkets,
            _positions,
            _sUSDPaid
        );
        collateralQuote = multiCollateralOnOffRamp.getMinimumNeeded(_collateral, _sUSDPaid);
    }

    function canCreateParlayMarket(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDToPay
    ) external view returns (bool canBeCreated) {
        (, uint totalBuyAmount, uint totalQuote, , , , ) = _buyQuoteFromParlay(_sportMarkets, _positions, _sUSDToPay);
        canBeCreated = totalQuote >= maxSupportedOdds && totalBuyAmount <= maxSupportedAmount;
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
        _buyFromParlayCommon(
            _sportMarkets,
            _positions,
            _sUSDPaid,
            _additionalSlippage,
            _expectedPayout,
            _differentRecipient
        );
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
        if (_referrer != address(0)) {
            IReferrals(referrals).setReferrer(_referrer, msg.sender);
        }
        _buyFromParlayCommon(
            _sportMarkets,
            _positions,
            _sUSDPaid,
            _additionalSlippage,
            _expectedPayout,
            _differentRecipient
        );
    }

    function _buyFromParlayCommon(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDPaid,
        uint _additionalSlippage,
        uint _expectedPayout,
        address _differentRecipient
    ) internal {
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

        _transferSuprlusIfExists();
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
        _buyFromParlayWithDifferentCollateralAndReferrer(
            _sportMarkets,
            _positions,
            _sUSDPaid,
            _additionalSlippage,
            _expectedPayout,
            collateral,
            _referrer,
            false
        );
    }

    function buyFromParlayWithEth(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDPaid,
        uint _additionalSlippage,
        uint _expectedPayout,
        address collateral,
        address _referrer
    ) external payable nonReentrant notPaused {
        _buyFromParlayWithDifferentCollateralAndReferrer(
            _sportMarkets,
            _positions,
            _sUSDPaid,
            _additionalSlippage,
            _expectedPayout,
            collateral,
            _referrer,
            true
        );
    }

    function _buyFromParlayWithDifferentCollateralAndReferrer(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDPaid,
        uint _additionalSlippage,
        uint _expectedPayout,
        address collateral,
        address _referrer,
        bool isEth
    ) internal {
        if (_referrer != address(0)) {
            IReferrals(referrals).setReferrer(_referrer, msg.sender);
        }

        uint collateralQuote = multiCollateralOnOffRamp.getMinimumNeeded(collateral, _sUSDPaid);

        uint exactReceived;

        if (isEth) {
            require(collateral == multiCollateralOnOffRamp.WETH9(), "Wrong collateral sent");
            require(msg.value >= collateralQuote, "not enough ETH sent");
            exactReceived = multiCollateralOnOffRamp.onrampWithEth{value: msg.value}(msg.value);
        } else {
            IERC20Upgradeable(collateral).safeTransferFrom(msg.sender, address(this), collateralQuote);
            IERC20Upgradeable(collateral).approve(address(multiCollateralOnOffRamp), collateralQuote);
            exactReceived = multiCollateralOnOffRamp.onramp(collateral, collateralQuote);
        }

        require(exactReceived >= _sUSDPaid, "Not enough sUSD received");

        //send the surplus to SB
        if (exactReceived > _sUSDPaid) {
            sUSD.safeTransfer(safeBox, exactReceived - _sUSDPaid);
        }

        _buyFromParlay(_sportMarkets, _positions, _sUSDPaid, _additionalSlippage, _expectedPayout, false, msg.sender);
        _transferSuprlusIfExists();
    }

    function _transferSuprlusIfExists() internal {
        uint balance = sUSD.balanceOf(address(this));
        if (balance > 0) {
            sUSD.transfer(
                IParlayAMMLiquidityPool(parlayLP).getMarketPool(_knownMarkets.elements[_knownMarkets.elements.length - 1]),
                balance
            );
        }
    }

    function exerciseParlay(address _parlayMarket) external nonReentrant notPaused onlyKnownMarkets(_parlayMarket) {
        _exerciseParlay(_parlayMarket);
    }

    function exerciseParlayWithOfframp(
        address _parlayMarket,
        address collateral,
        bool toEth
    ) external nonReentrant notPaused onlyKnownMarkets(_parlayMarket) {
        ParlayMarket parlayMarket = ParlayMarket(_parlayMarket);
        address parlayOwner = parlayMarket.parlayOwner();
        require(msg.sender == parlayOwner, "Only allowed from parlay owner");
        uint amountBefore = sUSD.balanceOf(parlayOwner);
        _exerciseParlay(_parlayMarket);
        uint amountDiff = sUSD.balanceOf(parlayOwner) - amountBefore;
        sUSD.safeTransferFrom(parlayOwner, address(this), amountDiff);
        if (amountDiff > 0) {
            if (toEth) {
                uint offramped = multiCollateralOnOffRamp.offrampIntoEth(amountDiff);
                address payable _to = payable(parlayOwner);
                bool sent = _to.send(offramped);
                require(sent, "Failed to send Ether");
            } else {
                uint offramped = multiCollateralOnOffRamp.offramp(collateral, amountDiff);
                IERC20Upgradeable(collateral).safeTransfer(parlayOwner, offramped);
            }
        }
    }

    function _exerciseParlay(address _parlayMarket) internal {
        ParlayMarket parlayMarket = ParlayMarket(_parlayMarket);
        parlayMarket.exerciseWiningSportMarkets();
        uint amount = sUSD.balanceOf(address(this));
        if (amount > 0) {
            IParlayAMMLiquidityPool(parlayLP).transferToPool(_parlayMarket, amount);
        }
    }

    // TODO: to remove
    function resolveParlay() external notPaused onlyKnownMarkets(msg.sender) {
        if (!ParlayMarket(msg.sender).resolved()) {
            resolvedParlay[msg.sender] = true;
            _knownMarkets.remove(msg.sender);
        }
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

    function triggerResolvedEvent(address _account, bool _userWon) external notPaused onlyKnownMarkets(msg.sender) {
        if (parlaysWithNewFormat[msg.sender]) {
            resolvedParlay[msg.sender] = true;
            _knownMarkets.remove(msg.sender);
        }
        emit ParlayResolved(msg.sender, _account, _userWon);
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
        // apply all checks
        require(_sUSDPaid >= minUSDAmount, "Low sUSD buy");
        require(totalQuote >= maxSupportedOdds, "Can not create parlay market!");
        require((totalAmount - _sUSDPaid) <= maxSupportedAmount, "Amount exceeds MaxSupportedAmount");
        require(((ONE * _expectedPayout) / totalAmount) <= (ONE + _additionalSlippage), "Slippage too high");

        for (uint i = 0; i < _sportMarkets.length; i++) {
            riskPerMarketAndPosition[_sportMarkets[i]][_positions[i]] += amountsToBuy[i];
            require(
                riskPerMarketAndPosition[_sportMarkets[i]][_positions[i]] <
                    sportsAmm.riskManager().calculateCapToBeUsed(_sportMarkets[i]),
                "Risk per individual market and position exceeded"
            );
            if (!ISportPositionalMarket(_sportMarkets[i]).optionsInitialized()) {
                ISportPositionalMarket(_sportMarkets[i]).initializeOptions();
            }
        }

        if (_sendSUSD) {
            sUSD.safeTransferFrom(msg.sender, address(this), _sUSDPaid);
        }

        uint safeBoxAmount = _handleReferrerAndSB(_sUSDPaid, sUSDAfterFees);

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
            _differentRecipient,
            totalQuote,
            marketQuotes
        );

        _knownMarkets.add(address(parlayMarket));
        parlaysWithNewFormat[address(parlayMarket)] = true;
        sportsAmm.updateParlayVolume(_differentRecipient, _sUSDPaid);

        IParlayAMMLiquidityPool(parlayLP).commitTrade(
            address(parlayMarket),
            totalAmount - sportManager.reverseTransformCollateral(sUSDAfterFees)
        );
        // buy the positions
        sUSD.safeTransfer(address(parlayMarket), totalAmount);
        _storeRisk(_sportMarkets, (totalAmount - sportManager.reverseTransformCollateral(sUSDAfterFees)));

        emit NewParlayMarket(address(parlayMarket), _sportMarkets, _positions, totalAmount, sUSDAfterFees);

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
        sUSDAfterFees = ((ONE - ((safeBoxImpact + parlayAmmFee))) * _sUSDPaid) / ONE;
        (totalQuote, totalBuyAmount, skewImpact, finalQuotes, amountsToBuy) = parlayVerifier.calculateInitialQuotesForParlay(
            ParlayVerifier.InitialQuoteParameters(
                _sportMarkets,
                _positions,
                sportManager.reverseTransformCollateral(sUSDAfterFees),
                parlaySize,
                sportManager.reverseTransformCollateral(1),
                finalQuotes,
                sportsAmm,
                address(this)
            )
        );

        // check if any market breaches cap
        for (uint i = 0; i < _sportMarkets.length; i++) {
            if (
                riskPerMarketAndPosition[_sportMarkets[i]][_positions[i]] + amountsToBuy[i] >
                sportsAmm.riskManager().calculateCapToBeUsed(_sportMarkets[i])
            ) {
                finalQuotes[i] = 0;
                totalQuote = 0;
                skewImpact = 0;
            }
        }
    }

    function _handleReferrerAndSB(uint _sUSDPaid, uint sUSDAfterFees) internal returns (uint safeBoxAmount) {
        uint referrerShare;
        address referrer = IReferrals(referrals).sportReferrals(msg.sender);
        if (referrer != address(0)) {
            uint referrerFeeByTier = IReferrals(referrals).getReferrerFee(referrer);
            if (referrerFeeByTier > 0) {
                referrerShare = (_sUSDPaid * referrerFeeByTier) / ONE;
                sUSD.safeTransfer(referrer, referrerShare);
                emit ReferrerPaid(referrer, msg.sender, referrerShare, _sUSDPaid);
            }
        }
        safeBoxAmount = _getSafeBoxAmount(_sUSDPaid, sUSDAfterFees, msg.sender);
        sUSD.safeTransfer(safeBox, safeBoxAmount - referrerShare);
    }

    function _storeRisk(address[] memory _sportMarkets, uint _sUSDPaid) internal {
        if (_sportMarkets.length > 1 && _sportMarkets.length <= parlaySize) {
            riskPerPackedGamesCombination[parlayVerifier.calculateCombinationKey(_sportMarkets)] += _sUSDPaid;
        }
    }

    function _getSafeBoxFeePerAddress(address toCheck) internal view returns (uint toReturn) {
        return safeBoxFeePerAddress[toCheck] > 0 ? safeBoxFeePerAddress[toCheck] : safeBoxImpact;
    }

    function _getParlayAmmFeePerAddress(address toCheck) internal view returns (uint toReturn) {
        return parlayAmmFeePerAddress[toCheck] > 0 ? parlayAmmFeePerAddress[toCheck] : parlayAmmFee;
    }

    function _obtainSportsAMMPosition(uint _position) internal pure returns (ISportsAMM.Position) {
        if (_position == 0) {
            return ISportsAMM.Position.Home;
        } else if (_position == 1) {
            return ISportsAMM.Position.Away;
        }
        return ISportsAMM.Position.Draw;
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
        emit NewParlayMastercopy(_parlayMarketMastercopy);
    }

    function setParameters(uint _parlaySize) external onlyOwner {
        parlaySize = _parlaySize;
        emit NewParametersSet(_parlaySize);
    }

    function setSgpFeePerCombination(
        uint tag1,
        uint tag2_1,
        uint tag2_2,
        uint fee
    ) external onlyOwner {
        SGPFeePerCombination[tag1][tag2_1][tag2_2] = fee;
        SGPFeePerCombination[tag1][tag2_2][tag2_1] = fee;
    }

    function setSGPFeePerPosition(
        uint[] calldata tag1,
        uint tag2_1,
        uint tag2_2,
        uint position_1,
        uint position_2,
        uint fee
    ) external onlyOwner {
        for (uint i = 0; i < tag1.length; i++) {
            require(SGPFeePerCombination[tag1[i]][tag2_1][tag2_2] > 0, "SGP not set for tags");
            uint posTag2_1 = tag2_1 + (POSITION_TAG_CONSTANT + ((POSITION_TAG_CONSTANT / 10) * position_1));
            uint posTag2_2 = tag2_2 + (POSITION_TAG_CONSTANT + ((POSITION_TAG_CONSTANT / 10) * position_2));
            SGPFeePerCombination[tag1[i]][posTag2_1][posTag2_2] = fee;
            SGPFeePerCombination[tag1[i]][posTag2_2][posTag2_1] = fee;
            emit SetSGPFeePerPosition(tag1[i], posTag2_2, posTag2_1, fee);
        }
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
        // deprecated
        //referrerFee = _referrerFee;
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
        address _parlayMarketData
    ) external onlyOwner {
        sportsAmm = ISportsAMM(_sportsAMM);
        sUSD.approve(address(sportsAmm), type(uint256).max);
        safeBox = _safeBox;
        referrals = _referrals;
        parlayMarketData = _parlayMarketData;
        emit AddressesSet(_sportsAMM, _safeBox, _referrals, _parlayMarketData);
    }

    function setVerifierAndPolicyAddresses(address _parlayVerifier, address _parlayPolicy) external onlyOwner {
        require(_parlayVerifier != address(0) && _parlayPolicy != address(0), "InvAdd0");
        parlayPolicy = _parlayPolicy;
        parlayVerifier = ParlayVerifier(_parlayVerifier);
        emit VerifierAndPolicySet(_parlayVerifier, _parlayPolicy);
    }

    /// @notice set multicollateral onramp contract
    function setMultiCollateralOnOffRamp(address _onramper, bool enabled) external onlyOwner {
        if (address(multiCollateralOnOffRamp) != address(0)) {
            sUSD.approve(address(multiCollateralOnOffRamp), 0);
        }
        multiCollateralOnOffRamp = IMultiCollateralOnOffRamp(_onramper);
        multicollateralEnabled = enabled;
        sUSD.approve(_onramper, MAX_APPROVAL);
        emit SetMultiCollateralOnOffRamp(_onramper, enabled);
    }

    function setParlayLP(address _parlayLP) external onlyOwner {
        if (parlayLP != address(0)) {
            sUSD.approve(parlayLP, 0);
        }
        parlayLP = _parlayLP;
        sUSD.approve(_parlayLP, type(uint256).max);
        emit ParlayLPSet(_parlayLP);
    }

    /* ========== MODIFIERS ========== */

    modifier onlyKnownMarkets(address _parlayMarket) {
        require(_knownMarkets.contains(_parlayMarket), "Unknown parlay market");
        _;
    }

    /* ========== EVENTS ========== */
    event SetSUSD(address sUSDToken);
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
    event AddressesSet(address _thalesAMM, address _safeBox, address _referrals, address _parlayMarketData);
    event VerifierAndPolicySet(address _parlayVerifier, address _parlayPolicy);
    event ReferrerPaid(address refferer, address trader, uint amount, uint volume);
    event ExtraAmountTransferredDueToCancellation(address receiver, uint amount);
    event ParlayResolved(address _parlayMarket, address _parlayOwner, bool _userWon);
    event SafeBoxFeePerAddressChanged(address _address, uint newFee);
    event ParlayAmmFeePerAddressChanged(address _address, uint newFee);
    event NewParlayMastercopy(address parlayMarketMastercopy);
    event NewParametersSet(uint parlaySize);
    event ParlayLPSet(address parlayLP);
    event SetMultiCollateralOnOffRamp(address _onramper, bool enabled);
    event SetSGPFeePerPosition(uint tag1, uint tag2_1, uint tag2_2, uint fee);
}

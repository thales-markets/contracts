// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";

// interface
import "../interfaces/ISportPositionalMarket.sol";
import "../interfaces/ISportPositionalMarketManager.sol";
import "../interfaces/IPosition.sol";
import "../interfaces/IStakingThales.sol";
import "../interfaces/ITherundownConsumer.sol";
import "../interfaces/ICurveSUSD.sol";
import "../interfaces/IReferrals.sol";
import "../interfaces/ISportsAMM.sol";
import "../interfaces/ITherundownConsumerWrapper.sol";
import "../interfaces/ISportAMMRiskManager.sol";

import "./SportsAMMUtils.sol";
import "./LiquidityPool/SportAMMLiquidityPool.sol";

import "../interfaces/IMultiCollateralOnOffRamp.sol";

/// @title Sports AMM contract
/// @author kirilaa
contract SportsAMM is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint private constant ONE = 1e18;
    uint private constant ZERO_POINT_ONE = 1e17;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant MAX_APPROVAL = type(uint256).max;
    uint public constant TAG_NUMBER_PLAYERS = 10010;

    /// @return The sUSD contract used for payment
    IERC20Upgradeable public sUSD;

    /// @return The address of the SportsPositionalManager contract
    address public manager;

    uint private defaultCapPerGame; //deprecated see SportAMMRiskManager.sol

    /// @return The minimal spread/skrew percentage
    uint public min_spread;

    /// @return The maximum spread/skrew percentage
    uint public max_spread;

    /// @notice Each game will be restricted for AMM trading `minimalTimeLeftToMaturity` seconds before is mature
    /// @return The period of time before a game is matured and begins to be restricted for AMM trading
    uint public minimalTimeLeftToMaturity;

    enum Position {
        Home,
        Away,
        Draw
    }

    /// @return The sUSD amount bought from AMM by users for the market
    mapping(address => uint) public spentOnGame;

    /// @return The SafeBox address
    address public safeBox;

    /// @return The address of Therundown Consumer
    address public theRundownConsumer;

    /// @return The percentage that goes to SafeBox
    uint public safeBoxImpact;

    /// @return The address of the Staking contract
    IStakingThales public stakingThales;

    /// @return The minimum supported odd
    uint public minSupportedOdds;

    /// @return The maximum supported odd
    uint public maxSupportedOdds;

    ICurveSUSD private curveSUSD; // deprecated see MultiCollateralOnOffRamp.sol

    address private usdc; // deprecated see MultiCollateralOnOffRamp.sol

    address private usdt; // deprecated see MultiCollateralOnOffRamp.sol

    address private dai; // deprecated see MultiCollateralOnOffRamp.sol

    bool private curveOnrampEnabled; // deprecated see MultiCollateralOnOffRamp.sol

    /// @return Referrals contract address
    address public referrals;

    uint private referrerFee; // deprecated, moved to Referrals.sol

    /// @return The address of Parlay AMM
    address public parlayAMM;

    address private apexConsumer; // deprecated

    uint private maxAllowedPegSlippagePercentage; // deprecated see MultiCollateralOnOffRamp.sol

    mapping(uint => uint) private capPerSport; //deprecated see SportAMMRiskManager.sol

    SportsAMMUtils public sportAmmUtils;

    mapping(address => uint) private capPerMarket; //deprecated see SportAMMRiskManager.sol

    /// @notice odds threshold which will trigger odds update
    /// @return The threshold.
    uint public thresholdForOddsUpdate;

    /// @return The address of wrapper contract
    ITherundownConsumerWrapper public wrapper;

    // @return specific SafeBoxFee per address
    mapping(address => uint) public safeBoxFeePerAddress;

    // @return specific min_spread per address
    mapping(address => uint) public min_spreadPerAddress;

    mapping(uint => mapping(uint => uint)) private capPerSportAndChild; //deprecated see SportAMMRiskManager.sol

    struct BuyFromAMMParams {
        address market;
        ISportsAMM.Position position;
        uint amount;
        uint expectedPayout;
        uint additionalSlippage;
        bool sendSUSD;
        uint sUSDPaid;
    }

    struct DoubleChanceStruct {
        bool isDoubleChance;
        ISportsAMM.Position position1;
        ISportsAMM.Position position2;
        address parentMarket;
    }

    /// @return the adddress of the AMMLP contract
    SportAMMLiquidityPool public liquidityPool;

    mapping(uint => mapping(uint => uint)) private minSpreadPerSport; //deprecated see SportAMMRiskManager.sol

    mapping(uint => bool) private isMarketForSportOnePositional; //deprecated see SportAMMRiskManager.sol

    mapping(uint => uint) private minSupportedOddsPerSport; //deprecated see SportAMMRiskManager.sol

    mapping(uint => uint) private maxSpreadPerSport; //deprecated see SportAMMRiskManager.sol

    ISportAMMRiskManager public riskManager;

    mapping(address => uint) private spentOnParent;

    /// @return The sUSD amount bought from AMM by users for the parent
    IMultiCollateralOnOffRamp public multiCollateralOnOffRamp;
    bool public multicollateralEnabled;

    receive() external payable {}

    /// @notice Initialize the storage in the proxy contract with the parameters.
    /// @param _owner Owner for using the ownerOnly functions
    /// @param _sUSD The payment token (sUSD)
    /// @param _min_spread Minimal spread (percentage)
    /// @param _max_spread Maximum spread (percentage)
    /// @param _minimalTimeLeftToMaturity Period to close AMM trading befor maturity
    function initialize(
        address _owner,
        IERC20Upgradeable _sUSD,
        uint _min_spread,
        uint _max_spread,
        uint _minimalTimeLeftToMaturity
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        sUSD = _sUSD;
        min_spread = _min_spread;
        max_spread = _max_spread;
        minimalTimeLeftToMaturity = _minimalTimeLeftToMaturity;
    }

    /// @notice Returns the available position options to buy from AMM for specific market/game
    /// @param market The address of the SportPositional market created for a game
    /// @param position The position (home/away/draw) to check availability
    /// @return _available The amount of position options (tokens) available to buy from AMM.
    function availableToBuyFromAMM(address market, ISportsAMM.Position position) public view returns (uint _available) {
        if (isMarketInAMMTrading(market)) {
            uint baseOdds = _obtainOdds(market, position);
            if (baseOdds > 0) {
                _available = _availableToBuyFromAMMInternal(
                    market,
                    position,
                    baseOdds,
                    0,
                    false,
                    _getDoubleChanceStruct(market)
                );
            }
        }
    }

    /// @notice Calculate the sUSD cost to buy an amount of available position options from AMM for specific market/game
    /// @param market The address of the SportPositional market of a game
    /// @param position The position (home/away/draw) quoted to buy from AMM
    /// @param amount The position amount quoted to buy from AMM
    /// @return _quote The sUSD cost for buying the `amount` of `position` options (tokens) from AMM for `market`.
    function buyFromAmmQuote(
        address market,
        ISportsAMM.Position position,
        uint amount
    ) public view returns (uint _quote) {
        if (isMarketInAMMTrading(market)) {
            uint baseOdds = _obtainOdds(market, position);
            if (baseOdds > 0) {
                baseOdds = floorBaseOdds(baseOdds, market);
                _quote = _buyFromAmmQuoteWithBaseOdds(
                    market,
                    position,
                    amount,
                    baseOdds,
                    safeBoxImpact,
                    0,
                    false,
                    true,
                    _getDoubleChanceStruct(market)
                );
            }
        }
    }

    function _buyFromAmmQuoteWithBaseOdds(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint baseOdds,
        uint useSafeBoxSkewImpact,
        uint available,
        bool useAvailable,
        bool useDefaultMinSpread,
        DoubleChanceStruct memory dcs
    ) internal view returns (uint returnQuote) {
        if (dcs.isDoubleChance) {
            returnQuote = _buyFromAMMQuoteDoubleChance(
                market,
                position,
                amount,
                useSafeBoxSkewImpact,
                useDefaultMinSpread,
                dcs
            );
        } else {
            returnQuote = _buyFromAmmQuoteWithBaseOddsInternal(
                market,
                position,
                amount,
                baseOdds,
                useSafeBoxSkewImpact,
                available,
                useAvailable,
                useDefaultMinSpread
            );
        }
    }

    function _buyFromAmmQuoteWithBaseOddsInternal(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint baseOdds,
        uint useSafeBoxSkewImpact,
        uint available,
        bool useAvailable,
        bool useDefaultMinSpread
    ) internal view returns (uint returnQuote) {
        if (!useAvailable) {
            available = availableToBuyFromAMMWithBaseOdds(market, position, baseOdds, 0, false);
        }
        if (amount <= available) {
            uint _availableOtherSide = _getAvailableOtherSide(market, position);
            int skewImpact = _buyPriceImpact(market, position, amount, available, _availableOtherSide);
            baseOdds = (baseOdds * (ONE + _getMinSpreadToUse(useDefaultMinSpread, market))) / ONE;

            int tempQuote = sportAmmUtils.calculateTempQuote(skewImpact, baseOdds, useSafeBoxSkewImpact, amount);
            returnQuote = ISportPositionalMarketManager(manager).transformCollateral(uint(tempQuote));
        }
    }

    function _buyFromAMMQuoteDoubleChance(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint useSafeBoxSkewImpact,
        bool useDefaultMinSpread,
        DoubleChanceStruct memory dcs
    ) internal view returns (uint returnQuote) {
        if (position == ISportsAMM.Position.Home) {
            (uint baseOdds1, uint baseOdds2) = sportAmmUtils.getBaseOddsForDoubleChance(market, _minOddsForMarket(market));

            if (baseOdds1 > 0 && baseOdds2 > 0) {
                uint firstQuote = _buyFromAmmQuoteWithBaseOddsInternal(
                    dcs.parentMarket,
                    dcs.position1,
                    amount,
                    baseOdds1,
                    useSafeBoxSkewImpact,
                    0,
                    false,
                    useDefaultMinSpread
                );
                uint secondQuote = _buyFromAmmQuoteWithBaseOddsInternal(
                    dcs.parentMarket,
                    dcs.position2,
                    amount,
                    baseOdds2,
                    useSafeBoxSkewImpact,
                    0,
                    false,
                    useDefaultMinSpread
                );

                if (firstQuote > 0 && secondQuote > 0) {
                    returnQuote = firstQuote + secondQuote;
                }
            }
        }
    }

    function _getAvailableOtherSide(address market, ISportsAMM.Position position)
        internal
        view
        returns (uint _availableOtherSide)
    {
        ISportsAMM.Position positionFirst = ISportsAMM.Position((uint(position) + 1) % 3);
        ISportsAMM.Position positionSecond = ISportsAMM.Position((uint(position) + 2) % 3);

        _availableOtherSide = _getAvailableHigherForPositions(market, positionFirst, positionSecond, false);
    }

    function floorBaseOdds(uint baseOdds, address market) public view returns (uint) {
        uint minOdds = _minOddsForMarket(market);
        return baseOdds < minOdds ? minOdds : baseOdds;
    }

    function _getAvailableHigherForPositions(
        address market,
        ISportsAMM.Position positionFirst,
        ISportsAMM.Position positionSecond,
        bool inverse
    ) internal view returns (uint) {
        (uint cap, uint maxSpreadForMarket, uint minOddsForMarket) = riskManager.getCapMaxSpreadAndMinOddsForMarket(
            market,
            max_spread,
            minSupportedOdds
        );
        return
            sportAmmUtils.getAvailableHigherForPositions(
                SportsAMMUtils.AvailableHigher(
                    market,
                    positionFirst,
                    positionSecond,
                    inverse,
                    liquidityPool.getMarketPool(market),
                    minOddsForMarket,
                    cap,
                    maxSpreadForMarket,
                    spentOnGame[market]
                )
            );
    }

    /// @notice Calculate the sUSD cost to buy an amount of available position options from AMM for specific market/game
    /// @param market The address of the SportPositional market of a game
    /// @param position The position (home/away/draw) quoted to buy from AMM
    /// @param amount The position amount quoted to buy from AMM
    /// @return _quote The sUSD cost for buying the `amount` of `position` options (tokens) from AMM for `market`.
    function buyFromAmmQuoteForParlayAMM(
        address market,
        ISportsAMM.Position position,
        uint amount
    ) external view returns (uint _quote) {
        uint baseOdds = _obtainOdds(market, position);
        baseOdds = floorBaseOdds(baseOdds, market);
        _quote = _buyFromAmmQuoteWithBaseOdds(
            market,
            position,
            amount,
            baseOdds,
            0,
            0,
            false,
            true,
            _getDoubleChanceStruct(market)
        );
    }

    /// @notice Calculate the sUSD cost to buy an amount of available position options from AMM for specific market/game
    /// @param market The address of the SportPositional market of a game
    /// @param position The position (home/away/draw) quoted to buy from AMM
    /// @param amount The position amount quoted to buy from AMM
    /// @param collateral The position amount quoted to buy from AMM
    /// @return collateralQuote The sUSD cost for buying the `amount` of `position` options (tokens) from AMM for `market`.
    /// @return sUSDToPay The sUSD cost for buying the `amount` of `position` options (tokens) from AMM for `market`.
    function buyFromAmmQuoteWithDifferentCollateral(
        address market,
        ISportsAMM.Position position,
        uint amount,
        address collateral
    ) public view returns (uint collateralQuote, uint sUSDToPay) {
        sUSDToPay = buyFromAmmQuote(market, position, amount);
        collateralQuote = multiCollateralOnOffRamp.getMinimumNeeded(collateral, sUSDToPay);
    }

    /// @notice Calculates the buy price impact for given position amount. Changes with every new purchase.
    /// @param market The address of the SportPositional market of a game
    /// @param position The position (home/away/draw) for which the buy price impact is calculated
    /// @param amount The position amount to calculate the buy price impact
    /// @return impact The buy price impact after the buy of the amount of positions for market
    function buyPriceImpact(
        address market,
        ISportsAMM.Position position,
        uint amount
    ) public view returns (int impact) {
        if (ISportPositionalMarketManager(manager).isDoubleChanceMarket(market)) {
            if (position == ISportsAMM.Position.Home) {
                impact = sportAmmUtils.getParentMarketPositionsImpactDoubleChance(market, amount);
            }
        } else {
            uint _availableToBuyFromAMM = availableToBuyFromAMM(market, position);
            uint _availableOtherSide = _getAvailableOtherSide(market, position);
            if (amount > 0 && amount <= _availableToBuyFromAMM) {
                impact = _buyPriceImpact(market, position, amount, _availableToBuyFromAMM, _availableOtherSide);
            }
        }
    }

    /// @notice Obtains the oracle odds for `_position` of a given `_market` game. Odds do not contain price impact
    /// @param _market The address of the SportPositional market of a game
    /// @param _position The position (home/away/draw) to get the odds
    /// @return oddsToReturn The oracle odds for `_position` of a `_market`
    function obtainOdds(address _market, ISportsAMM.Position _position) external view returns (uint oddsToReturn) {
        oddsToReturn = _obtainOdds(_market, _position);
    }

    /// @notice Checks if a `market` is active for AMM trading
    /// @param market The address of the SportPositional market of a game
    /// @return isTrading Returns true if market is active, returns false if not active.
    function isMarketInAMMTrading(address market) public view returns (bool isTrading) {
        if (ISportPositionalMarketManager(manager).isActiveMarket(market)) {
            (uint maturity, ) = ISportPositionalMarket(market).times();
            if (maturity >= block.timestamp) {
                isTrading = (maturity - block.timestamp) > minimalTimeLeftToMaturity;
            }
        }
    }

    /// @notice Checks the default odds for a `_market`. These odds take into account the price impact.
    /// @param _market The address of the SportPositional market of a game
    /// @return odds Returns the default odds for the `_market` including the price impact.
    function getMarketDefaultOdds(address _market, bool isSell) public view returns (uint[] memory odds) {
        odds = new uint[](ISportPositionalMarket(_market).optionsCount());
        for (uint i = 0; i < odds.length; i++) {
            odds[i] = buyFromAmmQuote(_market, ISportsAMM.Position(i), ONE);
        }
    }

    // write methods

    /// @notice Buy amount of position for market/game from AMM using different collateral
    /// @param market The address of the SportPositional market of a game
    /// @param position The position (home/away/draw) to buy from AMM
    /// @param amount The position amount to buy from AMM
    /// @param expectedPayout The amount expected to pay in sUSD for the amount of position. Obtained by buyAMMQuote.
    /// @param additionalSlippage The slippage percentage for the payout
    /// @param collateral The address of the collateral used
    /// @param _referrer who referred the buyer to SportsAMM
    function buyFromAMMWithDifferentCollateralAndReferrer(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        address collateral,
        address _referrer
    ) public nonReentrant whenNotPaused {
        if (_referrer != address(0)) {
            IReferrals(referrals).setReferrer(_referrer, msg.sender);
        }
        _buyFromAMMWithDifferentCollateral(market, position, amount, expectedPayout, additionalSlippage, collateral, false);
    }

    /// @notice Buy amount of position for market/game from AMM using different collateral
    /// @param market The address of the SportPositional market of a game
    /// @param position The position (home/away/draw) to buy from AMM
    /// @param amount The position amount to buy from AMM
    /// @param expectedPayout The amount expected to pay in sUSD for the amount of position. Obtained by buyAMMQuote.
    /// @param additionalSlippage The slippage percentage for the payout
    /// @param collateral The address of the collateral used
    function buyFromAMMWithDifferentCollateral(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        address collateral
    ) public nonReentrant whenNotPaused {
        _buyFromAMMWithDifferentCollateral(market, position, amount, expectedPayout, additionalSlippage, collateral, false);
    }

    /// @notice Buy amount of position for market/game from AMM using ETH
    /// @param market The address of the SportPositional market of a game
    /// @param position The position (home/away/draw) to buy from AMM
    /// @param amount The position amount to buy from AMM
    /// @param expectedPayout The amount expected to pay in sUSD for the amount of position. Obtained by buyAMMQuote.
    /// @param additionalSlippage The slippage percentage for the payout
    /// @param collateral The address of the collateral used
    /// @param _referrer who referred the buyer to SportsAMM
    function buyFromAMMWithEthAndReferrer(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        address collateral,
        address _referrer
    ) external payable nonReentrant whenNotPaused {
        if (_referrer != address(0)) {
            IReferrals(referrals).setReferrer(_referrer, msg.sender);
        }
        _buyFromAMMWithDifferentCollateral(market, position, amount, expectedPayout, additionalSlippage, collateral, true);
    }

    /// @notice Buy amount of position for market/game from AMM using sUSD
    /// @param market The address of the SportPositional market of a game
    /// @param position The position (home/away/draw) to buy from AMM
    /// @param amount The position amount to buy from AMM
    /// @param expectedPayout The sUSD amount expected to pay for buyuing the position amount. Obtained by buyAMMQuote.
    /// @param additionalSlippage The slippage percentage for the payout
    function buyFromAMM(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) public nonReentrant whenNotPaused {
        _buyFromAMM(BuyFromAMMParams(market, position, amount, expectedPayout, additionalSlippage, true, 0));
    }

    /// @notice Buy amount of position for market/game from AMM using sUSD
    /// @param market The address of the SportPositional market of a game
    /// @param position The position (home/away/draw) to buy from AMM
    /// @param amount The position amount to buy from AMM
    /// @param expectedPayout The sUSD amount expected to pay for buying the position amount. Obtained by buyAMMQuote.
    /// @param additionalSlippage The slippage percentage for the payout
    function buyFromAMMWithReferrer(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        address _referrer
    ) public nonReentrant whenNotPaused {
        if (_referrer != address(0)) {
            IReferrals(referrals).setReferrer(_referrer, msg.sender);
        }
        _buyFromAMM(BuyFromAMMParams(market, position, amount, expectedPayout, additionalSlippage, true, 0));
    }

    function exerciseWithOfframp(
        address market,
        address collateral,
        bool toEth
    ) external nonReentrant whenNotPaused {
        require(ISportPositionalMarketManager(manager).isKnownMarket(market), "unknown market");

        (IPosition home, IPosition away, IPosition draw) = ISportPositionalMarket(market).getOptions();
        require(address(home) != address(0), "0A");
        (uint homeBalance, uint awayBalance, uint drawBalance) = ISportPositionalMarket(market).balancesOf(msg.sender);

        _sendFromIfNotZero(msg.sender, address(home), address(this), homeBalance);
        _sendFromIfNotZero(msg.sender, address(away), address(this), awayBalance);
        _sendFromIfNotZero(msg.sender, address(draw), address(this), drawBalance);

        uint amountBefore = sUSD.balanceOf(address(this));

        ISportPositionalMarket(market).exerciseOptions();

        uint amountDiff = sUSD.balanceOf(address(this)) - amountBefore;
        uint offramped;

        if (amountDiff > 0) {
            if (toEth) {
                offramped = multiCollateralOnOffRamp.offrampIntoEth(amountDiff);
                bool sent = payable(msg.sender).send(offramped);
                require(sent, "Failed to send Ether");
            } else {
                offramped = multiCollateralOnOffRamp.offramp(collateral, amountDiff);
                IERC20Upgradeable(collateral).safeTransfer(msg.sender, offramped);
            }
        }
        emit ExercisedWithOfframp(msg.sender, market, collateral, toEth, amountDiff, offramped);
    }

    // setters
    /// @notice Setting all key parameters for AMM
    /// @param _minimalTimeLeftToMaturity The time period in seconds.
    /// @param _minSpread Minimum spread percentage expressed in ether unit (uses 18 decimals -> 1% = 0.01*1e18)
    /// @param _maxSpread Maximum spread percentage expressed in ether unit (uses 18 decimals -> 1% = 0.01*1e18)
    /// @param _minSupportedOdds Minimal oracle odd in ether unit (18 decimals)
    /// @param _maxSupportedOdds Maximum oracle odds in ether unit (18 decimals)
    /// @param _safeBoxImpact Percentage expressed in ether unit (uses 18 decimals -> 1% = 0.01*1e18)
    /// @param _referrerFee how much of a fee to pay to referrers
    function setParameters(
        uint _minimalTimeLeftToMaturity,
        uint _minSpread,
        uint _maxSpread,
        uint _minSupportedOdds,
        uint _maxSupportedOdds,
        uint _safeBoxImpact,
        uint _referrerFee,
        uint _threshold
    ) external onlyOwner {
        minimalTimeLeftToMaturity = _minimalTimeLeftToMaturity;
        min_spread = _minSpread;
        max_spread = _maxSpread;
        minSupportedOdds = _minSupportedOdds;
        maxSupportedOdds = _maxSupportedOdds;
        safeBoxImpact = _safeBoxImpact;
        thresholdForOddsUpdate = _threshold;

        emit ParametersUpdated(
            _minimalTimeLeftToMaturity,
            _minSpread,
            _maxSpread,
            _minSupportedOdds,
            _maxSupportedOdds,
            _safeBoxImpact,
            _referrerFee,
            _threshold
        );
    }

    /// @notice Setting the main addresses for SportsAMM
    /// @param _safeBox Address of the Safe Box
    /// @param _sUSD Address of the sUSD
    /// @param _theRundownConsumer Address of Therundown consumer
    /// @param _stakingThales Address of Staking contract
    /// @param _referrals contract for referrals storage
    /// @param _wrapper contract for calling wrapper contract
    /// @param _lp contract for managing liquidity pools
    function setAddresses(
        address _safeBox,
        IERC20Upgradeable _sUSD,
        address _theRundownConsumer,
        IStakingThales _stakingThales,
        address _referrals,
        address _parlayAMM,
        address _wrapper,
        address _lp,
        address _riskManager
    ) external onlyOwner {
        safeBox = _safeBox;
        sUSD = _sUSD;
        theRundownConsumer = _theRundownConsumer;
        stakingThales = _stakingThales;
        referrals = _referrals;
        parlayAMM = _parlayAMM;
        wrapper = ITherundownConsumerWrapper(_wrapper);
        liquidityPool = SportAMMLiquidityPool(_lp);
        riskManager = ISportAMMRiskManager(_riskManager);

        emit AddressesUpdated(
            _safeBox,
            _sUSD,
            _theRundownConsumer,
            _stakingThales,
            _referrals,
            _parlayAMM,
            _wrapper,
            _lp,
            _riskManager
        );
    }

    /// @notice Setting the Sport Positional Manager contract address
    /// @param _manager Address of Staking contract
    function setSportsPositionalMarketManager(address _manager) external onlyOwner {
        if (address(_manager) != address(0)) {
            sUSD.approve(address(_manager), 0);
        }
        manager = _manager;
        sUSD.approve(manager, MAX_APPROVAL);
        emit SetSportsPositionalMarketManager(_manager);
    }

    /// @notice Updates contract parametars
    /// @param _address which has a specific safe box fee
    /// @param newSBFee the SafeBox fee for address
    /// @param newMSFee the min_spread fee for address
    function setSafeBoxFeeAndMinSpreadPerAddress(
        address _address,
        uint newSBFee,
        uint newMSFee
    ) external onlyOwner {
        safeBoxFeePerAddress[_address] = newSBFee;
        min_spreadPerAddress[_address] = newMSFee;
    }

    function setPaused(bool _setPausing) external onlyOwner {
        _setPausing ? _pause() : _unpause();
    }

    /// @notice used to update gamified Staking bonuses from Parlay contract
    /// @param _account Address to update volume for
    /// @param _amount of the volume
    function updateParlayVolume(address _account, uint _amount) external {
        require(msg.sender == parlayAMM, "Invalid caller");
        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(_account, _amount);
        }
    }

    /// @notice Updates contract parametars
    /// @param _ammUtils address of AMMUtils
    function setAmmUtils(SportsAMMUtils _ammUtils) external onlyOwner {
        sportAmmUtils = _ammUtils;
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

    // Internal

    function _buyFromAMMWithDifferentCollateral(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        address collateral,
        bool isEth
    ) internal {
        (uint collateralQuote, uint susdQuote) = buyFromAmmQuoteWithDifferentCollateral(
            market,
            position,
            amount,
            collateral
        );

        require((collateralQuote * ONE) / (expectedPayout) <= (ONE + additionalSlippage), "Slippage too high!");

        uint exactReceived;

        if (isEth) {
            require(collateral == multiCollateralOnOffRamp.WETH9(), "Wrong collateral sent");
            exactReceived = multiCollateralOnOffRamp.onrampWithEth{value: collateralQuote}(collateralQuote);
        } else {
            IERC20Upgradeable(collateral).safeTransferFrom(msg.sender, address(this), collateralQuote);
            IERC20Upgradeable(collateral).approve(address(multiCollateralOnOffRamp), collateralQuote);
            exactReceived = multiCollateralOnOffRamp.onramp(collateral, collateralQuote);
        }

        require(exactReceived >= susdQuote, "Not enough sUSD received");

        //send the surplus to SB
        if (exactReceived > susdQuote) {
            sUSD.safeTransfer(safeBox, exactReceived - susdQuote);
        }

        return _buyFromAMM(BuyFromAMMParams(market, position, amount, susdQuote, additionalSlippage, false, susdQuote));
    }

    function _buyFromAMM(BuyFromAMMParams memory params) internal {
        _checkMarketValidityAndOptionsCount(params.market, params.position);

        DoubleChanceStruct memory dcs = _getDoubleChanceStruct(params.market);
        require(!dcs.isDoubleChance || params.position == ISportsAMM.Position.Home, "Invalid pos");

        uint baseOdds = _obtainOdds(params.market, params.position);
        require(baseOdds > 0, "No base odds");
        baseOdds = floorBaseOdds(baseOdds, params.market);

        uint availableInContract = sportAmmUtils.balanceOfPositionOnMarket(
            params.market,
            params.position,
            liquidityPool.getMarketPool(params.market)
        );
        uint availableToBuyFromAMMatm = _availableToBuyFromAMMInternal(
            params.market,
            params.position,
            baseOdds,
            availableInContract,
            true,
            dcs
        );

        require(params.amount > ZERO_POINT_ONE && params.amount <= availableToBuyFromAMMatm, "Low liquidity || 0");

        if (params.sendSUSD) {
            params.sUSDPaid = _buyFromAmmQuoteWithBaseOdds(
                params.market,
                params.position,
                params.amount,
                baseOdds,
                _getSafeBoxFeePerAddress(msg.sender),
                availableToBuyFromAMMatm,
                true,
                false,
                dcs
            );
            require((params.sUSDPaid * ONE) / params.expectedPayout <= (ONE + params.additionalSlippage), "High slippage");
            sUSD.safeTransferFrom(msg.sender, address(this), params.sUSDPaid);
        }

        address parent = dcs.isDoubleChance || ISportPositionalMarket(params.market).isChild()
            ? address(ISportPositionalMarket(params.market).parentMarket())
            : params.market;

        if (dcs.isDoubleChance) {
            ISportPositionalMarket(params.market).mint(params.amount);
            _mintParentPositions(params.market, params.amount, dcs);

            (address parentMarketPosition1, address parentMarketPosition2) = sportAmmUtils.getParentMarketPositionAddresses(
                params.market
            );

            _getDoubleChanceOptions(params.amount, parentMarketPosition1, params.market);
            _getDoubleChanceOptions(params.amount, parentMarketPosition2, params.market);

            IERC20Upgradeable(parentMarketPosition1).safeTransfer(params.market, params.amount);
            IERC20Upgradeable(parentMarketPosition2).safeTransfer(params.market, params.amount);
        } else {
            uint toMint = availableInContract < params.amount ? params.amount - availableInContract : 0;
            if (toMint > 0) {
                liquidityPool.commitTrade(params.market, toMint);
                ISportPositionalMarket(params.market).mint(toMint);
                spentOnGame[params.market] += toMint;
                spentOnParent[parent] += toMint;
            }
            liquidityPool.getOptionsForBuy(params.market, params.amount - toMint, params.position);
            if (params.amount > toMint) {
                uint discountedAmount = params.amount - toMint;
                uint paidForDiscountedAmount = (params.sUSDPaid * discountedAmount) / params.amount;
                emit BoughtWithDiscount(msg.sender, discountedAmount, paidForDiscountedAmount);
            }
        }

        (IPosition home, IPosition away, IPosition draw) = ISportPositionalMarket(params.market).getOptions();
        IPosition target = params.position == ISportsAMM.Position.Home ? home : params.position == ISportsAMM.Position.Away
            ? away
            : draw;
        IERC20Upgradeable(address(target)).safeTransfer(msg.sender, params.amount);

        if (
            !dcs.isDoubleChance && thresholdForOddsUpdate > 0 && (params.amount - params.sUSDPaid) >= thresholdForOddsUpdate
        ) {
            ISportPositionalMarket sportMarket = ISportPositionalMarket(params.market);
            uint tag2 = sportMarket.isChild() ? sportMarket.tags(1) : 0;
            if (tag2 == TAG_NUMBER_PLAYERS) {
                wrapper.callUpdateOddsForSpecificPlayerProps(params.market);
            } else {
                wrapper.callUpdateOddsForSpecificGame(params.market);
            }
        }

        _updateSpentOnMarketOnBuy(dcs.isDoubleChance ? parent : params.market, parent, params.sUSDPaid, msg.sender);

        require(riskManager.isTotalSpendingLessThanTotalRisk(spentOnParent[parent], parent), "Risk is to high!");

        _sendMintedPositionsAndUSDToLiquidityPool(dcs.isDoubleChance ? parent : params.market);

        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(msg.sender, params.sUSDPaid);
        }

        emit BoughtFromAmm(
            msg.sender,
            params.market,
            params.position,
            params.amount,
            params.sUSDPaid,
            address(sUSD),
            address(target)
        );
    }

    function _getDoubleChanceOptions(
        uint amount,
        address position,
        address market
    ) internal {
        uint balanceHeld = IERC20Upgradeable(position).balanceOf(address(this));
        if (amount > balanceHeld) {
            liquidityPool.getOptionsForBuyByAddress(
                address(ISportPositionalMarket(market).parentMarket()),
                amount - balanceHeld,
                position
            );
        }
    }

    function _availableToBuyFromAMMInternal(
        address market,
        ISportsAMM.Position position,
        uint baseOdds,
        uint balance,
        bool useBalance,
        DoubleChanceStruct memory dcs
    ) internal view returns (uint _available) {
        if (dcs.isDoubleChance) {
            if (position == ISportsAMM.Position.Home && (baseOdds > 0 && baseOdds < maxSupportedOdds)) {
                _available = _getAvailableHigherForPositions(dcs.parentMarket, dcs.position1, dcs.position2, true);
            }
        } else {
            baseOdds = floorBaseOdds(baseOdds, market);
            _available = availableToBuyFromAMMWithBaseOdds(market, position, baseOdds, balance, useBalance);
        }
    }

    function availableToBuyFromAMMWithBaseOdds(
        address market,
        ISportsAMM.Position position,
        uint baseOdds,
        uint balance,
        bool useBalance
    ) public view returns (uint availableAmount) {
        if (baseOdds > 0 && baseOdds < maxSupportedOdds) {
            baseOdds = (baseOdds * (ONE + min_spread)) / ONE;
            balance = useBalance
                ? balance
                : sportAmmUtils.balanceOfPositionOnMarket(market, position, liquidityPool.getMarketPool(market));

            (uint cap, uint maxSpreadForMarket) = riskManager.getCapAndMaxSpreadForMarket(market, max_spread);
            availableAmount = sportAmmUtils.calculateAvailableToBuy(
                cap,
                spentOnGame[market],
                baseOdds,
                balance,
                maxSpreadForMarket
            );
        }
    }

    function _obtainOdds(address _market, ISportsAMM.Position _position) internal view returns (uint) {
        if (ISportPositionalMarketManager(manager).isDoubleChanceMarket(_market)) {
            if (_position == ISportsAMM.Position.Home) {
                return sportAmmUtils.getBaseOddsForDoubleChanceSum(_market, _minOddsForMarket(_market));
            }
        }
        return sportAmmUtils.obtainOdds(_market, _position);
    }

    function _checkMarketValidityAndOptionsCount(address market, ISportsAMM.Position position) internal view {
        require(isMarketInAMMTrading(market), "Not trading");
        uint optionsCount = ISportPositionalMarket(market).optionsCount();
        require(optionsCount > uint(position), "Invalid pos");
    }

    function _getMinSpreadToUse(bool useDefaultMinSpread, address market) internal view returns (uint) {
        return riskManager.getMinSpreadToUse(useDefaultMinSpread, market, min_spread, min_spreadPerAddress[msg.sender]);
    }

    function _getSafeBoxFeePerAddress(address toCheck) internal view returns (uint toReturn) {
        if (toCheck != parlayAMM) {
            return safeBoxFeePerAddress[toCheck] > 0 ? safeBoxFeePerAddress[toCheck] : safeBoxImpact;
        }
    }

    function _minOddsForMarket(address _market) internal view returns (uint minOdds) {
        minOdds = riskManager.getMinOddsForMarket(_market, minSupportedOdds);
    }

    function _maxSpreadForMarket(address _market) internal view returns (uint maxSpread) {
        maxSpread = riskManager.getMaxSpreadForMarket(_market, max_spread);
    }

    function _sendMintedPositionsAndUSDToLiquidityPool(address market) internal {
        address _liquidityPool = liquidityPool.getOrCreateMarketPool(market);

        _sendIfNotZero(address(sUSD), _liquidityPool, sUSD.balanceOf(address(this)));

        (IPosition home, IPosition away, IPosition draw) = ISportPositionalMarket(market).getOptions();
        require(address(home) != address(0), "0A");

        (uint homeBalance, uint awayBalance, uint drawBalance) = ISportPositionalMarket(market).balancesOf(address(this));

        _sendIfNotZero(address(home), _liquidityPool, homeBalance);
        _sendIfNotZero(address(away), _liquidityPool, awayBalance);
        _sendIfNotZero(address(draw), _liquidityPool, drawBalance);
    }

    function _sendIfNotZero(
        address source,
        address target,
        uint balance
    ) internal {
        if (balance > 0) {
            IERC20Upgradeable(source).safeTransfer(target, balance);
        }
    }

    function _sendFromIfNotZero(
        address from,
        address source,
        address target,
        uint balance
    ) internal {
        if (balance > 0) {
            IERC20Upgradeable(source).safeTransferFrom(from, target, balance);
        }
    }

    function _updateSpentOnMarketOnBuy(
        address market,
        address parent,
        uint sUSDPaid,
        address buyer
    ) internal {
        address referrer = IReferrals(referrals).sportReferrals(buyer);
        uint referrerShare;
        if (referrer != address(0)) {
            uint referrerFeeByTier = IReferrals(referrals).getReferrerFee(referrer);
            if (referrerFeeByTier > 0) {
                referrerShare = (sUSDPaid * referrerFeeByTier) / ONE;
                sUSD.safeTransfer(referrer, referrerShare);
                emit ReferrerPaid(referrer, msg.sender, referrerShare, sUSDPaid);
            }
        }
        uint safeBoxShare;
        uint sbimpact = _getSafeBoxFeePerAddress(buyer);
        if (sbimpact > 0) {
            safeBoxShare = sUSDPaid - (sUSDPaid * ONE) / (ONE + sbimpact);
            sUSD.safeTransfer(safeBox, safeBoxShare - referrerShare);
        }

        uint toSubtract = ISportPositionalMarketManager(manager).reverseTransformCollateral(sUSDPaid - safeBoxShare);

        spentOnGame[market] = spentOnGame[market] <= toSubtract ? 0 : (spentOnGame[market] -= toSubtract);

        spentOnParent[parent] = spentOnParent[parent] <= toSubtract ? 0 : (spentOnParent[parent] -= toSubtract);
    }

    function _buyPriceImpact(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint _availableToBuyFromAMM,
        uint _availableToBuyFromAMMOtherSide
    ) internal view returns (int priceImpact) {
        return
            sportAmmUtils.getBuyPriceImpact(
                SportsAMMUtils.PriceImpactParams(
                    market,
                    position,
                    amount,
                    _availableToBuyFromAMM,
                    _availableToBuyFromAMMOtherSide,
                    liquidityPool,
                    _maxSpreadForMarket(market),
                    _minOddsForMarket(market)
                )
            );
    }

    function _mintParentPositions(
        address market,
        uint amount,
        DoubleChanceStruct memory dcs
    ) internal {
        (uint availableInContract1, uint availableInContract2) = sportAmmUtils.getBalanceOfPositionsOnMarketByPositions(
            dcs.parentMarket,
            liquidityPool.getMarketPool(market),
            dcs.position1,
            dcs.position2
        );

        uint toMintPosition1 = availableInContract1 < amount ? amount - availableInContract1 : 0;
        uint toMintPosition2 = availableInContract2 < amount ? amount - availableInContract2 : 0;

        uint toMint = toMintPosition1 < toMintPosition2 ? toMintPosition2 : toMintPosition1;

        if (toMint > 0) {
            liquidityPool.commitTrade(dcs.parentMarket, toMint);
            ISportPositionalMarket(dcs.parentMarket).mint(toMint);
            spentOnGame[dcs.parentMarket] += toMint;
            spentOnParent[dcs.parentMarket] += toMint;
        }
    }

    function _getDoubleChanceStruct(address market) internal view returns (DoubleChanceStruct memory) {
        if (!ISportPositionalMarketManager(manager).isDoubleChanceMarket(market)) {
            return DoubleChanceStruct(false, ISportsAMM.Position.Home, ISportsAMM.Position.Away, address(0));
        } else {
            (ISportsAMM.Position position1, ISportsAMM.Position position2, address parentMarket) = sportAmmUtils
                .getParentMarketPositions(market);
            return DoubleChanceStruct(true, position1, position2, parentMarket);
        }
    }

    // events
    event BoughtFromAmm(
        address buyer,
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint sUSDPaid,
        address susd,
        address asset
    );

    event ParametersUpdated(
        uint _minimalTimeLeftToMaturity,
        uint _minSpread,
        uint _maxSpread,
        uint _minSupportedOdds,
        uint _maxSupportedOdds,
        uint _safeBoxImpact,
        uint _referrerFee,
        uint threshold
    );
    event AddressesUpdated(
        address _safeBox,
        IERC20Upgradeable _sUSD,
        address _theRundownConsumer,
        IStakingThales _stakingThales,
        address _referrals,
        address _parlayAMM,
        address _wrapper,
        address _lp,
        address _riskManager
    );

    event SetSportsPositionalMarketManager(address _manager);
    event ReferrerPaid(address refferer, address trader, uint amount, uint volume);
    event SetMultiCollateralOnOffRamp(address _onramper, bool enabled);
    event ExercisedWithOfframp(
        address user,
        address market,
        address collateral,
        bool toEth,
        uint payout,
        uint payoutInCollateral
    );
    event BoughtWithDiscount(address buyer, uint amount, uint sUSDPaid);
}

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
import "../interfaces/IApexConsumer.sol";
import "../interfaces/ICurveSUSD.sol";
import "../interfaces/IReferrals.sol";
import "../interfaces/ISportsAMM.sol";
import "../interfaces/ITherundownConsumerWrapper.sol";
import "./SportsAMMUtils.sol";

/// @title Sports AMM contract
/// @author kirilaa
contract SportsAMM is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint private constant ONE = 1e18;
    uint private constant ZERO_POINT_ONE = 1e17;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant MAX_APPROVAL = type(uint256).max;

    /// @return The sUSD contract used for payment
    IERC20Upgradeable public sUSD;

    /// @return The address of the SportsPositionalManager contract
    address public manager;

    /// @notice Each game has `defaultCapPerGame` available for trading
    /// @return The default cap per game.
    uint public defaultCapPerGame;

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

    /// @return The address of the Curve contract for multi-collateral
    ICurveSUSD public curveSUSD;

    /// @return The address of USDC
    address public usdc;

    /// @return The address of USDT (Tether)
    address public usdt;

    /// @return The address of DAI
    address public dai;

    /// @return Curve usage is enabled?
    bool public curveOnrampEnabled;

    /// @return Referrals contract address
    address public referrals;

    /// @return Default referrer fee
    uint public referrerFee;

    /// @return The address of Parlay AMM
    address public parlayAMM;

    /// @return The address of Apex Consumer
    address public apexConsumer;

    /// @return maximum supported discount in percentage on sUSD purchases with different collaterals
    uint public maxAllowedPegSlippagePercentage;

    /// @return the cap per sportID. based on the tagID
    mapping(uint => uint) public capPerSport;

    SportsAMMUtils sportAmmUtils;

    /// @return the cap per market. based on the marketId
    mapping(address => uint) public capPerMarket;

    /// @notice odds threshold which will trigger odds update
    /// @return The threshold.
    uint public thresholdForOddsUpdate;

    /// @return The address of wrapper contract
    ITherundownConsumerWrapper public wrapper;

    // @return specific SafeBoxFee per address
    mapping(address => uint) public safeBoxFeePerAddress;

    // @return specific min_spread per address
    mapping(address => uint) public min_spreadPerAddress;

    /// @notice Initialize the storage in the proxy contract with the parameters.
    /// @param _owner Owner for using the ownerOnly functions
    /// @param _sUSD The payment token (sUSD)
    /// @param _min_spread Minimal spread (percentage)
    /// @param _max_spread Maximum spread (percentage)
    /// @param _minimalTimeLeftToMaturity Period to close AMM trading befor maturity
    function initialize(
        address _owner,
        IERC20Upgradeable _sUSD,
        uint _defaultCapPerGame,
        uint _min_spread,
        uint _max_spread,
        uint _minimalTimeLeftToMaturity
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        sUSD = _sUSD;
        defaultCapPerGame = _defaultCapPerGame;
        min_spread = _min_spread;
        max_spread = _max_spread;
        minimalTimeLeftToMaturity = _minimalTimeLeftToMaturity;
    }

    /// @notice Returns the available position options to buy from AMM for specific market/game
    /// @param market The address of the SportPositional market created for a game
    /// @param position The position (home/away/draw) to check availability
    /// @return _available The amount of position options (tokens) available to buy from AMM.
    function availableToBuyFromAMM(address market, ISportsAMM.Position position) public view returns (uint _available) {
        if (ISportPositionalMarket(market).isDoubleChance()) {
            (ISportsAMM.Position position1, ISportsAMM.Position position2, address parentMarket) = sportAmmUtils
                .getParentMarketPositions(market, position);

            uint availableFirst = availableToBuyFromAMM(parentMarket, position1);
            uint availableSecond = availableToBuyFromAMM(parentMarket, position2);

            _available = availableFirst > availableSecond ? availableSecond : availableFirst;
        } else {
            if (isMarketInAMMTrading(market)) {
                uint baseOdds = _obtainOdds(market, position);
                if (baseOdds > 0) {
                    baseOdds = baseOdds < minSupportedOdds ? minSupportedOdds : baseOdds;
                    _available = _availableToBuyFromAMMWithbaseOdds(market, position, baseOdds);
                }
            }
        }
    }

    function _availableToBuyFromAMMWithbaseOdds(
        address market,
        ISportsAMM.Position position,
        uint baseOdds
    ) internal view returns (uint availableAmount) {
        if (baseOdds > 0 && baseOdds < maxSupportedOdds) {
            baseOdds = baseOdds + min_spread;
            uint balance = sportAmmUtils.balanceOfPositionOnMarket(market, position, address(this));

            availableAmount = sportAmmUtils.calculateAvailableToBuy(
                calculateCapToBeUsed(market),
                spentOnGame[market],
                baseOdds,
                balance
            );
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
                baseOdds = baseOdds < minSupportedOdds ? minSupportedOdds : baseOdds;
                _quote = _buyFromAmmQuoteWithBaseOdds(market, position, amount, baseOdds, safeBoxImpact);
            }
        }
    }

    function _buyFromAmmQuoteWithBaseOdds(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint baseOdds,
        uint useSafeBoxSkewImpact
    ) internal view returns (uint returnQuote) {
        if (ISportPositionalMarket(market).isDoubleChance()) {
            (ISportsAMM.Position position1, ISportsAMM.Position position2, address parentMarket) = sportAmmUtils
                .getParentMarketPositions(market, position);

            (uint baseOdds1, uint baseOdds2) = sportAmmUtils.getBaseOddsForDoubleChance(market, position);

            if (baseOdds1 > 0 && baseOdds2 > 0) {
                baseOdds1 = baseOdds1 < minSupportedOdds ? minSupportedOdds : baseOdds1;
                baseOdds2 = baseOdds2 < minSupportedOdds ? minSupportedOdds : baseOdds2;
                uint firstQuote = _buyFromAmmQuoteWithBaseOdds(
                    parentMarket,
                    position1,
                    amount,
                    baseOdds1,
                    useSafeBoxSkewImpact
                );
                uint secondQuote = _buyFromAmmQuoteWithBaseOdds(
                    parentMarket,
                    position2,
                    amount,
                    baseOdds2,
                    useSafeBoxSkewImpact
                );

                if (firstQuote != 0 && secondQuote != 0) {
                    returnQuote = firstQuote + secondQuote;
                }
            }
        } else {
            uint _available = _availableToBuyFromAMMWithbaseOdds(market, position, baseOdds);
            uint _availableOtherSide = _getAvailableOtherSide(market, position, amount);
            if (amount <= _available) {
                int skewImpact = _buyPriceImpact(market, position, amount, _available, _availableOtherSide);
                baseOdds = baseOdds + (min_spreadPerAddress[msg.sender] > 0 ? min_spreadPerAddress[msg.sender] : min_spread);
                int tempQuote = sportAmmUtils.calculateTempQuote(skewImpact, baseOdds, useSafeBoxSkewImpact, amount);
                returnQuote = ISportPositionalMarketManager(manager).transformCollateral(uint(tempQuote));
            }
        }
    }

    function _getAvailableOtherSide(
        address market,
        ISportsAMM.Position position,
        uint amount
    ) private view returns (uint _availableOtherSide) {
        uint _availableOtherSideFirst = availableToBuyFromAMM(
            market,
            position == ISportsAMM.Position.Home ? ISportsAMM.Position.Draw : position == ISportsAMM.Position.Draw
                ? ISportsAMM.Position.Away
                : ISportsAMM.Position.Home
        );
        uint _availableOtherSideSecond = availableToBuyFromAMM(
            market,
            position == ISportsAMM.Position.Home ? ISportsAMM.Position.Away : position == ISportsAMM.Position.Draw
                ? ISportsAMM.Position.Home
                : ISportsAMM.Position.Draw
        );
        _availableOtherSide = _availableOtherSideFirst > _availableOtherSideSecond
            ? _availableOtherSideFirst
            : _availableOtherSideSecond;
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
    ) public view returns (uint _quote) {
        uint baseOdds = _obtainOdds(market, position);
        baseOdds = (baseOdds > 0 && baseOdds < minSupportedOdds) ? minSupportedOdds : baseOdds;
        _quote = _buyFromAmmQuoteWithBaseOdds(market, position, amount, baseOdds, 0);
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
        int128 curveIndex = _mapCollateralToCurveIndex(collateral);
        if (curveIndex > 0 && curveOnrampEnabled) {
            sUSDToPay = buyFromAmmQuote(market, position, amount);
            //cant get a quote on how much collateral is needed from curve for sUSD,
            //so rather get how much of collateral you get for the sUSD quote and add 0.2% to that
            collateralQuote = (curveSUSD.get_dy_underlying(0, curveIndex, sUSDToPay) * (ONE + (ONE_PERCENT / 5))) / ONE;
        }
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
        if (ISportPositionalMarket(market).isDoubleChance()) {
            (ISportsAMM.Position position1, ISportsAMM.Position position2, address parentMarket) = sportAmmUtils
                .getParentMarketPositions(market, position);

            int firstPriceImpact = buyPriceImpact(parentMarket, position1, amount);
            int secondPriceImpact = buyPriceImpact(parentMarket, position2, amount);

            impact = (firstPriceImpact + secondPriceImpact) / 2;
        } else {
            uint _availableToBuyFromAMM = availableToBuyFromAMM(market, position);
            uint _availableOtherSide = _getAvailableOtherSide(market, position, amount);
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
        isTrading = sportAmmUtils.isMarketInAMMTrading(market);
    }

    /// @notice Checks if a `market` options can be excercised. Winners get the full options amount 1 option = 1 sUSD.
    /// @param market The address of the SportPositional market of a game
    /// @return canExercize true if market can be exercised, returns false market can not be exercised.
    function canExerciseMaturedMarket(address market) public view returns (bool canExercize) {
        canExercize = sportAmmUtils.getCanExercize(market, address(this));
    }

    /// @notice Checks the default odds for a `_market`. These odds take into account the price impact.
    /// @param _market The address of the SportPositional market of a game
    /// @return odds Returns the default odds for the `_market` including the price impact.
    function getMarketDefaultOdds(address _market, bool isSell) public view returns (uint[] memory odds) {
        odds = new uint[](ISportPositionalMarket(_market).optionsCount());
        if (isMarketInAMMTrading(_market)) {
            ISportsAMM.Position position;
            for (uint i = 0; i < odds.length; i++) {
                if (i == 0) {
                    position = ISportsAMM.Position.Home;
                } else if (i == 1) {
                    position = ISportsAMM.Position.Away;
                } else {
                    position = ISportsAMM.Position.Draw;
                }
                odds[i] = buyFromAmmQuote(_market, position, ONE);
            }
        }
    }

    /// @notice Get sUSD amount bought from AMM by users for the market
    /// @param market address of the market
    /// @return uint
    function getSpentOnGame(address market) public view returns (uint) {
        return spentOnGame[market];
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
        _buyFromAMMWithDifferentCollateral(market, position, amount, expectedPayout, additionalSlippage, collateral);
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
        _buyFromAMMWithDifferentCollateral(market, position, amount, expectedPayout, additionalSlippage, collateral);
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
        _buyFromAMM(market, position, amount, expectedPayout, additionalSlippage, true, 0);
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
        _buyFromAMM(market, position, amount, expectedPayout, additionalSlippage, true, 0);
    }

    function _buyFromAMMWithDifferentCollateral(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        address collateral
    ) internal {
        int128 curveIndex = _mapCollateralToCurveIndex(collateral);
        require(curveIndex > 0 && curveOnrampEnabled, "unsupported collateral");

        (uint collateralQuote, uint susdQuote) = buyFromAmmQuoteWithDifferentCollateral(
            market,
            position,
            amount,
            collateral
        );

        uint transformedCollateralForPegCheck = collateral == usdc || collateral == usdt
            ? collateralQuote * (1e12)
            : collateralQuote;
        require(
            maxAllowedPegSlippagePercentage > 0 &&
                transformedCollateralForPegCheck >= (susdQuote * (ONE - (maxAllowedPegSlippagePercentage))) / ONE,
            "Amount below max allowed peg slippage"
        );

        require((collateralQuote * ONE) / (expectedPayout) <= (ONE + additionalSlippage), "Slippage too high!");

        IERC20Upgradeable collateralToken = IERC20Upgradeable(collateral);
        collateralToken.safeTransferFrom(msg.sender, address(this), collateralQuote);
        curveSUSD.exchange_underlying(curveIndex, 0, collateralQuote, susdQuote);

        return _buyFromAMM(market, position, amount, susdQuote, additionalSlippage, false, susdQuote);
    }

    function _buyFromAMM(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        bool sendSUSD,
        uint sUSDPaid
    ) internal {
        require(isMarketInAMMTrading(market), "Not in Trading");
        require(ISportPositionalMarket(market).optionsCount() > uint(position), "Invalid position");

        uint baseOdds = _obtainOdds(market, position);

        require(baseOdds > 0, "No base odds");

        baseOdds = baseOdds < minSupportedOdds ? minSupportedOdds : baseOdds;

        uint availableToBuyFromAMMatm = availableToBuyFromAMM(market, position);
        require(amount > ZERO_POINT_ONE && amount <= availableToBuyFromAMMatm, "Low liquidity || 0 amount");

        if (sendSUSD) {
            if (msg.sender == parlayAMM) {
                sUSDPaid = _buyFromAmmQuoteWithBaseOdds(market, position, amount, baseOdds, 0);
            } else {
                sUSDPaid = _buyFromAmmQuoteWithBaseOdds(
                    market,
                    position,
                    amount,
                    baseOdds,
                    safeBoxFeePerAddress[msg.sender] > 0 ? safeBoxFeePerAddress[msg.sender] : safeBoxImpact
                );
            }
            require((sUSDPaid * ONE) / (expectedPayout) <= (ONE + additionalSlippage), "Slippage too high");
            sUSD.safeTransferFrom(msg.sender, address(this), sUSDPaid);
        }

        uint toMint = _getMintableAmount(market, position, amount);
        if (toMint > 0) {
            require(
                sUSD.balanceOf(address(this)) >= ISportPositionalMarketManager(manager).transformCollateral(toMint),
                "Low contract sUSD"
            );
            if (ISportPositionalMarket(market).isDoubleChance()) {
                ISportPositionalMarket parentMarket = ISportPositionalMarket(market).parentMarket();

                ISportPositionalMarket(market).mint(toMint);
                parentMarket.mint(toMint);

                (address parentMarketPosition1, address parentMarketPosition2) = sportAmmUtils
                    .getParentMarketPositionAddresses(parentMarket, position);

                IERC20Upgradeable(parentMarketPosition1).safeTransfer(market, amount);
                IERC20Upgradeable(parentMarketPosition2).safeTransfer(market, amount);
            } else {
                ISportPositionalMarket(market).mint(toMint);
            }
            spentOnGame[market] = spentOnGame[market] + toMint;
        }

        (IPosition home, IPosition away, IPosition draw) = ISportPositionalMarket(market).getOptions();
        IPosition target = position == ISportsAMM.Position.Home ? home : away;
        if (ISportPositionalMarket(market).optionsCount() > 2 && position != ISportsAMM.Position.Home) {
            target = position == ISportsAMM.Position.Away ? away : draw;
        }

        IERC20Upgradeable(address(target)).safeTransfer(msg.sender, amount);

        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(msg.sender, sUSDPaid);
        }
        if (
            !ISportPositionalMarket(market).isDoubleChance() &&
            thresholdForOddsUpdate > 0 &&
            (amount - sUSDPaid) >= thresholdForOddsUpdate
        ) {
            wrapper.callUpdateOddsForSpecificGame(market);
        }
        _updateSpentOnMarketOnBuy(market, sUSDPaid, msg.sender);

        emit BoughtFromAmm(msg.sender, market, position, amount, sUSDPaid, address(sUSD), address(target));
    }

    function exerciseMaturedMarket(address market) external {
        require(canExerciseMaturedMarket(market), "No options to exercise");
        ISportPositionalMarket(market).exerciseOptions();
    }

    // setters
    /// @notice Setting all key parameters for AMM
    /// @param _minimalTimeLeftToMaturity The time period in seconds.
    /// @param _minSpread Minimum spread percentage expressed in ether unit (uses 18 decimals -> 1% = 0.01*1e18)
    /// @param _maxSpread Maximum spread percentage expressed in ether unit (uses 18 decimals -> 1% = 0.01*1e18)
    /// @param _minSupportedOdds Minimal oracle odd in ether unit (18 decimals)
    /// @param _maxSupportedOdds Maximum oracle odds in ether unit (18 decimals)
    /// @param _defaultCapPerGame Default sUSD cap per market (18 decimals)
    /// @param _safeBoxImpact Percentage expressed in ether unit (uses 18 decimals -> 1% = 0.01*1e18)
    /// @param _referrerFee how much of a fee to pay to referrers
    function setParameters(
        uint _minimalTimeLeftToMaturity,
        uint _minSpread,
        uint _maxSpread,
        uint _minSupportedOdds,
        uint _maxSupportedOdds,
        uint _defaultCapPerGame,
        uint _safeBoxImpact,
        uint _referrerFee
    ) external onlyOwner {
        minimalTimeLeftToMaturity = _minimalTimeLeftToMaturity;
        min_spread = _minSpread;
        max_spread = _maxSpread;
        minSupportedOdds = _minSupportedOdds;
        maxSupportedOdds = _maxSupportedOdds;
        defaultCapPerGame = _defaultCapPerGame;
        safeBoxImpact = _safeBoxImpact;
        referrerFee = _referrerFee;

        emit ParametersUpdated(
            _minimalTimeLeftToMaturity,
            _minSpread,
            _maxSpread,
            _minSupportedOdds,
            _maxSupportedOdds,
            _defaultCapPerGame,
            _safeBoxImpact,
            _referrerFee
        );
    }

    /// @notice Setting the main addresses for SportsAMM
    /// @param _safeBox Address of the Safe Box
    /// @param _sUSD Address of the sUSD
    /// @param _theRundownConsumer Address of Therundown consumer
    /// @param _apexConsumer Address of Apex consumer
    /// @param _stakingThales Address of Staking contract
    /// @param _referrals contract for referrals storage
    /// @param _wrapper contract for calling wrapper contract
    function setAddresses(
        address _safeBox,
        IERC20Upgradeable _sUSD,
        address _theRundownConsumer,
        address _apexConsumer,
        IStakingThales _stakingThales,
        address _referrals,
        address _parlayAMM,
        address _wrapper
    ) external onlyOwner {
        safeBox = _safeBox;
        sUSD = _sUSD;
        theRundownConsumer = _theRundownConsumer;
        apexConsumer = _apexConsumer;
        stakingThales = _stakingThales;
        referrals = _referrals;
        parlayAMM = _parlayAMM;
        wrapper = ITherundownConsumerWrapper(_wrapper);

        emit AddressesUpdated(
            _safeBox,
            _sUSD,
            _theRundownConsumer,
            _apexConsumer,
            _stakingThales,
            _referrals,
            _parlayAMM,
            _wrapper
        );
    }

    /// @notice Setting the Sport Positional Manager contract address
    /// @param _manager Address of Staking contract
    function setSportsPositionalMarketManager(address _manager) public onlyOwner {
        if (address(_manager) != address(0)) {
            sUSD.approve(address(_manager), 0);
        }
        manager = _manager;
        sUSD.approve(manager, MAX_APPROVAL);
        emit SetSportsPositionalMarketManager(_manager);
    }

    /// @notice Updates contract parametars
    /// @param _address which has a specific safe box fee
    /// @param newFee the fee
    function setSafeBoxFeePerAddress(address _address, uint newFee) external onlyOwner {
        safeBoxFeePerAddress[_address] = newFee;
    }

    /// @notice Updates contract parametars
    /// @param _address which has a specific min_spread fee
    /// @param newFee the fee
    function setMinSpreadPerAddress(address _address, uint newFee) external onlyOwner {
        min_spreadPerAddress[_address] = newFee;
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

    function setPaused(bool _setPausing) external onlyOwner {
        if (_setPausing) {
            _pause();
        } else {
            _unpause();
        }
    }

    /// @notice Setting the Cap per Sport ID
    /// @param _sportID The tagID used for each market
    /// @param _capPerSport The cap amount used for the sportID
    function setCapPerSport(uint _sportID, uint _capPerSport) external onlyOwner {
        capPerSport[_sportID] = _capPerSport;
        emit SetCapPerSport(_sportID, _capPerSport);
    }

    /// @notice Setting default odds updater treshold amount for payment
    /// @param _threshold amount
    function setThresholdForOddsUpdate(uint _threshold) external onlyOwner {
        thresholdForOddsUpdate = _threshold;
        emit SetThresholdForOddsUpdate(_threshold);
    }

    /// @notice Setting the Cap per spec. market
    /// @param _markets market addresses
    /// @param _capPerMarket The cap amount used for the specific markets
    function setCapPerMarket(address[] memory _markets, uint _capPerMarket) external {
        require(
            msg.sender == owner || ISportPositionalMarketManager(manager).isWhitelistedAddress(msg.sender),
            "Invalid sender"
        );
        require(_capPerMarket < defaultCapPerGame * 2, "Must be less then double default");
        for (uint i; i < _markets.length; i++) {
            capPerMarket[_markets[i]] = _capPerMarket;
            emit SetCapPerMarket(_markets[i], _capPerMarket);
        }
    }

    // Internal

    function _obtainOdds(address _market, ISportsAMM.Position _position) internal view returns (uint) {
        if (ISportPositionalMarket(_market).isDoubleChance()) {
            (uint oddsPosition1, uint oddsPosition2) = sportAmmUtils.getBaseOddsForDoubleChance(_market, _position);

            return oddsPosition1 + oddsPosition2;
        }
        return sportAmmUtils.obtainOdds(_market, _position);
    }

    function calculateCapToBeUsed(address market) public view returns (uint) {
        if (capPerMarket[market] == 0) {
            if (ITherundownConsumer(theRundownConsumer).isChildMarket(market)) {
                return
                    capPerSport[ISportPositionalMarket(market).tags(1)] > 0
                        ? capPerSport[ISportPositionalMarket(market).tags(1)]
                        : defaultCapPerGame;
            }
            return
                capPerSport[ISportPositionalMarket(market).tags(0)] > 0
                    ? capPerSport[ISportPositionalMarket(market).tags(0)]
                    : defaultCapPerGame;
        }
        return capPerMarket[market];
    }

    function _updateSpentOnMarketOnBuy(
        address market,
        uint sUSDPaid,
        address buyer
    ) internal {
        uint safeBoxShare;
        if (safeBoxImpact > 0 && buyer != parlayAMM) {
            safeBoxShare =
                sUSDPaid -
                (sUSDPaid * ONE) /
                (ONE + (safeBoxFeePerAddress[msg.sender] > 0 ? safeBoxFeePerAddress[msg.sender] : safeBoxImpact));
            sUSD.safeTransfer(safeBox, safeBoxShare);
        }

        if (
            spentOnGame[market] <=
            ISportPositionalMarketManager(manager).reverseTransformCollateral(sUSDPaid - (safeBoxShare))
        ) {
            spentOnGame[market] = 0;
        } else {
            spentOnGame[market] =
                spentOnGame[market] -
                (ISportPositionalMarketManager(manager).reverseTransformCollateral(sUSDPaid - (safeBoxShare)));
        }

        if (referrerFee > 0 && referrals != address(0)) {
            uint referrerShare = sUSDPaid - ((sUSDPaid * ONE) / (ONE + (referrerFee)));
            _handleReferrer(buyer, referrerShare, sUSDPaid);
        }
    }

    function _buyPriceImpact(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint _availableToBuyFromAMM,
        uint _availableToBuyFromAMMOtherSide
    ) internal view returns (int priceImpact) {
        (uint balancePosition, , uint balanceOtherSide) = sportAmmUtils.balanceOfPositionsOnMarket(
            market,
            position,
            address(this)
        );
        bool isTwoPositional = ISportPositionalMarket(market).optionsCount() == 2;
        uint balancePositionAfter = balancePosition > amount ? balancePosition - amount : 0;
        uint balanceOtherSideAfter = balancePosition > amount
            ? balanceOtherSide
            : balanceOtherSide + (amount - balancePosition);
        if (amount <= balancePosition) {
            priceImpact = sportAmmUtils.calculateDiscount(
                SportsAMMUtils.DiscountParams(balancePosition, balanceOtherSide, amount, _availableToBuyFromAMMOtherSide)
            );
        } else {
            if (balancePosition > 0) {
                uint pricePosition = _obtainOdds(market, position);
                uint priceOtherPosition = isTwoPositional
                    ? _obtainOdds(
                        market,
                        position == ISportsAMM.Position.Home ? ISportsAMM.Position.Away : ISportsAMM.Position.Home
                    )
                    : ONE - pricePosition;
                priceImpact = sportAmmUtils.calculateDiscountFromNegativeToPositive(
                    SportsAMMUtils.NegativeDiscountsParams(
                        amount,
                        balancePosition,
                        balanceOtherSide,
                        _availableToBuyFromAMMOtherSide,
                        _availableToBuyFromAMM,
                        pricePosition,
                        priceOtherPosition
                    )
                );
            } else {
                priceImpact = int(
                    sportAmmUtils.buyPriceImpactImbalancedSkew(
                        amount,
                        balanceOtherSide,
                        balancePosition,
                        balanceOtherSideAfter,
                        balancePositionAfter,
                        _availableToBuyFromAMM
                    )
                );
            }
        }
    }

    function _handleReferrer(
        address buyer,
        uint referrerShare,
        uint volume
    ) internal {
        address referrer = IReferrals(referrals).sportReferrals(buyer);
        if (referrer != address(0) && referrerFee > 0) {
            sUSD.safeTransfer(referrer, referrerShare);
            emit ReferrerPaid(referrer, buyer, referrerShare, volume);
        }
    }

    function _getMintableAmount(
        address market,
        ISportsAMM.Position position,
        uint amount
    ) internal view returns (uint mintable) {
        if (ISportPositionalMarket(market).isDoubleChance()) {
            mintable = amount;
        } else {
            uint availableInContract = sportAmmUtils.balanceOfPositionOnMarket(market, position, address(this));
            if (availableInContract < amount) {
                mintable = amount - availableInContract;
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

    function updateParlayVolume(address _account, uint _amount) external {
        require(msg.sender == parlayAMM, "Invalid caller");
        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(_account, _amount);
        }
    }

    /// @notice Retrive all sUSD funds of the SportsAMM contract, in case of destroying
    /// @param account Address where to send the funds
    /// @param amount Amount of sUSD to be sent
    function retrieveSUSDAmount(address payable account, uint amount) external onlyOwner {
        sUSD.safeTransfer(account, amount);
    }

    /// @notice Updates contract parametars
    /// @param _ammUtils address of AMMUtils
    function setAmmUtils(SportsAMMUtils _ammUtils) external onlyOwner {
        sportAmmUtils = _ammUtils;
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
        uint _defaultCapPerGame,
        uint _safeBoxImpact,
        uint _referrerFee
    );
    event AddressesUpdated(
        address _safeBox,
        IERC20Upgradeable _sUSD,
        address _theRundownConsumer,
        address _apexConsumer,
        IStakingThales _stakingThales,
        address _referrals,
        address _parlayAMM,
        address _wrapper
    );

    event SetSportsPositionalMarketManager(address _manager);
    event ReferrerPaid(address refferer, address trader, uint amount, uint volume);
    event SetCapPerSport(uint _sport, uint _cap);
    event SetCapPerMarket(address _market, uint _cap);
    event SetThresholdForOddsUpdate(uint _threshold);
}

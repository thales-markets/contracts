// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
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

/// @title Sports AMM contract
/// @author kirilaa
contract SportsAMM is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    using SafeMathUpgradeable for uint;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct GameOdds {
        bytes32 gameId;
        int24 homeOdds;
        int24 awayOdds;
        int24 drawOdds;
    }

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

    /// @return The address of Apex Consumer
    address public apexConsumer;

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
    function availableToBuyFromAMM(address market, Position position) public view returns (uint _available) {
        if (isMarketInAMMTrading(market)) {
            uint baseOdds = obtainOdds(market, position);
            // ignore extremes
            if (baseOdds <= minSupportedOdds || baseOdds >= maxSupportedOdds) {
                return 0;
            }
            baseOdds = baseOdds.add(min_spread);
            uint balance = _balanceOfPositionOnMarket(market, position);
            uint midImpactPriceIncrease = ONE.sub(baseOdds).mul(max_spread.div(2)).div(ONE);

            uint divider_price = ONE.sub(baseOdds.add(midImpactPriceIncrease));

            uint additionalBufferFromSelling = balance.mul(baseOdds).div(ONE);

            if (defaultCapPerGame.add(additionalBufferFromSelling) <= spentOnGame[market]) {
                return 0;
            }
            uint availableUntilCapSUSD = defaultCapPerGame.add(additionalBufferFromSelling).sub(spentOnGame[market]);

            _available = balance.add(availableUntilCapSUSD.mul(ONE).div(divider_price));
        }
    }

    /// @notice Calculate the sUSD cost to buy an amount of available position options from AMM for specific market/game
    /// @param market The address of the SportPositional market of a game
    /// @param position The position (home/away/draw) quoted to buy from AMM
    /// @param amount The position amount quoted to buy from AMM
    /// @return The sUSD cost for buying the `amount` of `position` options (tokens) from AMM for `market`.
    function buyFromAmmQuote(
        address market,
        Position position,
        uint amount
    ) public view returns (uint) {
        if (amount < 1 || amount > availableToBuyFromAMM(market, position)) {
            return 0;
        }
        uint baseOdds = obtainOdds(market, position).add(min_spread);
        uint impactPriceIncrease = ONE.sub(baseOdds).mul(_buyPriceImpact(market, position, amount)).div(ONE);
        // add 2% to the price increase to avoid edge cases on the extremes
        impactPriceIncrease = impactPriceIncrease.mul(ONE.add(ONE_PERCENT * 2)).div(ONE);
        uint tempAmount = amount.mul(baseOdds.add(impactPriceIncrease)).div(ONE);
        uint returnQuote = tempAmount.mul(ONE.add(safeBoxImpact)).div(ONE);
        return ISportPositionalMarketManager(manager).transformCollateral(returnQuote);
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
        Position position,
        uint amount,
        address collateral
    ) public view returns (uint collateralQuote, uint sUSDToPay) {
        int128 curveIndex = _mapCollateralToCurveIndex(collateral);
        if (curveIndex == 0 || !curveOnrampEnabled) {
            return (0, 0);
        }

        sUSDToPay = buyFromAmmQuote(market, position, amount);
        //cant get a quote on how much collateral is needed from curve for sUSD,
        //so rather get how much of collateral you get for the sUSD quote and add 0.2% to that
        collateralQuote = curveSUSD.get_dy_underlying(0, curveIndex, sUSDToPay).mul(ONE.add(ONE_PERCENT.div(5))).div(ONE);
    }

    /// @notice Calculates the buy price impact for given position amount. Changes with every new purchase.
    /// @param market The address of the SportPositional market of a game
    /// @param position The position (home/away/draw) for which the buy price impact is calculated
    /// @param amount The position amount to calculate the buy price impact
    /// @return The buy price impact after the buy of the amount of positions for market
    function buyPriceImpact(
        address market,
        Position position,
        uint amount
    ) public view returns (uint) {
        if (amount < 1 || amount > availableToBuyFromAMM(market, position)) {
            return 0;
        }
        return _buyPriceImpact(market, position, amount);
    }

    /// @notice Calculate the maximum position amount available to sell to AMM for specific market/game
    /// @param market The address of the SportPositional market of a game
    /// @param position The position (home/away/draw) to sell to AMM
    /// @return The maximum amount available to be sold to AMM
    function availableToSellToAMM(address market, Position position) public view returns (uint) {
        if (isMarketInAMMTrading(market)) {
            uint sell_max_price = _getSellMaxPrice(market, position);
            if (sell_max_price == 0) {
                return 0;
            }
            (IPosition home, IPosition away, IPosition draw) = ISportPositionalMarket(market).getOptions();
            uint balanceOfTheOtherSide = position == Position.Home
                ? away.getBalanceOf(address(this))
                : home.getBalanceOf(address(this));

            // Balancing with three positions needs to be elaborated
            if (ISportPositionalMarket(market).optionsCount() == 3) {
                uint homeBalance = home.getBalanceOf(address(this));
                uint awayBalance = away.getBalanceOf(address(this));
                uint drawBalance = draw.getBalanceOf(address(this));
                if (position == Position.Home) {
                    balanceOfTheOtherSide = awayBalance < drawBalance ? awayBalance : drawBalance;
                } else if (position == Position.Away) {
                    balanceOfTheOtherSide = homeBalance < drawBalance ? homeBalance : drawBalance;
                } else {
                    balanceOfTheOtherSide = homeBalance < awayBalance ? homeBalance : awayBalance;
                }
            }

            // can burn straight away balanceOfTheOtherSide
            uint willPay = balanceOfTheOtherSide.mul(sell_max_price).div(ONE);
            uint capPlusBalance = defaultCapPerGame.add(balanceOfTheOtherSide);
            if (capPlusBalance < spentOnGame[market].add(willPay)) {
                return 0;
            }
            uint usdAvailable = capPlusBalance.sub(spentOnGame[market]).sub(willPay);
            return usdAvailable.div(sell_max_price).mul(ONE).add(balanceOfTheOtherSide);
        } else return 0;
    }

    function _getSellMaxPrice(address market, Position position) internal view returns (uint sell_max_price) {
        uint baseOdds = obtainOdds(market, position);
        // ignore extremes
        if (baseOdds <= minSupportedOdds || baseOdds >= maxSupportedOdds) {
            return 0;
        }
        sell_max_price = baseOdds.sub(min_spread).mul(ONE.sub(max_spread.div(2))).div(ONE);
    }

    /// @notice Calculate the sUSD to receive for selling the position amount to AMM for specific market/game
    /// @param market The address of the SportPositional market of a game
    /// @param position The position (home/away/draw) to sell to AMM
    /// @param amount The position amount to sell to AMM
    /// @return The sUSD to receive for the `amount` of `position` options if sold to AMM for `market`
    function sellToAmmQuote(
        address market,
        Position position,
        uint amount
    ) public view returns (uint) {
        if (amount > availableToSellToAMM(market, position)) {
            return 0;
        }
        uint baseOdds = obtainOdds(market, position).sub(min_spread);

        uint tempAmount = amount.mul(baseOdds.mul(ONE.sub(_sellPriceImpact(market, position, amount))).div(ONE)).div(ONE);

        uint returnQuote = tempAmount.mul(ONE.sub(safeBoxImpact)).div(ONE);
        return ISportPositionalMarketManager(manager).transformCollateral(returnQuote);
    }

    /// @notice Calculates the sell price impact for given position amount. Changes with every new sell.
    /// @param market The address of the SportPositional market of a game
    /// @param position The position (home/away/draw) to sell to AMM
    /// @param amount The position amount to sell to AMM
    /// @return The price impact after selling the position amount to AMM
    function sellPriceImpact(
        address market,
        Position position,
        uint amount
    ) public view returns (uint) {
        if (amount > availableToSellToAMM(market, position)) {
            return 0;
        }
        return _sellPriceImpact(market, position, amount);
    }

    /// @notice Obtains the oracle odds for `_position` of a given `_market` game. Odds do not contain price impact
    /// @param _market The address of the SportPositional market of a game
    /// @param _position The position (home/away/draw) to get the odds
    /// @return The oracle odds for `_position` of a `_market`
    function obtainOdds(address _market, Position _position) public view returns (uint) {
        bytes32 gameId = ISportPositionalMarket(_market).getGameId();
        if (ISportPositionalMarket(_market).optionsCount() > uint(_position)) {
            uint[] memory odds = new uint[](ISportPositionalMarket(_market).optionsCount());
            bool isApexGame = IApexConsumer(apexConsumer).isApexGame(gameId);
            odds = isApexGame
                ? IApexConsumer(apexConsumer).getNormalizedOdds(gameId)
                : ITherundownConsumer(theRundownConsumer).getNormalizedOdds(gameId);
            return odds[uint(_position)];
        } else {
            return 0;
        }
    }

    /// @notice Checks if a `market` is active for AMM trading
    /// @param market The address of the SportPositional market of a game
    /// @return Returns true if market is active, returns false if not active.
    function isMarketInAMMTrading(address market) public view returns (bool) {
        if (ISportPositionalMarketManager(manager).isActiveMarket(market)) {
            (uint maturity, ) = ISportPositionalMarket(market).times();
            if (maturity < block.timestamp) {
                return false;
            }

            uint timeLeftToMaturity = maturity - block.timestamp;
            return timeLeftToMaturity > minimalTimeLeftToMaturity;
        } else {
            return false;
        }
    }

    /// @notice Checks if a `market` options can be excercised. Winners get the full options amount 1 option = 1 sUSD.
    /// @param market The address of the SportPositional market of a game
    /// @return Returns true if market can be exercised, returns false market can not be exercised.
    function canExerciseMaturedMarket(address market) public view returns (bool) {
        if (
            ISportPositionalMarketManager(manager).isKnownMarket(market) &&
            !ISportPositionalMarket(market).paused() &&
            ISportPositionalMarket(market).resolved()
        ) {
            (IPosition home, IPosition away, IPosition draw) = ISportPositionalMarket(market).getOptions();
            if (
                (home.getBalanceOf(address(this)) > 0) ||
                (away.getBalanceOf(address(this)) > 0) ||
                (ISportPositionalMarket(market).optionsCount() > 2 && draw.getBalanceOf(address(this)) > 0)
            ) {
                return true;
            }
        }
        return false;
    }

    /// @notice Checks the default odds for a `_market`. These odds take into account the price impact.
    /// @param _market The address of the SportPositional market of a game
    /// @param isSell The address of the SportPositional market of a game
    /// @return Returns the default odds for the `_market` including the price impact.
    function getMarketDefaultOdds(address _market, bool isSell) public view returns (uint[] memory) {
        uint[] memory odds = new uint[](ISportPositionalMarket(_market).optionsCount());
        if (isMarketInAMMTrading(_market)) {
            Position position;
            for (uint i = 0; i < odds.length; i++) {
                if (i == 0) {
                    position = Position.Home;
                } else if (i == 1) {
                    position = Position.Away;
                } else {
                    position = Position.Draw;
                }
                if (isSell) {
                    odds[i] = sellToAmmQuote(_market, position, ONE);
                } else {
                    odds[i] = buyFromAmmQuote(_market, position, ONE);
                }
            }
        }
        return odds;
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
        Position position,
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
        Position position,
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
        Position position,
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
    /// @param expectedPayout The sUSD amount expected to pay for buyuing the position amount. Obtained by buyAMMQuote.
    /// @param additionalSlippage The slippage percentage for the payout
    function buyFromAMMWithReferrer(
        address market,
        Position position,
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
        Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        address collateral
    ) internal {
        int128 curveIndex = _mapCollateralToCurveIndex(collateral);
        require(curveIndex > 0 && curveOnrampEnabled, "Unsupported collateral");

        (uint collateralQuote, uint susdQuote) = buyFromAmmQuoteWithDifferentCollateral(
            market,
            position,
            amount,
            collateral
        );

        require(collateralQuote.mul(ONE).div(expectedPayout) <= ONE.add(additionalSlippage), "Slippage too high!");

        IERC20Upgradeable collateralToken = IERC20Upgradeable(collateral);
        collateralToken.safeTransferFrom(msg.sender, address(this), collateralQuote);
        curveSUSD.exchange_underlying(curveIndex, 0, collateralQuote, susdQuote);

        _buyFromAMM(market, position, amount, susdQuote, additionalSlippage, false, susdQuote);
    }

    function _buyFromAMM(
        address market,
        Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        bool sendSUSD,
        uint sUSDPaid
    ) internal {
        require(isMarketInAMMTrading(market), "Market is not in Trading phase");
        require(ISportPositionalMarket(market).optionsCount() > uint(position), "Invalid position");
        uint availableToBuyFromAMMatm = availableToBuyFromAMM(market, position);
        require(amount > ZERO_POINT_ONE && amount <= availableToBuyFromAMMatm, "Not enough liquidity or zero amount.");

        if (sendSUSD) {
            sUSDPaid = buyFromAmmQuote(market, position, amount);
            require(sUSD.balanceOf(msg.sender) >= sUSDPaid, "You dont have enough sUSD.");
            require(sUSD.allowance(msg.sender, address(this)) >= sUSDPaid, "No allowance.");
            require(sUSDPaid.mul(ONE).div(expectedPayout) <= ONE.add(additionalSlippage), "Slippage too high");
            sUSD.safeTransferFrom(msg.sender, address(this), sUSDPaid);
        }

        uint toMint = _getMintableAmount(market, position, amount);
        if (toMint > 0) {
            require(
                sUSD.balanceOf(address(this)) >= ISportPositionalMarketManager(manager).transformCollateral(toMint),
                "Not enough sUSD in contract."
            );
            ISportPositionalMarket(market).mint(toMint);
            spentOnGame[market] = spentOnGame[market].add(toMint);
        }
        (IPosition home, IPosition away, IPosition draw) = ISportPositionalMarket(market).getOptions();
        IPosition target = position == Position.Home ? home : away;
        if (ISportPositionalMarket(market).optionsCount() > 2 && position != Position.Home) {
            target = position == Position.Away ? away : draw;
        }

        IERC20Upgradeable(address(target)).safeTransfer(msg.sender, amount);

        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(msg.sender, sUSDPaid);
        }
        _updateSpentOnMarketOnBuy(market, sUSDPaid, msg.sender);

        emit BoughtFromAmm(msg.sender, market, position, amount, sUSDPaid, address(sUSD), address(target));
    }

    /// @notice Sell amount of position for market/game to AMM
    /// @param market The address of the SportPositional market of a game
    /// @param position The position (home/away/draw) to buy from AMM
    /// @param amount The position amount to buy from AMM
    /// @param expectedPayout The sUSD amount expected to receive for selling the position amount. Obtained by sellToAMMQuote.
    /// @param additionalSlippage The slippage percentage for the payout
    function sellToAMM(
        address market,
        Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) public nonReentrant whenNotPaused {
        require(isMarketInAMMTrading(market), "Market is not in Trading phase");
        require(ISportPositionalMarket(market).optionsCount() > uint(position), "Invalid position");
        uint availableToSellToAMMATM = availableToSellToAMM(market, position);
        require(
            availableToSellToAMMATM > 0 && amount > ZERO_POINT_ONE && amount <= availableToSellToAMMATM,
            "Not enough liquidity or zero amount.."
        );

        uint pricePaid = sellToAmmQuote(market, position, amount);
        require(expectedPayout.mul(ONE).div(pricePaid) <= (ONE.add(additionalSlippage)), "Slippage too high");

        (IPosition home, IPosition away, IPosition draw) = ISportPositionalMarket(market).getOptions();
        IPosition target = position == Position.Home ? home : away;
        if (ISportPositionalMarket(market).optionsCount() > 2 && position != Position.Home) {
            target = position == Position.Away ? away : draw;
        }

        require(target.getBalanceOf(msg.sender) >= amount, "You dont have enough options.");
        require(IERC20Upgradeable(address(target)).allowance(msg.sender, address(this)) >= amount, "No allowance.");

        //transfer options first to have max burn available
        IERC20Upgradeable(address(target)).safeTransferFrom(msg.sender, address(this), amount);
        uint sUSDFromBurning = ISportPositionalMarketManager(manager).transformCollateral(
            ISportPositionalMarket(market).getMaximumBurnable(address(this))
        );
        if (sUSDFromBurning > 0) {
            ISportPositionalMarket(market).burnOptionsMaximum();
        }

        require(sUSD.balanceOf(address(this)) >= pricePaid, "Not enough sUSD in contract.");

        sUSD.safeTransfer(msg.sender, pricePaid);

        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(msg.sender, pricePaid);
        }
        _updateSpentOnMarketOnSell(market, pricePaid, sUSDFromBurning, msg.sender);

        emit SoldToAMM(msg.sender, market, position, amount, pricePaid, address(sUSD), address(target));
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
    function setAddresses(
        address _safeBox,
        IERC20Upgradeable _sUSD,
        address _theRundownConsumer,
        address _apexConsumer,
        IStakingThales _stakingThales,
        address _referrals
    ) external onlyOwner {
        safeBox = _safeBox;
        sUSD = _sUSD;
        theRundownConsumer = _theRundownConsumer;
        apexConsumer = _apexConsumer;
        stakingThales = _stakingThales;
        referrals = _referrals;

        emit AddressesUpdated(_safeBox, _sUSD, _theRundownConsumer, _apexConsumer, _stakingThales, _referrals);
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

    /// @notice Setting the Curve collateral addresses for all collaterals
    /// @param _curveSUSD Address of the Curve contract
    /// @param _dai Address of the DAI contract
    /// @param _usdc Address of the USDC contract
    /// @param _usdt Address of the USDT (Tether) contract
    /// @param _curveOnrampEnabled Enabling or restricting the use of multicollateral
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
        IERC20Upgradeable(dai).approve(_curveSUSD, MAX_APPROVAL);
        IERC20Upgradeable(usdc).approve(_curveSUSD, MAX_APPROVAL);
        IERC20Upgradeable(usdt).approve(_curveSUSD, MAX_APPROVAL);
        // not needed unless selling into different collateral is enabled
        //sUSD.approve(_curveSUSD, MAX_APPROVAL);
        curveOnrampEnabled = _curveOnrampEnabled;
    }

    // Internal

    function _updateSpentOnMarketOnSell(
        address market,
        uint sUSDPaid,
        uint sUSDFromBurning,
        address seller
    ) internal {
        uint safeBoxShare = sUSDPaid.mul(ONE).div(ONE.sub(safeBoxImpact)).sub(sUSDPaid);

        if (safeBoxImpact > 0) {
            sUSD.safeTransfer(safeBox, safeBoxShare);
        } else {
            safeBoxShare = 0;
        }

        spentOnGame[market] = spentOnGame[market].add(
            ISportPositionalMarketManager(manager).reverseTransformCollateral(sUSDPaid.add(safeBoxShare))
        );
        if (spentOnGame[market] <= ISportPositionalMarketManager(manager).reverseTransformCollateral(sUSDFromBurning)) {
            spentOnGame[market] = 0;
        } else {
            spentOnGame[market] = spentOnGame[market].sub(
                ISportPositionalMarketManager(manager).reverseTransformCollateral(sUSDFromBurning)
            );
        }
        if (referrerFee > 0 && referrals != address(0)) {
            uint referrerShare = sUSDPaid.mul(ONE).div(ONE.sub(referrerFee)).sub(sUSDPaid);
            _handleReferrer(seller, referrerShare, sUSDPaid);
        }
    }

    function _updateSpentOnMarketOnBuy(
        address market,
        uint sUSDPaid,
        address buyer
    ) internal {
        uint safeBoxShare = sUSDPaid.sub(sUSDPaid.mul(ONE).div(ONE.add(safeBoxImpact)));
        if (safeBoxImpact > 0) {
            sUSD.safeTransfer(safeBox, safeBoxShare);
        } else {
            safeBoxShare = 0;
        }
        if (
            spentOnGame[market] <=
            ISportPositionalMarketManager(manager).reverseTransformCollateral(sUSDPaid.sub(safeBoxShare))
        ) {
            spentOnGame[market] = 0;
        } else {
            spentOnGame[market] = spentOnGame[market].sub(
                ISportPositionalMarketManager(manager).reverseTransformCollateral(sUSDPaid.sub(safeBoxShare))
            );
        }
        if (referrerFee > 0 && referrals != address(0)) {
            uint referrerShare = sUSDPaid.sub(sUSDPaid.mul(ONE).div(ONE.add(referrerFee)));
            _handleReferrer(buyer, referrerShare, sUSDPaid);
        }
    }

    function _buyPriceImpact(
        address market,
        Position position,
        uint amount
    ) internal view returns (uint _buyPrice) {
        // take the balanceOtherSideMaximum
        (uint balancePosition, uint balanceOtherSide, ) = _balanceOfPositionsOnMarket(market, position);
        uint balancePositionAfter = balancePosition > amount ? balancePosition.sub(amount) : 0;
        uint balanceOtherSideAfter = balancePosition > amount
            ? balanceOtherSide
            : balanceOtherSide.add(amount.sub(balancePosition));

        if (!(balancePosition >= amount)) {
            _buyPrice = _buyPriceImpactElse(
                market,
                position,
                amount,
                balanceOtherSide,
                balancePosition,
                balanceOtherSideAfter,
                balancePositionAfter
            );
        }
    }

    function _buyPriceImpactElse(
        address market,
        Position position,
        uint amount,
        uint balanceOtherSide,
        uint balancePosition,
        uint balanceOtherSideAfter,
        uint balancePositionAfter
    ) internal view returns (uint) {
        uint maxPossibleSkew = balanceOtherSide.add(availableToBuyFromAMM(market, position)).sub(balancePosition);
        uint skew = balanceOtherSideAfter.sub(balancePositionAfter);
        uint newImpact = max_spread.mul(skew.mul(ONE).div(maxPossibleSkew)).div(ONE);
        if (balancePosition > 0) {
            if (balancePosition > amount) {
                return 0;
            }
            uint newPriceForMintedOnes = newImpact.div(2);
            uint tempMultiplier = amount.sub(balancePosition).mul(newPriceForMintedOnes);
            return tempMultiplier.div(amount);
        } else {
            uint previousSkew = balanceOtherSide;
            uint previousImpact = max_spread.mul(previousSkew.mul(ONE).div(maxPossibleSkew)).div(ONE);
            return newImpact.add(previousImpact).div(2);
        }
    }

    function _sellPriceImpact(
        address market,
        Position position,
        uint amount
    ) internal view returns (uint) {
        // take the balanceOtherSideMinimum
        (uint balancePosition, , uint balanceOtherSide) = _balanceOfPositionsOnMarket(market, position);
        uint balancePositionAfter = balancePosition > 0 ? balancePosition.add(amount) : balanceOtherSide > amount
            ? 0
            : amount.sub(balanceOtherSide);
        uint balanceOtherSideAfter = balanceOtherSide > amount ? balanceOtherSide.sub(amount) : 0;
        if (balancePositionAfter < balanceOtherSideAfter) {
            //minimal price impact as it will balance the AMM exposure
            return 0;
        } else {
            return
                _sellPriceImpactElse(
                    market,
                    position,
                    amount,
                    balanceOtherSide,
                    balancePosition,
                    balanceOtherSideAfter,
                    balancePositionAfter
                );
        }
    }

    function _sellPriceImpactElse(
        address market,
        Position position,
        uint amount,
        uint balanceOtherSide,
        uint balancePosition,
        uint balanceOtherSideAfter,
        uint balancePositionAfter
    ) internal view returns (uint) {
        uint maxPossibleSkew = balancePosition.add(availableToSellToAMM(market, position)).sub(balanceOtherSide);
        uint skew = balancePositionAfter.sub(balanceOtherSideAfter);
        uint newImpact = max_spread.mul(skew.mul(ONE).div(maxPossibleSkew)).div(ONE);

        if (balanceOtherSide > 0) {
            uint newPriceForMintedOnes = newImpact.div(2);
            uint tempMultiplier = amount.sub(balancePosition).mul(newPriceForMintedOnes);
            return tempMultiplier.div(amount);
        } else {
            uint previousSkew = balancePosition;
            uint previousImpact = max_spread.mul(previousSkew.mul(ONE).div(maxPossibleSkew)).div(ONE);
            return newImpact.add(previousImpact).div(2);
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
        Position position,
        uint amount
    ) internal view returns (uint mintable) {
        uint availableInContract = _balanceOfPositionOnMarket(market, position);
        if (availableInContract < amount) {
            mintable = amount.sub(availableInContract);
        }
    }

    function _balanceOfPositionOnMarket(address market, Position position) internal view returns (uint) {
        (IPosition home, IPosition away, IPosition draw) = ISportPositionalMarket(market).getOptions();
        uint balance = position == Position.Home ? home.getBalanceOf(address(this)) : away.getBalanceOf(address(this));
        if (ISportPositionalMarket(market).optionsCount() == 3 && position != Position.Home) {
            balance = position == Position.Away ? away.getBalanceOf(address(this)) : draw.getBalanceOf(address(this));
        }
        return balance;
    }

    function _balanceOfPositionsOnMarket(address market, Position position)
        internal
        view
        returns (
            uint,
            uint,
            uint
        )
    {
        (IPosition home, IPosition away, IPosition draw) = ISportPositionalMarket(market).getOptions();
        uint balance = position == Position.Home ? home.getBalanceOf(address(this)) : away.getBalanceOf(address(this));
        uint balanceOtherSideMax = position == Position.Home
            ? away.getBalanceOf(address(this))
            : home.getBalanceOf(address(this));
        uint balanceOtherSideMin = balanceOtherSideMax;
        if (ISportPositionalMarket(market).optionsCount() == 3) {
            uint homeBalance = home.getBalanceOf(address(this));
            uint awayBalance = away.getBalanceOf(address(this));
            uint drawBalance = draw.getBalanceOf(address(this));
            if (position == Position.Home) {
                balance = homeBalance;
                if (awayBalance < drawBalance) {
                    balanceOtherSideMax = drawBalance;
                    balanceOtherSideMin = awayBalance;
                } else {
                    balanceOtherSideMax = awayBalance;
                    balanceOtherSideMin = drawBalance;
                }
            } else if (position == Position.Away) {
                balance = awayBalance;
                if (homeBalance < drawBalance) {
                    balanceOtherSideMax = drawBalance;
                    balanceOtherSideMin = homeBalance;
                } else {
                    balanceOtherSideMax = homeBalance;
                    balanceOtherSideMin = drawBalance;
                }
            } else if (position == Position.Draw) {
                balance = drawBalance;
                if (homeBalance < awayBalance) {
                    balanceOtherSideMax = awayBalance;
                    balanceOtherSideMin = homeBalance;
                } else {
                    balanceOtherSideMax = homeBalance;
                    balanceOtherSideMin = awayBalance;
                }
            }
        }
        return (balance, balanceOtherSideMax, balanceOtherSideMin);
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

    /// @notice Retrive all sUSD funds of the SportsAMM contract, in case of destroying
    /// @param account Address where to send the funds
    /// @param amount Amount of sUSD to be sent
    function retrieveSUSDAmount(address payable account, uint amount) external onlyOwner {
        sUSD.safeTransfer(account, amount);
    }

    // events
    event SoldToAMM(
        address seller,
        address market,
        Position position,
        uint amount,
        uint sUSDPaid,
        address susd,
        address asset
    );
    event BoughtFromAmm(
        address buyer,
        address market,
        Position position,
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
        address _referrals
    );

    event SetSportsPositionalMarketManager(address _manager);
    event ReferrerPaid(address refferer, address trader, uint amount, uint volume);
}

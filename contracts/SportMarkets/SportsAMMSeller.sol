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
import "../interfaces/ISportsAMM.sol";
import "../interfaces/ISportsAMMSeller.sol";
import "../interfaces/ITherundownConsumerWrapper.sol";
import "./SportsAMMUtils.sol";

/// @title Sports AMM seller
contract SportsAMMSeller is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint private constant ONE = 1e18;
    uint private constant ZERO_POINT_ONE = 1e17;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant MAX_APPROVAL = type(uint256).max;

    /// @return The sUSD contract used for payment
    IERC20Upgradeable public sUSD;

    /// @return The address of the SportsPositionalManager contract
    address public manager;

    enum Position {
        Home,
        Away,
        Draw
    }

    /// @return The SafeBox address
    address public safeBox;

    /// @return The address of Therundown Consumer
    address public theRundownConsumer;

    /// @return The address of Apex Consumer
    address public apexConsumer;

    SportsAMMUtils public sportAmmUtils;

    ISportsAMM public sportsAMM;

    /// @return The address of wrapper contract
    ITherundownConsumerWrapper public wrapper;

    /// @notice Initialize the storage in the proxy contract with the parameters.
    /// @param _owner Owner for using the ownerOnly functions
    /// @param _sUSD The payment token (sUSD)
    function initialize(
        address _owner,
        IERC20Upgradeable _sUSD,
        address _sportsAMM
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        sUSD = _sUSD;

        sportsAMM = ISportsAMM(_sportsAMM);
    }

    function _getSellMaxPrice(address market, ISportsAMM.Position position) internal view returns (uint sell_max_price) {
        uint baseOdds = sportsAMM.obtainOdds(market, position);
        uint minSupportedOdds = sportsAMM.minSupportedOdds();
        uint maxSupportedOdds = sportsAMM.maxSupportedOdds();
        uint min_spread = sportsAMM.min_spread();
        uint max_spread = sportsAMM.max_spread();

        if (!(baseOdds <= minSupportedOdds || baseOdds >= maxSupportedOdds)) {
            sell_max_price = ((baseOdds - min_spread) * (ONE - (max_spread / (2)))) / ONE;
        }
    }

    function availableToSellToAMM(address market, ISportsAMM.Position position) public view returns (uint _available) {
        uint sell_max_price = _getSellMaxPrice(market, position);
        if (sell_max_price > 0) {
            (IPosition home, IPosition away, ) = ISportPositionalMarket(market).getOptions();
            uint balanceOfTheOtherSide = position == ISportsAMM.Position.Home
                ? away.getBalanceOf(address(this))
                : home.getBalanceOf(address(this));

            // Balancing with three positions needs to be elaborated
            if (ISportPositionalMarket(market).optionsCount() == 3) {
                balanceOfTheOtherSide = sportAmmUtils.getBalanceOtherSideOnThreePositions(position, address(this), market);
            }

            _available = sportAmmUtils._calculateAvailableToSell(
                balanceOfTheOtherSide,
                sell_max_price,
                sportsAMM.calculateCapToBeUsed(market),
                sportsAMM.getSpentOnGame(market)
            );
        }
    }

    function sellToAmmQuote(
        address market,
        ISportsAMM.Position position,
        uint amount
    ) public view returns (uint _quote) {
        require(!ISportPositionalMarket(market).isDoubleChance(), "Sell not supported for DoubleChance market");
        uint baseOdds = sportsAMM.obtainOdds(market, position);
        uint _available = availableToSellToAMM(market, position);
        _quote = _sellToAmmQuote(market, position, amount, baseOdds, _available);
    }

    function sellPriceImpact(
        address market,
        ISportsAMM.Position position,
        uint amount
    ) public view returns (uint _impact) {
        uint _available = availableToSellToAMM(market, position);
        if (amount <= _available) {
            _impact = _sellPriceImpact(market, position, amount, _available);
        }
    }

    function sellToAMMRequirements(ISportsAMM.SellRequirements memory requirements) public view returns (uint, IPosition) {
        require(!ISportPositionalMarket(requirements.market).isDoubleChance(), "Sell not supported for DoubleChance market");
        require(isMarketInAMMTrading(requirements.market), "Not in Trading");
        require(
            ISportPositionalMarket(requirements.market).optionsCount() > uint(requirements.position),
            "Invalid position"
        );
        uint availableToSellToAMMATM = availableToSellToAMM(requirements.market, requirements.position);
        require(
            availableToSellToAMMATM > 0 &&
                requirements.amount > ZERO_POINT_ONE &&
                requirements.amount <= availableToSellToAMMATM,
            "Low liquidity || 0 amount"
        );

        uint pricePaid = sellToAmmQuote(requirements.market, requirements.position, requirements.amount);
        require(
            (requirements.expectedPayout * ONE) / (pricePaid) <= (ONE + (requirements.additionalSlippage)),
            "Slippage too high"
        );

        (IPosition home, IPosition away, IPosition draw) = ISportPositionalMarket(requirements.market).getOptions();
        IPosition target = requirements.position == ISportsAMM.Position.Home ? home : away;
        if (
            ISportPositionalMarket(requirements.market).optionsCount() > 2 &&
            requirements.position != ISportsAMM.Position.Home
        ) {
            target = requirements.position == ISportsAMM.Position.Away ? away : draw;
        }

        require(target.getBalanceOf(requirements.user) >= requirements.amount, "Low user options");
        require(
            IERC20Upgradeable(address(target)).allowance(requirements.user, address(sportsAMM)) >= requirements.amount,
            "No allowance."
        );

        return (pricePaid, target);
    }

    /// @notice Checks if a `market` is active for AMM trading
    /// @param market The address of the SportPositional market of a game
    /// @return isTrading Returns true if market is active, returns false if not active.
    function isMarketInAMMTrading(address market) public view returns (bool isTrading) {
        isTrading = sportAmmUtils.isMarketInAMMTrading(market, manager, sportsAMM.minimalTimeLeftToMaturity());
    }

    /// INTERNALS

    function _sellToAmmQuote(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint basePrice,
        uint _available
    ) internal view returns (uint _quote) {
        if (amount <= _available) {
            basePrice = basePrice - sportsAMM.min_spread();

            uint tempAmount = (amount *
                ((basePrice * (ONE - (_sellPriceImpact(market, position, amount, _available)))) / ONE)) / ONE;

            uint returnQuote = (tempAmount * (ONE - (sportsAMM.safeBoxImpact()))) / ONE;
            _quote = ISportPositionalMarketManager(manager).transformCollateral(returnQuote);
        }
    }

    function _sellPriceImpact(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint available
    ) internal view returns (uint _sellImpact) {
        (uint _balancePosition, , uint balanceOtherSide) = sportAmmUtils.balanceOfPositionsOnMarket(
            market,
            position,
            address(this)
        );
        uint balancePositionAfter = _balancePosition > 0 ? _balancePosition + (amount) : balanceOtherSide > amount
            ? 0
            : amount - (balanceOtherSide);
        uint balanceOtherSideAfter = balanceOtherSide > amount ? balanceOtherSide - (amount) : 0;
        if (!(balancePositionAfter < balanceOtherSideAfter)) {
            _sellImpact = sportAmmUtils.sellPriceImpactImbalancedSkew(
                amount,
                balanceOtherSide,
                _balancePosition,
                balanceOtherSideAfter,
                balancePositionAfter,
                available,
                sportsAMM.max_spread()
            );
        }
    }

    /// SETTERS

    /// @notice Setting the main addresses for SportsAMM
    /// @param _safeBox Address of the Safe Box
    /// @param _sUSD Address of the sUSD
    /// @param _theRundownConsumer Address of Therundown consumer
    /// @param _apexConsumer Address of Apex consumer
    /// @param _wrapper contract for calling wrapper contract
    function setAddresses(
        address _safeBox,
        IERC20Upgradeable _sUSD,
        address _theRundownConsumer,
        address _apexConsumer,
        address _wrapper
    ) external onlyOwner {
        safeBox = _safeBox;
        sUSD = _sUSD;
        theRundownConsumer = _theRundownConsumer;
        apexConsumer = _apexConsumer;
        wrapper = ITherundownConsumerWrapper(_wrapper);

        emit AddressesUpdated(_safeBox, _sUSD, _theRundownConsumer, _apexConsumer, _wrapper);
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

    function setPaused(bool _setPausing) external onlyOwner {
        if (_setPausing) {
            _pause();
        } else {
            _unpause();
        }
    }

    /// @notice Updates contract parametars
    /// @param _ammUtils address of AMMUtils
    function setAmmUtils(SportsAMMUtils _ammUtils) external onlyOwner {
        sportAmmUtils = _ammUtils;
    }

    event AddressesUpdated(
        address _safeBox,
        IERC20Upgradeable _sUSD,
        address _theRundownConsumer,
        address _apexConsumer,
        address _wrapper
    );

    event SetSportsPositionalMarketManager(address _manager);
}

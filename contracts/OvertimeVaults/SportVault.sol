// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BaseSportVault.sol";

import "../interfaces/ISportsAMM.sol";
import "../interfaces/ISportPositionalMarket.sol";

contract SportVault is BaseSportVault {
    /* ========== CONSTANTS ========== */
    uint private constant HUNDRED = 1e20;
    uint private constant ONE = 1e18;

    /* ========== STATE VARIABLES ========== */

    uint public allocationLimitsPerMarketPerRound;

    mapping(uint => mapping(address => uint)) public allocationSpentPerRound;

    uint public priceLowerLimit;
    uint public priceUpperLimit;
    int public skewImpactLimit;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        ISportsAMM _sportsAmm,
        IERC20Upgradeable _sUSD,
        uint _roundLength,
        uint _priceLowerLimit,
        uint _priceUpperLimit,
        int _skewImpactLimit,
        uint _allocationLimitsPerMarketPerRound,
        uint _maxAllowedDeposit,
        uint _utilizationRate
    ) external initializer {
        __BaseSportVault_init(_owner, _sportsAmm, _sUSD, _roundLength, _maxAllowedDeposit, _utilizationRate);
        priceLowerLimit = _priceLowerLimit;
        priceUpperLimit = _priceUpperLimit;
        skewImpactLimit = _skewImpactLimit;
        allocationLimitsPerMarketPerRound = _allocationLimitsPerMarketPerRound;
    }

    /// @notice Buy market options from Thales AMM
    /// @param market address of a market
    /// @param amount number of options to be bought
    /// @param position to buy options for
    function trade(
        address market,
        uint amount,
        ISportsAMM.Position position
    ) external nonReentrant whenNotPaused {
        require(vaultStarted, "Vault has not started");

        ISportPositionalMarket marketContract = ISportPositionalMarket(market);
        (uint maturity, ) = marketContract.times();
        require(maturity < roundEndTime[round], "Market not valid");

        uint pricePosition = sportsAMM.buyFromAmmQuote(address(market), position, ONE);
        require(pricePosition > 0, "Market not valid");

        int pricePositionImpact = sportsAMM.buyPriceImpact(address(market), position, amount);

        if (pricePosition >= priceLowerLimit && pricePosition <= priceUpperLimit && pricePositionImpact < skewImpactLimit) {
            _buyFromAmm(market, position, amount);
        } else {
            revert("Market not valid");
        }

        if (!isTradingMarketInARound[round][market]) {
            tradingMarketsPerRound[round].push(market);
            isTradingMarketInARound[round][market] = true;
        }
    }

    /// @notice Set allocation limits for assets to be spent in one round
    /// @param _allocationLimitsPerMarketPerRound allocation per market in percent
    function setAllocationLimits(uint _allocationLimitsPerMarketPerRound) external onlyOwner {
        require(_allocationLimitsPerMarketPerRound < HUNDRED, "Invalid allocation limit values");
        allocationLimitsPerMarketPerRound = _allocationLimitsPerMarketPerRound;
        emit SetAllocationLimits(allocationLimitsPerMarketPerRound);
    }

    /// @notice Set price limit for options to be bought from AMM
    /// @param _priceLowerLimit lower limit
    /// @param _priceUpperLimit upper limit
    function setPriceLimits(uint _priceLowerLimit, uint _priceUpperLimit) external onlyOwner {
        require(_priceLowerLimit < _priceUpperLimit, "Invalid price limit values");
        priceLowerLimit = _priceLowerLimit;
        priceUpperLimit = _priceUpperLimit;
        emit SetPriceLimits(_priceLowerLimit, _priceUpperLimit);
    }

    /// @notice Set skew impact limit for AMM
    /// @param _skewImpactLimit limit in percents
    function setSkewImpactLimit(int _skewImpactLimit) external onlyOwner {
        skewImpactLimit = _skewImpactLimit;
        emit SetSkewImpactLimit(_skewImpactLimit);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /// @notice Buy options from AMM
    /// @param market address of a market
    /// @param position position to be bought
    /// @param amount amount of positions to be bought
    function _buyFromAmm(
        address market,
        ISportsAMM.Position position,
        uint amount
    ) internal {
        if (isTradingMarketInARound[round][market]) {
            require(
                tradingMarketPositionPerRound[round][market] == position,
                "Cannot trade different options on the same market"
            );
        }
        uint quote = sportsAMM.buyFromAmmQuote(market, position, amount);
        uint allocationAsset = (_tradingAllocation() * allocationLimitsPerMarketPerRound) / HUNDRED;
        require(
            (quote + allocationSpentPerRound[round][market]) < allocationAsset,
            "Amount exceeds available allocation for asset"
        );

        uint balanceBeforeTrade = sUSD.balanceOf(address(this));

        sportsAMM.buyFromAMM(market, position, amount, quote, 0);

        uint balanceAfterTrade = sUSD.balanceOf(address(this));

        allocationSpentPerRound[round][market] += quote;
        tradingMarketPositionPerRound[round][market] = position;

        emit TradeExecuted(market, position, amount, quote);
    }

    /* ========== VIEWS ========== */

    /* ========== EVENTS ========== */

    event SetAllocationLimits(uint allocationLimitsPerMarketPerRound);
    event SetPriceLimits(uint priceLowerLimit, uint priceUpperLimit);
    event SetSkewImpactLimit(int skewImpact);
    event TradeExecuted(address market, ISportsAMM.Position position, uint amount, uint quote);
}

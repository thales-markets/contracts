// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BaseSportVault.sol";

import "../interfaces/ISportsAMM.sol";
import "../interfaces/ISportPositionalMarket.sol";

contract SportVault is BaseSportVault {
    /* ========== CONSTANTS ========== */
    uint private constant HUNDRED = 1e20;
    uint private constant ONE = 1e18;

    struct InitParams {
        address _owner;
        ISportsAMM _sportsAmm;
        IERC20Upgradeable _sUSD;
        uint _roundLength;
        uint _priceLowerLimit;
        uint _priceUpperLimit;
        int _skewImpactLimit;
        uint _allocationLimitsPerMarketPerRound;
        uint _maxAllowedDeposit;
        uint _utilizationRate;
        uint _minDepositAmount;
        uint _maxAllowedUsers;
        uint _minTradeAmount;
    }

    /* ========== STATE VARIABLES ========== */

    uint public allocationLimitsPerMarketPerRound;

    mapping(uint => mapping(address => uint)) public allocationSpentPerRound;

    uint public priceLowerLimit;
    uint public priceUpperLimit;
    int public skewImpactLimit;

    uint public minTradeAmount;

    /* ========== CONSTRUCTOR ========== */

    function initialize(InitParams calldata params) external initializer {
        __BaseSportVault_init(
            params._owner,
            params._sportsAmm,
            params._sUSD,
            params._roundLength,
            params._maxAllowedDeposit,
            params._utilizationRate,
            params._minDepositAmount,
            params._maxAllowedUsers
        );
        priceLowerLimit = params._priceLowerLimit;
        priceUpperLimit = params._priceUpperLimit;
        skewImpactLimit = params._skewImpactLimit;
        allocationLimitsPerMarketPerRound = params._allocationLimitsPerMarketPerRound;
        minTradeAmount = params._minTradeAmount;
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
        require(maturity < roundStartTime[round] + roundLength, "Market not valid");

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

    /// @notice Set _minTradeAmount
    /// @param _minTradeAmount limit in percents
    function setMinTradeAmount(uint _minTradeAmount) external onlyOwner {
        minTradeAmount = _minTradeAmount;
        emit SetMinTradeAmount(_minTradeAmount);
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
        uint allocationAsset = (tradingAllocation() * allocationLimitsPerMarketPerRound) / HUNDRED;
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
    /// @notice Get available amount to spend on an asset in a round
    /// @param market to fetch available allocation for
    /// @return uint
    function getAvailableAllocationForMarket(address market) external view returns (uint) {
        uint allocationMarket = (tradingAllocation() * allocationLimitsPerMarketPerRound) / HUNDRED;

        return allocationMarket - allocationSpentPerRound[round][market];
    }

    /* ========== EVENTS ========== */

    event SetAllocationLimits(uint allocationLimitsPerMarketPerRound);
    event SetPriceLimits(uint priceLowerLimit, uint priceUpperLimit);
    event SetSkewImpactLimit(int skewImpact);
    event SetMinTradeAmount(uint SetMinTradeAmount);
    event TradeExecuted(address market, ISportsAMM.Position position, uint amount, uint quote);
}

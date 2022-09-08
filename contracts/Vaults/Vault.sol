// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BaseVault.sol";

import "../interfaces/IThalesAMM.sol";
import "../interfaces/IPositionalMarket.sol";

contract Vault is BaseVault {
    /* ========== CONSTANTS ========== */
    uint private constant HUNDRED = 1e20;

    enum Asset {
        ETH,
        BTC,
        Other
    }

    /* ========== STATE VARIABLES ========== */

    mapping(Asset => uint) public allocationLimits;
    mapping(uint => mapping(Asset => uint)) public allocationSpentPerRound;

    uint public priceLowerLimit;
    uint public priceUpperLimit;
    uint public skewImpactLimit;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        IThalesAMM _thalesAmm,
        IERC20Upgradeable _sUSD,
        uint _roundLength,
        uint _priceLowerLimit,
        uint _priceUpperLimit,
        uint _skewImpactLimit,
        uint _allocationLimitBTC,
        uint _allocationLimitETH,
        uint _allocationLimitOtherAssets
    ) external initializer {
        __BaseVault_init(_owner, _thalesAmm, _sUSD, _roundLength);
        priceLowerLimit = _priceLowerLimit;
        priceUpperLimit = _priceUpperLimit;
        skewImpactLimit = _skewImpactLimit;
        allocationLimits[Asset.ETH] = _allocationLimitETH;
        allocationLimits[Asset.BTC] = _allocationLimitBTC;
        allocationLimits[Asset.Other] = _allocationLimitOtherAssets;
    }

    /// @notice Buy market options from Thales AMM
    /// @param market address of a market
    /// @param amount number of options to be bought
    function trade(address market, uint amount) external nonReentrant whenNotPaused {
        require(vaultStarted, "Vault has not started");

        IPositionalMarket marketContract = IPositionalMarket(market);
        (bytes32 key, , ) = marketContract.getOracleDetails();
        (uint maturity, ) = marketContract.times();
        require(maturity < roundEndTime[round], "Market not valid");

        uint priceUp = thalesAMM.price(address(market), IThalesAMM.Position.Up);
        uint priceDown = thalesAMM.price(address(market), IThalesAMM.Position.Down);
        uint priceUpImpact = thalesAMM.buyPriceImpact(address(market), IThalesAMM.Position.Up, amount);
        uint priceDownImpact = thalesAMM.buyPriceImpact(address(market), IThalesAMM.Position.Down, amount);

        if (priceUp >= priceLowerLimit && priceUp <= priceUpperLimit && priceUpImpact < skewImpactLimit) {
            _buyFromAmm(market, _getAsset(key), IThalesAMM.Position.Up, amount);
        } else if (priceDown >= priceLowerLimit && priceDown <= priceUpperLimit && priceDownImpact < skewImpactLimit) {
            _buyFromAmm(market, _getAsset(key), IThalesAMM.Position.Down, amount);
        } else {
            revert("Market not valid");
        }

        if (!isTradingMarketInARound[round][market]) {
            tradingMarketsPerRound[round].push(market);
            isTradingMarketInARound[round][market] = true;
        }
    }

    /// @notice Set allocation limits for assets to be spent in one round
    /// @param _allocationETH allocation for ETH in percent
    /// @param _allocationBTC allocation for BTC in percent
    /// @param _allocationOtherAssets allocation for other assets in percent
    function setAllocationLimits(
        uint _allocationETH,
        uint _allocationBTC,
        uint _allocationOtherAssets
    ) external onlyOwner {
        require(_allocationBTC + _allocationETH + _allocationOtherAssets == HUNDRED, "Invalid allocation limit values");
        allocationLimits[Asset.ETH] = _allocationETH;
        allocationLimits[Asset.BTC] = _allocationBTC;
        allocationLimits[Asset.Other] = _allocationOtherAssets;
        emit SetAllocationLimits(_allocationETH, _allocationBTC, _allocationOtherAssets);
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
    function setSkewImpactLimit(uint _skewImpactLimit) external onlyOwner {
        skewImpactLimit = _skewImpactLimit;
        emit SetSkewImpactLimit(_skewImpactLimit);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /// @notice Buy options from AMM
    /// @param market address of a market
    /// @param asset market asset
    /// @param position position to be bought
    /// @param amount amount of positions to be bought
    function _buyFromAmm(
        address market,
        Asset asset,
        IThalesAMM.Position position,
        uint amount
    ) internal {
        uint quote = thalesAMM.buyFromAmmQuote(market, position, amount);
        uint allocationAsset = (allocationPerRound[round] * allocationLimits[asset]) / HUNDRED;
        require(
            (quote + allocationSpentPerRound[round][asset]) < allocationAsset,
            "Amount exceeds available allocation for asset"
        );

        uint balanceBeforeTrade = sUSD.balanceOf(address(this));

        thalesAMM.buyFromAMM(market, position, amount, quote, 500000000000000000);

        uint balanceAfterTrade = sUSD.balanceOf(address(this));

        uint totalAmountSpent = balanceBeforeTrade - balanceAfterTrade;

        allocationSpentPerRound[round][asset] += totalAmountSpent;

        emit TradeExecuted(market, position, asset, amount, totalAmountSpent);
    }

    /// @notice Get asset number based on asset key
    /// @param key asset key
    /// @return asset
    function _getAsset(bytes32 key) public pure returns (Asset asset) {
        if (key == "ETH") {
            asset = Asset.ETH;
        } else if (key == "BTC") {
            asset = Asset.BTC;
        } else {
            asset = Asset.Other;
        }
    }

    /* ========== VIEWS ========== */

    /// @notice Get amount spent on given asset in a round
    /// @param _round round number
    /// @param asset asset to fetch spent allocation for
    /// @return uint
    function getAllocationSpentPerRound(uint _round, Asset asset) external view returns (uint) {
        return allocationSpentPerRound[_round][asset];
    }

    /// @notice Get available amount to spend on an asset in a round
    /// @param _round round number
    /// @param asset asset to fetch available allocation for
    /// @return uint
    function getAvailableAllocationPerAsset(uint _round, Asset asset) external view returns (uint) {
        uint allocationAsset = (allocationPerRound[round] * allocationLimits[asset]) / HUNDRED;

        return allocationAsset - allocationSpentPerRound[_round][asset];
    }

    /* ========== EVENTS ========== */

    event SetAllocationLimits(uint allocationETH, uint allocationBTC, uint allocationOtherAssets);
    event SetPriceLimits(uint priceLowerLimit, uint priceUpperLimit);
    event SetSkewImpactLimit(uint skewImpact);
    event TradeExecuted(address market, IThalesAMM.Position position, Asset asset, uint amount, uint quote);
}

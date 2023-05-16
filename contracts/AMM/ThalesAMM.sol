// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
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
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

import "../interfaces/IPriceFeed.sol";
import "../interfaces/IThalesAMMUtils.sol";
import "../interfaces/IPositionalMarket.sol";
import "../interfaces/IPositionalMarketManager.sol";
import "../interfaces/IPosition.sol";
import "../interfaces/IStakingThales.sol";
import "../interfaces/IReferrals.sol";
import "../interfaces/ICurveSUSD.sol";

import "./LiquidityPool/ThalesAMMLiquidityPool.sol";

/// @title An AMM using BlackScholes odds algorithm to provide liqudidity for traders of UP or DOWN positions
contract ThalesAMM is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct BuyPriceImpactParams {
        address market;
        IThalesAMM.Position position;
        uint amount;
        uint _availableToBuyFromAMM;
        uint _availableToBuyFromAMMOtherSide;
        ThalesAMMLiquidityPool liquidityPool;
        uint basePrice;
    }

    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;

    IPriceFeed public priceFeed;
    IERC20Upgradeable public sUSD;
    address public manager;

    uint public capPerMarket;
    uint public min_spread;
    uint public max_spread;

    mapping(bytes32 => uint) public impliedVolatilityPerAsset;

    uint public minimalTimeLeftToMaturity;

    mapping(address => uint) public spentOnMarket;

    address public safeBox;
    uint public safeBoxImpact;

    IStakingThales public stakingThales;

    uint public minSupportedPrice;
    uint public maxSupportedPrice;

    mapping(bytes32 => uint) private _capPerAsset;

    mapping(address => bool) public whitelistedAddresses;

    address public referrals;
    uint public referrerFee;

    ICurveSUSD public curveSUSD;

    address public usdc;
    address public usdt;
    address public dai;

    bool public curveOnrampEnabled;

    uint public maxAllowedPegSlippagePercentage;

    IThalesAMMUtils ammUtils;

    int private constant ONE_INT = 1e18;
    int private constant ONE_PERCENT_INT = 1e16;

    mapping(address => uint) public safeBoxFeePerAddress;
    mapping(address => uint) public min_spreadPerAddress;

    ThalesAMMLiquidityPool public liquidityPool;

    function initialize(
        address _owner,
        IPriceFeed _priceFeed,
        IERC20Upgradeable _sUSD,
        uint _capPerMarket,
        address _deciMath,
        uint _min_spread,
        uint _max_spread,
        uint _minimalTimeLeftToMaturity
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        priceFeed = _priceFeed;
        sUSD = _sUSD;
        capPerMarket = _capPerMarket;
        min_spread = _min_spread;
        max_spread = _max_spread;
        minimalTimeLeftToMaturity = _minimalTimeLeftToMaturity;
    }

    // READ public methods

    /// @notice get how many positions of a certain type (UP or DOWN) can be bought from the given positional market
    /// @param market a Positional Market known to Market Manager
    /// @param position UP or DOWN
    /// @return _available how many positions of that type can be bought
    function availableToBuyFromAMM(address market, IThalesAMM.Position position) public view returns (uint _available) {
        if (isMarketInAMMTrading(market)) {
            uint basePrice = price(market, position);
            if (basePrice > 0) {
                basePrice = basePrice < minSupportedPrice ? minSupportedPrice : basePrice;
                _available = _availableToBuyFromAMMWithBasePrice(market, position, basePrice, false);
            }
        }
    }

    /// @notice get a quote in sUSD on how much the trader would need to pay to buy the amount of UP or DOWN positions
    /// @param market a Positional Market known to Market Manager
    /// @param position UP or DOWN
    /// @param amount number of positions to buy with 18 decimals
    /// @return _quote in sUSD on how much the trader would need to pay to buy the amount of UP or DOWN positions
    function buyFromAmmQuote(
        address market,
        IThalesAMM.Position position,
        uint amount
    ) public view returns (uint _quote) {
        uint basePrice = price(market, position);
        uint basePriceOtherSide = ONE - basePrice;
        if (basePrice > 0) {
            basePrice = basePrice < minSupportedPrice ? minSupportedPrice : basePrice;
            _quote = _buyFromAmmQuoteWithBasePrice(market, position, amount, basePrice, basePriceOtherSide, safeBoxImpact);
        }
    }

    /// @notice get a quote in the collateral of choice (USDC, USDT or DAI) on how much the trader would need to pay to buy the amount of UP or DOWN positions
    /// @param market a Positional Market known to Market Manager
    /// @param position UP or DOWN
    /// @param amount number of positions to buy with 18 decimals
    /// @param collateral USDT, USDC or DAI address
    /// @return collateralQuote a quote in collateral on how much the trader would need to pay to buy the amount of UP or DOWN positions
    /// @return sUSDToPay a quote in sUSD on how much the trader would need to pay to buy the amount of UP or DOWN positions
    function buyFromAmmQuoteWithDifferentCollateral(
        address market,
        IThalesAMM.Position position,
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

    /// @notice get the skew impact applied to that side of the market on buy
    /// @param market a Positional Market known to Market Manager
    /// @param position UP or DOWN
    /// @param amount number of positions to buy with 18 decimals
    /// @return _priceImpact the skew impact applied to that side of the market
    function buyPriceImpact(
        address market,
        IThalesAMM.Position position,
        uint amount
    ) public view returns (int _priceImpact) {
        IThalesAMM.Position positionOtherSide = position == IThalesAMM.Position.Up
            ? IThalesAMM.Position.Down
            : IThalesAMM.Position.Up;
        uint basePrice = price(market, position);

        if (basePrice >= minSupportedPrice && basePrice <= maxSupportedPrice) {
            uint basePriceOtherSide = ONE - basePrice;
            uint _availableToBuyFromAMM = _availableToBuyFromAMMWithBasePrice(market, position, basePrice, true);
            uint _availableToBuyFromAMMOtherSide = _availableToBuyFromAMMWithBasePrice(
                market,
                positionOtherSide,
                basePriceOtherSide,
                true
            );
            if (amount > 0 && amount <= _availableToBuyFromAMM) {
                _priceImpact = _buyPriceImpact(
                    BuyPriceImpactParams(
                        market,
                        position,
                        amount,
                        _availableToBuyFromAMM,
                        _availableToBuyFromAMMOtherSide,
                        liquidityPool,
                        basePrice
                    )
                );
            }
        }
    }

    /// @notice get how many positions of a certain type (UP or DOWN) can be sold for the given positional market
    /// @param market a Positional Market known to Market Manager
    /// @param position UP or DOWN
    /// @return _available how many positions of that type can be sold
    function availableToSellToAMM(address market, IThalesAMM.Position position) public view returns (uint _available) {
        if (isMarketInAMMTrading(market)) {
            uint basePrice = price(market, position);
            basePrice = basePrice > maxSupportedPrice ? maxSupportedPrice : basePrice;
            _available = _availableToSellToAMM(market, position, basePrice);
        }
    }

    /// @notice get a quote in sUSD on how much the trader would receive as payment to sell the amount of UP or DOWN positions
    /// @param market a Positional Market known to Market Manager
    /// @param position UP or DOWN
    /// @param amount number of positions to buy with 18 decimals
    /// @return _quote in sUSD on how much the trader would receive as payment to sell the amount of UP or DOWN positions
    function sellToAmmQuote(
        address market,
        IThalesAMM.Position position,
        uint amount
    ) public view returns (uint _quote) {
        uint basePrice = price(market, position);
        basePrice = basePrice > maxSupportedPrice ? maxSupportedPrice : basePrice;
        uint _available = _availableToSellToAMM(market, position, basePrice);
        _quote = _sellToAmmQuote(market, position, amount, basePrice, _available);
    }

    /// @notice get the skew impact applied to that side of the market on sell
    /// @param market a Positional Market known to Market Manager
    /// @param position UP or DOWN
    /// @param amount number of positions to buy with 18 decimals
    /// @return _impact the skew impact applied to that side of the market
    function sellPriceImpact(
        address market,
        IThalesAMM.Position position,
        uint amount
    ) public view returns (uint _impact) {
        uint _available = availableToSellToAMM(market, position);
        if (amount <= _available) {
            _impact = _sellPriceImpact(market, position, amount, _available);
        }
    }

    /// @notice get the base price (odds) of a given side of the market
    /// @param market a Positional Market known to Market Manager
    /// @param position UP or DOWN
    /// @return priceToReturn the base price (odds) of a given side of the market
    function price(address market, IThalesAMM.Position position) public view returns (uint priceToReturn) {
        if (isMarketInAMMTrading(market)) {
            // add price calculation
            IPositionalMarket marketContract = IPositionalMarket(market);
            (uint maturity, ) = marketContract.times();

            uint timeLeftToMaturity = maturity - block.timestamp;
            uint timeLeftToMaturityInDays = (timeLeftToMaturity * ONE) / 86400;
            uint oraclePrice = marketContract.oraclePrice();

            (bytes32 key, uint strikePrice, ) = marketContract.getOracleDetails();

            priceToReturn =
                ammUtils.calculateOdds(oraclePrice, strikePrice, timeLeftToMaturityInDays, impliedVolatilityPerAsset[key]) /
                1e2;

            if (position == IThalesAMM.Position.Down) {
                priceToReturn = ONE - priceToReturn;
            }
        }
    }

    /// @notice check if market is supported by the AMM
    /// @param market positional market known to manager
    /// @return isTrading is market supported by the AMM
    function isMarketInAMMTrading(address market) public view returns (bool isTrading) {
        if (IPositionalMarketManager(manager).isActiveMarket(market)) {
            IPositionalMarket marketContract = IPositionalMarket(market);
            (bytes32 key, , ) = marketContract.getOracleDetails();
            (uint maturity, ) = marketContract.times();

            if (!(impliedVolatilityPerAsset[key] == 0 || maturity < block.timestamp)) {
                uint timeLeftToMaturity = maturity - block.timestamp;
                isTrading = timeLeftToMaturity > minimalTimeLeftToMaturity;
            }
        }
    }

    /// @notice get the maximum risk in sUSD the AMM will offer on a certain asset on an individual market
    /// @param asset e.g. ETH, BTC, SNX....
    /// @return _cap the maximum risk in sUSD the AMM will offer on a certain asset on an individual market
    function getCapPerAsset(bytes32 asset) public view returns (uint _cap) {
        if (!(priceFeed.rateForCurrency(asset) == 0)) {
            _cap = _capPerAsset[asset] == 0 ? capPerMarket : _capPerAsset[asset];
        }
    }

    // write methods

    /// @notice buy positions of the defined type of a given market from the AMM coming from a referrer
    /// @param market a Positional Market known to Market Manager
    /// @param position UP or DOWN
    /// @param amount how many positions
    /// @param expectedPayout how much does the buyer expect to pay (retrieved via quote)
    /// @param additionalSlippage how much of a slippage on the sUSD expectedPayout will the buyer accept
    /// @param _referrer who referred the buyer to Thales
    function buyFromAMMWithReferrer(
        address market,
        IThalesAMM.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        address _referrer
    ) public nonReentrant notPaused returns (uint) {
        if (_referrer != address(0)) {
            IReferrals(referrals).setReferrer(_referrer, msg.sender);
        }
        return _buyFromAMM(market, position, amount, expectedPayout, additionalSlippage, true, 0);
    }

    /// @notice buy positions of the defined type of a given market from the AMM with USDC, USDT or DAI
    /// @param market a Positional Market known to Market Manager
    /// @param position UP or DOWN
    /// @param amount how many positions
    /// @param expectedPayout how much does the buyer expect to pay (retrieved via quote)
    /// @param collateral USDC, USDT or DAI
    /// @param additionalSlippage how much of a slippage on the sUSD expectedPayout will the buyer accept
    /// @param _referrer who referred the buyer to Thales
    function buyFromAMMWithDifferentCollateralAndReferrer(
        address market,
        IThalesAMM.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        address collateral,
        address _referrer
    ) public nonReentrant notPaused returns (uint) {
        if (_referrer != address(0)) {
            IReferrals(referrals).setReferrer(_referrer, msg.sender);
        }

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

    /// @notice buy positions of the defined type of a given market from the AMM
    /// @param market a Positional Market known to Market Manager
    /// @param position UP or DOWN
    /// @param amount how many positions
    /// @param expectedPayout how much does the buyer expect to pay (retrieved via quote)
    /// @param additionalSlippage how much of a slippage on the sUSD expectedPayout will the buyer accept
    function buyFromAMM(
        address market,
        IThalesAMM.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) public nonReentrant notPaused returns (uint) {
        return _buyFromAMM(market, position, amount, expectedPayout, additionalSlippage, true, 0);
    }

    /// @notice sell positions of the defined type of a given market to the AMM
    /// @param market a Positional Market known to Market Manager
    /// @param position UP or DOWN
    /// @param amount how many positions
    /// @param expectedPayout how much does the seller to receive(retrieved via quote)
    /// @param additionalSlippage how much of a slippage on the sUSD expectedPayout will the seller accept
    function sellToAMM(
        address market,
        IThalesAMM.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) public nonReentrant notPaused returns (uint) {
        require(isMarketInAMMTrading(market), "Market is not in Trading phase");

        uint basePrice = price(market, position);
        basePrice = basePrice > maxSupportedPrice ? maxSupportedPrice : basePrice;
        uint availableToSellToAMMATM = _availableToSellToAMM(market, position, basePrice);
        require(availableToSellToAMMATM > 0 && amount <= availableToSellToAMMATM, "Not enough liquidity.");

        uint pricePaid = _sellToAmmQuote(market, position, amount, basePrice, availableToSellToAMMATM);
        require((expectedPayout * ONE) / (pricePaid) <= (ONE + (additionalSlippage)), "Slippage too high");

        address target = _getTarget(market, position);

        _transferPositions(market);

        //transfer options first to have max burn available
        IERC20Upgradeable(target).safeTransferFrom(msg.sender, address(this), amount);

        uint sUSDFromBurning = IPositionalMarketManager(manager).transformCollateral(
            IPositionalMarket(market).getMaximumBurnable(address(this))
        );
        if (sUSDFromBurning > 0) {
            IPositionalMarket(market).burnOptionsMaximum();
        }

        uint safeBoxShare = (pricePaid * ONE) / (ONE - (safeBoxImpact)) - (pricePaid);
        if (safeBoxImpact == 0) {
            safeBoxShare = 0;
        }

        liquidityPool.commitTrade(market, pricePaid + safeBoxShare);
        sUSD.safeTransfer(msg.sender, pricePaid);

        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(msg.sender, pricePaid);
        }

        _updateSpentOnMarketOnSell(market, pricePaid, sUSDFromBurning, msg.sender, safeBoxShare);

        _sendMintedPositionsAndUSDToLiquidityPool(market);

        emit SoldToAMM(msg.sender, market, position, amount, pricePaid, address(sUSD), target);
        return pricePaid;
    }

    function _transferPositions(address market) internal {
        (uint upBalance, uint downBalance) = ammUtils.getBalanceOfPositionsOnMarket(
            market,
            liquidityPool.getMarketPool(market)
        );

        liquidityPool.getOptionsForBuy(market, upBalance, IThalesAMM.Position.Up);
        liquidityPool.getOptionsForBuy(market, downBalance, IThalesAMM.Position.Down);
    }

    /// @notice Retrieve sUSD from the contract
    /// @param account whom to send the sUSD
    /// @param amount how much sUSD to retrieve
    function retrieveSUSDAmount(address payable account, uint amount) external onlyOwner {
        sUSD.safeTransfer(account, amount);
    }

    // Internal

    function _availableToSellToAMM(
        address market,
        IThalesAMM.Position position,
        uint basePrice
    ) internal view returns (uint _available) {
        uint sell_max_price = _getSellMaxPrice(basePrice);
        if (sell_max_price > 0) {
            (, uint balanceOfTheOtherSide) = ammUtils.balanceOfPositionsOnMarket(
                market,
                position,
                liquidityPool.getMarketPool(market)
            );

            // any balanceOfTheOtherSide will be burned to get sUSD back (1 to 1) at the `willPay` cost
            uint willPay = (balanceOfTheOtherSide * (sell_max_price)) / ONE;
            uint capWithBalance = _capOnMarket(market) + (balanceOfTheOtherSide);
            if (capWithBalance >= (spentOnMarket[market] + willPay)) {
                uint usdAvailable = capWithBalance - (spentOnMarket[market]) - (willPay);
                _available = (usdAvailable / (sell_max_price)) * ONE + (balanceOfTheOtherSide);
            }
        }
    }

    function _sellToAmmQuote(
        address market,
        IThalesAMM.Position position,
        uint amount,
        uint basePrice,
        uint _available
    ) internal view returns (uint _quote) {
        if (amount <= _available) {
            basePrice = basePrice - (min_spread);

            uint tempAmount = (amount *
                ((basePrice * (ONE - (_sellPriceImpact(market, position, amount, _available)))) / ONE)) / ONE;

            uint returnQuote = (tempAmount * (ONE - (safeBoxImpact))) / ONE;
            _quote = IPositionalMarketManager(manager).transformCollateral(returnQuote);
        }
    }

    function _availableToBuyFromAMMWithBasePrice(
        address market,
        IThalesAMM.Position position,
        uint basePrice,
        bool skipCheck
    ) internal view returns (uint availableAmount) {
        if (skipCheck || basePrice < maxSupportedPrice) {
            basePrice = basePrice + min_spread;
            if (basePrice < ONE) {
                uint discountedPrice = (basePrice * (ONE - max_spread / 2)) / ONE;
                uint balance = ammUtils.balanceOfPositionOnMarket(market, position, liquidityPool.getMarketPool(market));
                uint additionalBufferFromSelling = (balance * discountedPrice) / ONE;

                if ((_capOnMarket(market) + additionalBufferFromSelling) > spentOnMarket[market]) {
                    uint availableUntilCapSUSD = _capOnMarket(market) + additionalBufferFromSelling - spentOnMarket[market];
                    if (availableUntilCapSUSD > _capOnMarket(market)) {
                        availableUntilCapSUSD = _capOnMarket(market);
                    }

                    uint midImpactPriceIncrease = ((ONE - basePrice) * (max_spread / 2)) / ONE;
                    if ((basePrice + midImpactPriceIncrease) < ONE) {
                        uint divider_price = ONE - (basePrice + midImpactPriceIncrease);

                        availableAmount = balance + ((availableUntilCapSUSD * ONE) / divider_price);
                    }
                }
            }
        }
    }

    function _buyFromAmmQuoteWithBasePrice(
        address market,
        IThalesAMM.Position position,
        uint amount,
        uint basePrice,
        uint basePriceOtherSide,
        uint safeBoxImpactForCaller
    ) internal view returns (uint returnQuote) {
        uint _available = _availableToBuyFromAMMWithBasePrice(market, position, basePrice, false);
        uint _availableOtherSide = _availableToBuyFromAMMWithBasePrice(
            market,
            position == IThalesAMM.Position.Up ? IThalesAMM.Position.Down : IThalesAMM.Position.Up,
            basePriceOtherSide,
            true
        );

        if (amount <= _available) {
            int tempQuote;
            int skewImpact = _buyPriceImpact(
                BuyPriceImpactParams(market, position, amount, _available, _availableOtherSide, liquidityPool, basePrice)
            );
            basePrice = basePrice + (min_spreadPerAddress[msg.sender] > 0 ? min_spreadPerAddress[msg.sender] : min_spread);
            if (skewImpact >= 0) {
                int impactPrice = ((ONE_INT - int(basePrice)) * skewImpact) / ONE_INT;
                // add 2% to the price increase to avoid edge cases on the extremes
                impactPrice = (impactPrice * (ONE_INT + (ONE_PERCENT_INT * 2))) / ONE_INT;
                tempQuote = (int(amount) * (int(basePrice) + impactPrice)) / ONE_INT;
            } else {
                tempQuote = ((int(amount)) * ((int(basePrice) * (ONE_INT + skewImpact)) / ONE_INT)) / ONE_INT;
            }
            tempQuote = (tempQuote * (ONE_INT + (int(safeBoxImpactForCaller)))) / ONE_INT;
            returnQuote = IPositionalMarketManager(manager).transformCollateral(uint(tempQuote));
        }
    }

    function _getSellMaxPrice(uint basePrice) internal view returns (uint sell_max_price) {
        if (basePrice > minSupportedPrice) {
            sell_max_price = ((basePrice - min_spread) * (ONE - (max_spread / (2)))) / ONE;
        }
    }

    function _buyFromAMM(
        address market,
        IThalesAMM.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        bool sendSUSD,
        uint sUSDPaidCarried
    ) internal returns (uint sUSDPaid) {
        require(isMarketInAMMTrading(market), "Market is not in Trading phase");

        sUSDPaid = sUSDPaidCarried;

        uint basePrice = price(market, position);
        uint basePriceOtherSide = ONE - basePrice;

        basePrice = basePrice < minSupportedPrice ? minSupportedPrice : basePrice;

        uint availableToBuyFromAMMatm = _availableToBuyFromAMMWithBasePrice(market, position, basePrice, false);
        require(amount > 0 && amount <= availableToBuyFromAMMatm, "Not enough liquidity.");

        if (sendSUSD) {
            sUSDPaid = _buyFromAmmQuoteWithBasePrice(
                market,
                position,
                amount,
                basePrice,
                basePriceOtherSide,
                safeBoxFeePerAddress[msg.sender] > 0 ? safeBoxFeePerAddress[msg.sender] : safeBoxImpact
            );
            require((sUSDPaid * ONE) / (expectedPayout) <= (ONE + additionalSlippage), "Slippage too high");

            sUSD.safeTransferFrom(msg.sender, address(this), sUSDPaid);
        }

        uint toMint = _getMintableAmount(market, position, amount);
        if (toMint > 0) {
            liquidityPool.commitTrade(market, toMint);
            IPositionalMarket(market).mint(toMint);
            spentOnMarket[market] = spentOnMarket[market] + toMint;
        }
        liquidityPool.getOptionsForBuy(market, amount - toMint, position);

        address target = _getTarget(market, position);
        IERC20Upgradeable(target).safeTransfer(msg.sender, amount);

        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(msg.sender, sUSDPaid);
        }
        _updateSpentOnMarketOnBuy(market, sUSDPaid, msg.sender);

        if (amount > toMint) {
            uint discountedAmount = amount - toMint;
            uint paidForDiscountedAmount = (sUSDPaid * discountedAmount) / amount;
            emit BoughtWithDiscount(msg.sender, discountedAmount, paidForDiscountedAmount);
        }

        _sendMintedPositionsAndUSDToLiquidityPool(market);

        emit BoughtFromAmm(msg.sender, market, position, amount, sUSDPaid, address(sUSD), target);
        _handleInTheMoneyEvent(market, position, sUSDPaid, msg.sender);
    }

    function _handleInTheMoneyEvent(
        address market,
        IThalesAMM.Position position,
        uint sUSDPaid,
        address sender
    ) internal {
        (bytes32 key, uint strikePrice, ) = IPositionalMarket(market).getOracleDetails();
        uint currentAssetPrice = priceFeed.rateForCurrency(key);
        bool inTheMoney = position == IThalesAMM.Position.Up
            ? currentAssetPrice >= strikePrice
            : currentAssetPrice < strikePrice;
        emit BoughtOptionType(msg.sender, sUSDPaid, inTheMoney);
    }

    function _getTarget(address market, IThalesAMM.Position position) internal view returns (address target) {
        (IPosition up, IPosition down) = IPositionalMarket(market).getOptions();
        target = address(position == IThalesAMM.Position.Up ? up : down);
    }

    function _updateSpentOnMarketOnSell(
        address market,
        uint sUSDPaid,
        uint sUSDFromBurning,
        address seller,
        uint safeBoxShare
    ) internal {
        if (safeBoxImpact > 0) {
            sUSD.safeTransfer(safeBox, safeBoxShare);
        }

        spentOnMarket[market] =
            spentOnMarket[market] +
            (IPositionalMarketManager(manager).reverseTransformCollateral(sUSDPaid + (safeBoxShare)));
        if (spentOnMarket[market] <= IPositionalMarketManager(manager).reverseTransformCollateral(sUSDFromBurning)) {
            spentOnMarket[market] = 0;
        } else {
            spentOnMarket[market] =
                spentOnMarket[market] -
                (IPositionalMarketManager(manager).reverseTransformCollateral(sUSDFromBurning));
        }

        if (referrerFee > 0 && referrals != address(0)) {
            uint referrerShare = (sUSDPaid * ONE) / (ONE - (referrerFee)) - (sUSDPaid);
            _handleReferrer(seller, referrerShare, sUSDPaid);
        }
    }

    function _updateSpentOnMarketOnBuy(
        address market,
        uint sUSDPaid,
        address buyer
    ) internal {
        uint safeBoxShare;
        if (safeBoxImpact > 0) {
            safeBoxShare = (sUSDPaid -
                (sUSDPaid * ONE) /
                (ONE + (safeBoxFeePerAddress[msg.sender] > 0 ? safeBoxFeePerAddress[msg.sender] : safeBoxImpact)));
            sUSD.safeTransfer(safeBox, safeBoxShare);
        }

        if (
            spentOnMarket[market] <= IPositionalMarketManager(manager).reverseTransformCollateral(sUSDPaid - (safeBoxShare))
        ) {
            spentOnMarket[market] = 0;
        } else {
            spentOnMarket[market] =
                spentOnMarket[market] -
                (IPositionalMarketManager(manager).reverseTransformCollateral(sUSDPaid - (safeBoxShare)));
        }

        if (referrerFee > 0 && referrals != address(0)) {
            uint referrerShare = sUSDPaid - ((sUSDPaid * ONE) / (ONE + (referrerFee)));
            _handleReferrer(buyer, referrerShare, sUSDPaid);
        }
    }

    function _buyPriceImpact(BuyPriceImpactParams memory params) internal view returns (int priceImpact) {
        if (params.basePrice >= minSupportedPrice && params.basePrice <= maxSupportedPrice) {
            (uint balancePosition, uint balanceOtherSide) = ammUtils.balanceOfPositionsOnMarket(
                params.market,
                params.position,
                params.liquidityPool.getMarketPool(params.market)
            );

            uint balancePositionAfter = balancePosition > params.amount ? balancePosition - params.amount : 0;
            uint balanceOtherSideAfter = balanceOtherSide +
                (balancePosition > params.amount ? 0 : (params.amount - balancePosition));
            if (balancePositionAfter >= balanceOtherSideAfter) {
                priceImpact = ammUtils.calculateDiscount(
                    IThalesAMMUtils.DiscountParams(
                        balancePosition,
                        balanceOtherSide,
                        params.amount,
                        params._availableToBuyFromAMMOtherSide,
                        max_spread
                    )
                );
            } else {
                if (params.amount > balancePosition && balancePosition > 0) {
                    uint amountToBeMinted = params.amount - balancePosition;
                    uint positiveSkew = ammUtils.buyPriceImpactImbalancedSkew(
                        IThalesAMMUtils.PriceImpactParams(
                            amountToBeMinted,
                            balanceOtherSide + balancePosition,
                            0,
                            balanceOtherSide + amountToBeMinted,
                            0,
                            params._availableToBuyFromAMM - balancePosition,
                            max_spread
                        )
                    );

                    uint pricePosition = price(params.market, params.position);
                    uint priceOtherPosition = price(
                        params.market,
                        params.position == IThalesAMM.Position.Up ? IThalesAMM.Position.Down : IThalesAMM.Position.Up
                    );
                    uint skew = (priceOtherPosition * positiveSkew) / pricePosition;

                    int discount = ammUtils.calculateDiscount(
                        IThalesAMMUtils.DiscountParams(
                            balancePosition,
                            balanceOtherSide,
                            balancePosition,
                            params._availableToBuyFromAMMOtherSide,
                            max_spread
                        )
                    );

                    int discountBalance = int(balancePosition) * discount;
                    int discountMinted = int(amountToBeMinted * skew);
                    int amountInt = int(balancePosition + amountToBeMinted);

                    priceImpact = (discountBalance + discountMinted) / amountInt;

                    if (priceImpact > 0) {
                        int numerator = int(pricePosition) * priceImpact;
                        priceImpact = numerator / int(priceOtherPosition);
                    }
                } else {
                    priceImpact = int(
                        ammUtils.buyPriceImpactImbalancedSkew(
                            IThalesAMMUtils.PriceImpactParams(
                                params.amount,
                                balanceOtherSide,
                                balancePosition,
                                balanceOtherSideAfter,
                                balancePositionAfter,
                                params._availableToBuyFromAMM,
                                max_spread
                            )
                        )
                    );
                }
            }
        }
    }

    function _handleReferrer(
        address buyer,
        uint referrerShare,
        uint volume
    ) internal {
        address referrer = IReferrals(referrals).referrals(buyer);
        if (referrer != address(0) && referrerFee > 0) {
            sUSD.safeTransfer(referrer, referrerShare);
            emit ReferrerPaid(referrer, buyer, referrerShare, volume);
        }
    }

    function _sellPriceImpact(
        address market,
        IThalesAMM.Position position,
        uint amount,
        uint available
    ) internal view returns (uint _sellImpact) {
        (uint _balancePosition, uint balanceOtherSide) = ammUtils.balanceOfPositionsOnMarket(
            market,
            position,
            liquidityPool.getMarketPool(market)
        );
        uint balancePositionAfter = _balancePosition > 0 ? _balancePosition + (amount) : balanceOtherSide > amount
            ? 0
            : amount - (balanceOtherSide);
        uint balanceOtherSideAfter = balanceOtherSide > amount ? balanceOtherSide - (amount) : 0;
        if (!(balancePositionAfter < balanceOtherSideAfter)) {
            _sellImpact = ammUtils.sellPriceImpactImbalancedSkew(
                amount,
                balanceOtherSide,
                _balancePosition,
                balanceOtherSideAfter,
                balancePositionAfter,
                available,
                max_spread
            );
        }
    }

    function _getMintableAmount(
        address market,
        IThalesAMM.Position position,
        uint amount
    ) internal view returns (uint mintable) {
        uint availableInContract = ammUtils.balanceOfPositionOnMarket(market, position, liquidityPool.getMarketPool(market));
        if (availableInContract < amount) {
            mintable = amount - availableInContract;
        }
    }

    function _capOnMarket(address market) internal view returns (uint) {
        (bytes32 key, , ) = IPositionalMarket(market).getOracleDetails();
        return getCapPerAsset(key);
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

    function _sendMintedPositionsAndUSDToLiquidityPool(address market) internal {
        address _liquidityPool = liquidityPool.getOrCreateMarketPool(market);

        if (sUSD.balanceOf(address(this)) > 0) {
            sUSD.safeTransfer(_liquidityPool, sUSD.balanceOf(address(this)));
        }

        (IPosition up, IPosition down) = IPositionalMarket(market).getOptions();

        (uint upBalance, uint downBalance) = ammUtils.getBalanceOfPositionsOnMarket(market, address(this));

        if (upBalance > 0) {
            IERC20Upgradeable(address(up)).safeTransfer(_liquidityPool, upBalance);
        }

        if (downBalance > 0) {
            IERC20Upgradeable(address(down)).safeTransfer(_liquidityPool, downBalance);
        }
    }

    // setters

    /// @notice Updates contract parametars
    /// @param _minimalTimeLeftToMaturity how long till maturity will AMM support trading on a given market
    function setMinimalTimeLeftToMaturity(uint _minimalTimeLeftToMaturity) external onlyOwner {
        minimalTimeLeftToMaturity = _minimalTimeLeftToMaturity;
        emit SetMinimalTimeLeftToMaturity(_minimalTimeLeftToMaturity);
    }

    /// @notice Updates contract parametars
    /// @param _address which can update implied volatility
    /// @param enabled update if the address can set implied volatility
    function setWhitelistedAddress(address _address, bool enabled) external onlyOwner {
        whitelistedAddresses[_address] = enabled;
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

    /// @notice Updates contract parametars
    /// @param _minspread minimum spread applied to base price
    /// @param _maxspread maximum skew impact, e.g. if all UP positions are drained, skewImpact on that side = _maxspread
    function setMinMaxSpread(uint _minspread, uint _maxspread) external onlyOwner {
        min_spread = _minspread;
        max_spread = _maxspread;
        emit SetMinSpread(_minspread);
        emit SetMaxSpread(_maxspread);
    }

    /// @notice Updates contract parametars
    /// @param _safeBox where to send a fee reserved for protocol from each trade
    /// @param _safeBoxImpact how much is the SafeBoxFee
    function setSafeBoxData(address _safeBox, uint _safeBoxImpact) external onlyOwner {
        safeBoxImpact = _safeBoxImpact;
        safeBox = _safeBox;
        emit SetSafeBoxImpact(_safeBoxImpact);
    }

    /// @notice Updates contract parametars
    /// @param _minSupportedPrice whats the max price AMM supports, e.g. 10 cents
    /// @param _maxSupportedPrice whats the max price AMM supports, e.g. 90 cents
    /// @param _capPerMarket default amount the AMM will risk on markets, overrided by capPerAsset if existing
    function setMinMaxSupportedPriceAndCap(
        uint _minSupportedPrice,
        uint _maxSupportedPrice,
        uint _capPerMarket
    ) external onlyOwner {
        minSupportedPrice = _minSupportedPrice;
        maxSupportedPrice = _maxSupportedPrice;
        capPerMarket = _capPerMarket;
        emit SetMinMaxSupportedPriceCapPerMarket(_minSupportedPrice, _maxSupportedPrice, _capPerMarket);
    }

    /// @notice Updates contract parametars. Can be set by owner or whitelisted addresses. In the future try to get it as a feed from Chainlink.
    /// @param asset e.g. ETH, BTC, SNX...
    /// @param _impliedVolatility IV for BlackScholes
    function setImpliedVolatilityPerAsset(bytes32 asset, uint _impliedVolatility) external {
        require(
            whitelistedAddresses[msg.sender] || owner == msg.sender,
            "Only whitelisted addresses or owner can change IV!"
        );
        require(_impliedVolatility > ONE * 10 && _impliedVolatility < ONE * 300, "IV outside min/max range!");
        require(priceFeed.rateForCurrency(asset) != 0, "Asset has no price!");
        impliedVolatilityPerAsset[asset] = _impliedVolatility;
        emit SetImpliedVolatilityPerAsset(asset, _impliedVolatility);
    }

    /// @notice Updates contract parametars
    /// @param _priceFeed contract from which we read prices, can be chainlink or twap
    /// @param _sUSD address of sUSD
    function setPriceFeedAndSUSD(IPriceFeed _priceFeed, IERC20Upgradeable _sUSD) external onlyOwner {
        priceFeed = _priceFeed;
        emit SetPriceFeed(address(_priceFeed));

        sUSD = _sUSD;
        emit SetSUSD(address(sUSD));
    }

    /// @notice Updates contract parametars
    /// @param _ammUtils address of AMMUtils
    function setAmmUtils(IThalesAMMUtils _ammUtils) external onlyOwner {
        ammUtils = _ammUtils;
    }

    /// @notice Updates contract parametars
    /// @param _stakingThales contract address for staking bonuses
    /// @param _referrals contract for referrals storage
    /// @param _referrerFee how much of a fee to pay to referrers
    function setStakingThalesAndReferrals(
        IStakingThales _stakingThales,
        address _referrals,
        uint _referrerFee
    ) external onlyOwner {
        stakingThales = _stakingThales;
        referrals = _referrals;
        referrerFee = _referrerFee;
    }

    /// @notice Updates contract parametars
    /// @param _manager Positional Market Manager contract
    function setPositionalMarketManager(address _manager) external onlyOwner {
        if (address(manager) != address(0)) {
            sUSD.approve(address(manager), 0);
        }
        manager = _manager;
        sUSD.approve(manager, type(uint256).max);
        emit SetPositionalMarketManager(_manager);
    }

    /// @notice Updates contract parametars
    /// @param _liquidityPool address of ThalesAMMLiquidityPool
    function setLiquidityPool(ThalesAMMLiquidityPool _liquidityPool) external onlyOwner {
        liquidityPool = _liquidityPool;
    }

    /// @notice Updates contract parametars
    /// @param _curveSUSD curve sUSD pool exchanger contract
    /// @param _dai DAI address
    /// @param _usdc USDC address
    /// @param _usdt USDT addresss
    /// @param _curveOnrampEnabled whether AMM supports curve onramp
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
        IERC20Upgradeable(dai).approve(_curveSUSD, type(uint256).max);
        IERC20Upgradeable(usdc).approve(_curveSUSD, type(uint256).max);
        IERC20Upgradeable(usdt).approve(_curveSUSD, type(uint256).max);
        // not needed unless selling into different collateral is enabled
        //sUSD.approve(_curveSUSD, type(uint256).max);
        curveOnrampEnabled = _curveOnrampEnabled;
        maxAllowedPegSlippagePercentage = _maxAllowedPegSlippagePercentage;
    }

    /// @notice Updates contract parametars
    /// @param asset e.g. ETH, BTC, SNX
    /// @param _cap how much risk can AMM take on markets for given asset
    function setCapPerAsset(bytes32 asset, uint _cap) external onlyOwner {
        _capPerAsset[asset] = _cap;
        emit SetCapPerAsset(asset, _cap);
    }

    /// @notice Send tokens from this contract to the destination address
    /// @param tokens to iterate and transfer
    /// @param account Address where to send the tokens
    /// @param amount Amount of tokens to be sent
    /// @param all ignore amount and send whole balance
    function transferTokens(
        address[] calldata tokens,
        address payable account,
        uint amount,
        bool all
    ) external onlyOwner {
        require(tokens.length > 0, "tokens array cant be empty");
        for (uint256 index = 0; index < tokens.length; index++) {
            if (all) {
                IERC20Upgradeable(tokens[index]).safeTransfer(
                    account,
                    IERC20Upgradeable(tokens[index]).balanceOf(address(this))
                );
            } else {
                IERC20Upgradeable(tokens[index]).safeTransfer(account, amount);
            }
        }
    }

    // events
    event SoldToAMM(
        address seller,
        address market,
        IThalesAMM.Position position,
        uint amount,
        uint sUSDPaid,
        address susd,
        address asset
    );
    event BoughtFromAmm(
        address buyer,
        address market,
        IThalesAMM.Position position,
        uint amount,
        uint sUSDPaid,
        address susd,
        address asset
    );

    event BoughtWithDiscount(address buyer, uint amount, uint sUSDPaid);
    event BoughtOptionType(address buyer, uint sUSDPaid, bool inTheMoney);
    event SetPositionalMarketManager(address _manager);
    event SetSUSD(address sUSD);
    event SetPriceFeed(address _priceFeed);
    event SetImpliedVolatilityPerAsset(bytes32 asset, uint _impliedVolatility);
    event SetCapPerAsset(bytes32 asset, uint _cap);
    event SetMaxSpread(uint _spread);
    event SetMinSpread(uint _spread);
    event SetSafeBoxImpact(uint _safeBoxImpact);
    event SetSafeBox(address _safeBox);
    event SetMinimalTimeLeftToMaturity(uint _minimalTimeLeftToMaturity);
    event SetMinMaxSupportedPriceCapPerMarket(uint minPrice, uint maxPrice, uint capPerMarket);
    event ReferrerPaid(address refferer, address trader, uint amount, uint volume);
}

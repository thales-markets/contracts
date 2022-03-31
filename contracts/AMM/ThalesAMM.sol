// SPDX-License-Identifier: MIT
pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity-2.3.0/contracts/math/SafeMath.sol";
import "openzeppelin-solidity-2.3.0/contracts/math/Math.sol";
import "@openzeppelin/upgrades-core/contracts/Initializable.sol";

import "../utils/proxy/ProxyReentrancyGuard.sol";
import "../utils/proxy/ProxyOwned.sol";
import "../utils/proxy/ProxyPausable.sol";

import "../interfaces/IPriceFeed.sol";
import "../interfaces/IPositionalMarket.sol";
import "../interfaces/IPositionalMarketManager.sol";
import "../interfaces/IPosition.sol";
import "../interfaces/IStakingThales.sol";
import "../interfaces/IThalesAMM.sol";
import "./DeciMath.sol";

contract ThalesAMM is ProxyOwned, ProxyPausable, ProxyReentrancyGuard, Initializable, IThalesAMM {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    DeciMath public deciMath;

    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;

    uint private constant MIN_SUPPORTED_PRICE = 10e16;
    uint private constant MAX_SUPPORTED_PRICE = 90e16;

    IPriceFeed public priceFeed;
    IERC20 public sUSD;
    address public manager;

    uint public capPerMarket;
    uint public min_spread;
    uint public max_spread;

    mapping(bytes32 => uint) public impliedVolatilityPerAsset;

    uint public minimalTimeLeftToMaturity;

    struct MarketSkew {
        uint ups;
        uint downs;
    }

    mapping(address => uint) public spentOnMarket;

    address public safeBox;
    uint public safeBoxImpact;

    IStakingThales public stakingThales;

    uint public minSupportedPrice;
    uint public maxSupportedPrice;

    function initialize(
        address _owner,
        IPriceFeed _priceFeed,
        IERC20 _sUSD,
        uint _capPerMarket,
        DeciMath _deciMath,
        uint _min_spread,
        uint _max_spread,
        uint _minimalTimeLeftToMaturity
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        priceFeed = _priceFeed;
        sUSD = _sUSD;
        capPerMarket = _capPerMarket;
        deciMath = _deciMath;
        min_spread = _min_spread;
        max_spread = _max_spread;
        minimalTimeLeftToMaturity = _minimalTimeLeftToMaturity;
    }

    function availableToBuyFromAMM(address market, Position position) public view returns (uint) {
        if (isMarketInAMMTrading(market)) {
            uint basePrice = price(market, position);
            // ignore extremes
            if (basePrice <= minSupportedPrice || basePrice >= maxSupportedPrice) {
                return 0;
            }
            uint balance = _balanceOfPositionOnMarket(market, position);
            uint midImpactPriceIncrease = ONE.sub(basePrice).mul(min_spread.add(max_spread).div(2)).div(ONE);
            uint buy_mid_price = basePrice.add(midImpactPriceIncrease);

            uint divider_price = ONE.sub(buy_mid_price);

            uint minImpactPriceIncrease = ONE.sub(basePrice).mul(min_spread).div(ONE);
            uint buy_min_price = basePrice.add(minImpactPriceIncrease);
            uint additionalBufferFromSelling = balance.mul(buy_min_price).div(ONE);
            if (capPerMarket.add(additionalBufferFromSelling) <= spentOnMarket[market]) {
                return 0;
            }
            uint availableUntilCapSUSD = capPerMarket.add(additionalBufferFromSelling).sub(spentOnMarket[market]);

            return balance.add(availableUntilCapSUSD.mul(ONE).div(divider_price));
        } else {
            return 0;
        }
    }

    function buyFromAmmQuote(
        address market,
        Position position,
        uint amount
    ) public view returns (uint) {
        if (amount < 1) {
            return 0;
        }
        uint basePrice = price(market, position);
        uint impactPriceIncrease = ONE.sub(basePrice).mul(_buyPriceImpact(market, position, amount)).div(ONE);
        // add 2% to the price increase to avoid edge cases on the extremes
        impactPriceIncrease = impactPriceIncrease.mul(ONE.add(ONE_PERCENT * 2)).div(ONE);
        uint tempAmount = amount.mul(basePrice.add(impactPriceIncrease)).div(ONE);
        return tempAmount.mul(ONE.add(safeBoxImpact)).div(ONE);
    }

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

    function availableToSellToAMM(address market, Position position) public view returns (uint) {
        if (isMarketInAMMTrading(market)) {
            uint basePrice = price(market, position);
            // ignore extremes
            if (basePrice <= minSupportedPrice || basePrice >= maxSupportedPrice) {
                return 0;
            }

            (IPosition up, IPosition down) = IPositionalMarket(market).getOptions();
            uint balanceOfTheOtherSide =
                position == Position.Up ? down.getBalanceOf(address(this)) : up.getBalanceOf(address(this));

            uint sell_max_price = basePrice.mul(ONE.sub(max_spread.add(min_spread).div(2))).div(ONE);
            require(sell_max_price > 0, "div by zero sell_max_price");

            // can burn straight away balanceOfTheOtherSide
            uint willPay = balanceOfTheOtherSide.mul(sell_max_price).div(ONE);
            if (capPerMarket.add(balanceOfTheOtherSide) < spentOnMarket[market].add(willPay)) {
                return 0;
            }
            uint usdAvailable = capPerMarket.add(balanceOfTheOtherSide).sub(spentOnMarket[market]).sub(willPay);
            return usdAvailable.div(sell_max_price).mul(ONE).add(balanceOfTheOtherSide);
        } else return 0;
    }

    function sellToAmmQuote(
        address market,
        Position position,
        uint amount
    ) public view returns (uint) {
        if (amount > availableToSellToAMM(market, position)) {
            return 10;
        }
        uint basePrice = price(market, position);

        uint tempAmount = amount.mul(basePrice.mul(ONE.sub(_sellPriceImpact(market, position, amount))).div(ONE)).div(ONE);

        return tempAmount.mul(ONE.sub(safeBoxImpact)).div(ONE);
    }

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

    function price(address market, Position position) public view returns (uint) {
        if (isMarketInAMMTrading(market)) {
            // add price calculation
            IPositionalMarket marketContract = IPositionalMarket(market);
            (uint maturity, uint destructino) = marketContract.times();

            uint timeLeftToMaturity = maturity - block.timestamp;
            uint timeLeftToMaturityInDays = timeLeftToMaturity.mul(ONE).div(86400);
            uint oraclePrice = marketContract.oraclePrice();

            (bytes32 key, uint strikePrice, uint finalPrice) = marketContract.getOracleDetails();

            if (position == Position.Up) {
                return
                    calculateOdds(oraclePrice, strikePrice, timeLeftToMaturityInDays, impliedVolatilityPerAsset[key]).div(
                        1e2
                    );
            } else {
                return
                    ONE.sub(
                        calculateOdds(oraclePrice, strikePrice, timeLeftToMaturityInDays, impliedVolatilityPerAsset[key])
                            .div(1e2)
                    );
            }
        } else return 0;
    }

    function calculateOdds(
        uint price,
        uint strike,
        uint timeLeftInDays,
        uint volatility
    ) public view returns (uint) {
        uint vt = volatility.div(100).mul(sqrt(timeLeftInDays.div(365))).div(1e9);
        bool direction = strike >= price;
        uint lnBase = strike >= price ? strike.mul(ONE).div(price) : price.mul(ONE).div(strike);
        uint d1 = deciMath.ln(lnBase, 99).mul(ONE).div(vt);
        uint y = ONE.mul(ONE).div(ONE.add(d1.mul(2316419).div(1e7)));
        uint d2 = d1.mul(d1).div(2).div(ONE);
        uint z = _expneg(d2).mul(3989423).div(1e7);

        uint y5 = deciMath.pow(y, 5 * ONE).mul(1330274).div(1e6);
        uint y4 = deciMath.pow(y, 4 * ONE).mul(1821256).div(1e6);
        uint y3 = deciMath.pow(y, 3 * ONE).mul(1781478).div(1e6);
        uint y2 = deciMath.pow(y, 2 * ONE).mul(356538).div(1e6);
        uint y1 = y.mul(3193815).div(1e7);
        uint x1 = y5.add(y3).add(y1).sub(y4).sub(y2);
        uint x = ONE.sub(z.mul(x1).div(ONE));
        uint result = ONE.mul(1e2).sub(x.mul(1e2));
        if (direction) {
            return result;
        } else {
            return ONE.mul(1e2).sub(result);
        }
    }

    function isMarketInAMMTrading(address market) public view returns (bool) {
        if (IPositionalMarketManager(manager).isActiveMarket(market)) {
            IPositionalMarket marketContract = IPositionalMarket(market);
            (bytes32 key, uint strikePrice, uint finalPrice) = marketContract.getOracleDetails();
            //check if asset is supported
            if (impliedVolatilityPerAsset[key] == 0) {
                return false;
            }
            // add price calculation
            (uint maturity, uint destructino) = marketContract.times();
            if (maturity < block.timestamp) {
                return false;
            }
            uint timeLeftToMaturity = maturity - block.timestamp;
            return timeLeftToMaturity > minimalTimeLeftToMaturity;
        } else {
            return false;
        }
    }

    function canExerciseMaturedMarket(address market) public view returns (bool) {
        if (
            IPositionalMarketManager(manager).isKnownMarket(market) &&
            (IPositionalMarket(market).phase() == IPositionalMarket.Phase.Maturity)
        ) {
            (IPosition up, IPosition down) = IPositionalMarket(market).getOptions();
            if ((up.getBalanceOf(address(this)) > 0) || (down.getBalanceOf(address(this)) > 0)) {
                return true;
            }
        }
        return false;
    }

    // write methods

    function buyFromAMM(
        address market,
        Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) public nonReentrant notPaused {
        require(isMarketInAMMTrading(market), "Market is not in Trading phase");

        uint availableToBuyFromAMMatm = availableToBuyFromAMM(market, position);
        require(amount <= availableToBuyFromAMMatm, "Not enough liquidity.");

        uint sUSDPaid = buyFromAmmQuote(market, position, amount);
        require(sUSD.balanceOf(msg.sender) >= sUSDPaid, "You dont have enough sUSD.");
        require(sUSD.allowance(msg.sender, address(this)) >= sUSDPaid, "No allowance.");
        require(sUSDPaid.mul(ONE).div(expectedPayout) <= ONE.add(additionalSlippage), "Slippage too high");

        sUSD.safeTransferFrom(msg.sender, address(this), sUSDPaid);

        uint toMint = _getMintableAmount(market, position, amount);
        if (toMint > 0) {
            require(sUSD.balanceOf(address(this)) >= toMint, "Not enough sUSD in contract.");
            IPositionalMarket(market).mint(toMint);
            spentOnMarket[market] = spentOnMarket[market].add(toMint);
        }

        (IPosition up, IPosition down) = IPositionalMarket(market).getOptions();
        IPosition target = position == Position.Up ? up : down;
        IERC20(address(target)).transfer(msg.sender, amount);

        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(msg.sender, sUSDPaid);
        }
        _updateSpentOnOnMarketOnBuy(market, position, amount, sUSDPaid);

        emit BoughtFromAmm(msg.sender, market, position, amount, sUSDPaid, address(sUSD), address(target));
    }

    function sellToAMM(
        address market,
        Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) public nonReentrant notPaused {
        require(isMarketInAMMTrading(market), "Market is not in Trading phase");

        uint availableToSellToAMMATM = availableToSellToAMM(market, position);
        require(availableToSellToAMMATM > 0 && amount <= availableToSellToAMMATM, "Not enough liquidity.");

        uint pricePaid = sellToAmmQuote(market, position, amount);
        require(expectedPayout.mul(ONE).div(pricePaid) <= (ONE.add(additionalSlippage)), "Slippage too high");

        (IPosition up, IPosition down) = IPositionalMarket(market).getOptions();
        IPosition target = position == Position.Up ? up : down;

        require(target.getBalanceOf(msg.sender) >= amount, "You dont have enough options.");
        require(IERC20(address(target)).allowance(msg.sender, address(this)) >= amount, "No allowance.");

        //transfer options first to have max burn available
        IERC20(address(target)).safeTransferFrom(msg.sender, address(this), amount);
        uint sUSDFromBurning = IPositionalMarket(market).getMaximumBurnable(address(this));
        if (sUSDFromBurning > 0) {
            IPositionalMarket(market).burnOptionsMaximum();
        }

        require(sUSD.balanceOf(address(this)) >= pricePaid, "Not enough sUSD in contract.");

        sUSD.transfer(msg.sender, pricePaid);

        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(msg.sender, pricePaid);
        }
        _updateSpentOnMarketOnSell(market, position, amount, pricePaid, sUSDFromBurning);

        emit SoldToAMM(msg.sender, market, position, amount, pricePaid, address(sUSD), address(target));
    }

    function exerciseMaturedMarket(address market) external {
        require(IPositionalMarket(market).phase() == IPositionalMarket.Phase.Maturity, "Market is not in Maturity phase");
        require(IPositionalMarketManager(manager).isKnownMarket(market), "Unknown market");
        require(canExerciseMaturedMarket(market), "No options to exercise");
        IPositionalMarket(market).exerciseOptions();
    }

    // setters
    function setMinimalTimeLeftToMaturity(uint _minimalTimeLeftToMaturity) public onlyOwner {
        minimalTimeLeftToMaturity = _minimalTimeLeftToMaturity;
        emit SetMinimalTimeLeftToMaturity(_minimalTimeLeftToMaturity);
    }

    function setMinSpread(uint _spread) public onlyOwner {
        min_spread = _spread;
        emit SetMinSpread(_spread);
    }

    function setSafeBoxImpact(uint _safeBoxImpact) public onlyOwner {
        safeBoxImpact = _safeBoxImpact;
        emit SetSafeBoxImpact(_safeBoxImpact);
    }

    function setSafeBox(address _safeBox) public onlyOwner {
        safeBox = _safeBox;
        emit SetSafeBox(_safeBox);
    }

    function setMaxSpread(uint _spread) public onlyOwner {
        max_spread = _spread;
        emit SetMaxSpread(_spread);
    }

    function setMinSupportedPrice(uint _minSupportedPrice) public onlyOwner {
        minSupportedPrice = _minSupportedPrice;
        emit SetMinSupportedPrice(_minSupportedPrice);
    }

    function setMaxSupportedPrice(uint _maxSupportedPrice) public onlyOwner {
        maxSupportedPrice = _maxSupportedPrice;
        emit SetMaxSupportedPrice(_maxSupportedPrice);
    }

    function setImpliedVolatilityPerAsset(bytes32 asset, uint _impliedVolatility) public onlyOwner {
        impliedVolatilityPerAsset[asset] = _impliedVolatility;
        emit SetImpliedVolatilityPerAsset(asset, _impliedVolatility);
    }

    function setCapPerMarket(uint _capPerMarket) public onlyOwner {
        capPerMarket = _capPerMarket;
        emit SetCapPerMarket(_capPerMarket);
    }

    function setPriceFeed(IPriceFeed _priceFeed) public onlyOwner {
        priceFeed = _priceFeed;
        emit SetPriceFeed(address(_priceFeed));
    }

    function setSUSD(IERC20 _sUSD) public onlyOwner {
        sUSD = _sUSD;
        emit SetSUSD(address(sUSD));
    }

    function setStakingThales(IStakingThales _stakingThales) public onlyOwner {
        stakingThales = _stakingThales;
        emit SetStakingThales(address(_stakingThales));
    }

    function setPositionalMarketManager(address _manager) public onlyOwner {
        if (address(_manager) != address(0)) {
            sUSD.approve(address(_manager), 0);
        }
        manager = _manager;
        sUSD.approve(manager, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
        emit SetPositionalMarketManager(_manager);
    }

    // Internal

    function _updateSpentOnMarketOnSell(
        address market,
        Position position,
        uint amount,
        uint sUSDPaid,
        uint sUSDFromBurning
    ) internal {
        uint safeBoxShare = sUSDPaid.mul(ONE).div(ONE.sub(safeBoxImpact)).sub(sUSDPaid);

        if (safeBoxImpact > 0) {
            sUSD.transfer(safeBox, safeBoxShare);
        } else {
            safeBoxShare = 0;
        }

        spentOnMarket[market] = spentOnMarket[market].add(sUSDPaid.add(safeBoxShare));
        if (spentOnMarket[market] <= sUSDFromBurning) {
            spentOnMarket[market] = 0;
        } else {
            spentOnMarket[market] = spentOnMarket[market].sub(sUSDFromBurning);
        }
    }

    function _updateSpentOnOnMarketOnBuy(
        address market,
        Position position,
        uint amount,
        uint sUSDPaid
    ) internal {
        uint safeBoxShare = sUSDPaid.sub(sUSDPaid.mul(ONE).div(ONE.add(safeBoxImpact)));
        if (safeBoxImpact > 0) {
            sUSD.transfer(safeBox, safeBoxShare);
        } else {
            safeBoxShare = 0;
        }

        if (spentOnMarket[market] <= sUSDPaid.sub(safeBoxShare)) {
            spentOnMarket[market] = 0;
        } else {
            spentOnMarket[market] = spentOnMarket[market].sub(sUSDPaid.sub(safeBoxShare));
        }
    }

    function _buyPriceImpact(
        address market,
        Position position,
        uint amount
    ) internal view returns (uint) {
        (uint balancePosition, uint balanceOtherSide) = _balanceOfPositionsOnMarket(market, position);
        uint balancePositionAfter = balancePosition > amount ? balancePosition.sub(amount) : 0;
        uint balanceOtherSideAfter =
            balancePosition > amount ? balanceOtherSide : balanceOtherSide.add(amount.sub(balancePosition));
        if (balancePositionAfter >= balanceOtherSideAfter) {
            //minimal price impact as it will balance the AMM exposure
            return min_spread;
        } else {
            return
                _buyPriceImpactElse(
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
        uint newImpact = min_spread.add(max_spread.sub(min_spread).mul(skew.mul(ONE).div(maxPossibleSkew)).div(ONE));
        if (balancePosition > 0) {
            uint newPriceForMintedOnes = min_spread.add(newImpact).div(2);
            uint tempMultiplier =
                balancePosition.mul(min_spread).add(amount.sub(balancePosition).mul(newPriceForMintedOnes));
            return tempMultiplier.div(amount);
        } else {
            uint previousSkew = balanceOtherSide;
            uint previousImpact =
                min_spread.add(max_spread.sub(min_spread).mul(previousSkew.mul(ONE).div(maxPossibleSkew)).div(ONE));
            return newImpact.add(previousImpact).div(2);
        }
    }

    function balancePosition(
        address market,
        Position position,
        uint amount
    ) public view returns (uint) {
        (uint balancePosition, uint balanceOtherSide) = _balanceOfPositionsOnMarket(market, position);
        uint balancePositionAfter = balancePosition > amount ? balancePosition.sub(amount) : 0;
        uint balanceOtherSideAfter =
            balancePosition > amount ? balanceOtherSide : balanceOtherSide.add(amount.sub(balancePosition));
        return balancePosition;
    }

    function _sellPriceImpact(
        address market,
        Position position,
        uint amount
    ) internal view returns (uint) {
        (uint balancePosition, uint balanceOtherSide) = _balanceOfPositionsOnMarket(market, position);
        uint balancePositionAfter =
            balancePosition > 0 ? balancePosition.add(amount) : balanceOtherSide > amount ? 0 : amount.sub(balanceOtherSide);
        uint balanceOtherSideAfter = balanceOtherSide > amount ? balanceOtherSide.sub(amount) : 0;
        if (balancePositionAfter < balanceOtherSideAfter) {
            //minimal price impact as it will balance the AMM exposure
            return min_spread;
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
        uint newImpact = min_spread.add(max_spread.sub(min_spread).mul(skew.mul(ONE).div(maxPossibleSkew)).div(ONE));

        if (balanceOtherSide > 0) {
            uint newPriceForMintedOnes = min_spread.add(newImpact).div(2);
            uint tempMultiplier =
                balancePosition.mul(min_spread).add(amount.sub(balancePosition).mul(newPriceForMintedOnes));
            return tempMultiplier.div(amount);
        } else {
            uint previousSkew = balancePosition;
            uint previousImpact =
                min_spread.add(max_spread.sub(min_spread).mul(previousSkew.mul(ONE).div(maxPossibleSkew)).div(ONE));
            return newImpact.add(previousImpact).div(2);
        }
    }

    function _getMintableAmount(
        address market,
        Position position,
        uint amount
    ) internal view returns (uint mintable) {
        uint availableInContract = _balanceOfPositionOnMarket(market, position);
        mintable = 0;
        if (availableInContract < amount) {
            mintable = amount.sub(availableInContract);
        }
    }

    function _minimalBuyPrice(address market, Position position) internal view returns (uint) {
        return price(market, position).mul(ONE.add(min_spread)).div(ONE);
    }

    function _minimalSellPrice(address market, Position position) internal view returns (uint) {
        return price(market, position).mul(ONE.sub(min_spread)).div(ONE);
    }

    function _balanceOfPositionOnMarket(address market, Position position) internal view returns (uint) {
        (IPosition up, IPosition down) = IPositionalMarket(market).getOptions();
        uint balance = position == Position.Up ? up.getBalanceOf(address(this)) : down.getBalanceOf(address(this));
        return balance;
    }

    function _balanceOfPositionsOnMarket(address market, Position position) internal view returns (uint, uint) {
        (IPosition up, IPosition down) = IPositionalMarket(market).getOptions();
        uint balance = position == Position.Up ? up.getBalanceOf(address(this)) : down.getBalanceOf(address(this));
        uint balanceOtherSide = position == Position.Up ? down.getBalanceOf(address(this)) : up.getBalanceOf(address(this));
        return (balance, balanceOtherSide);
    }

    function _expneg(uint x) internal view returns (uint result) {
        result = (ONE * ONE) / _expNegPow(x);
    }

    function _expNegPow(uint x) internal view returns (uint result) {
        uint e = 2718280000000000000;
        result = deciMath.pow(e, x);
    }

    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function retrieveSUSD(address payable account) external onlyOwner {
        sUSD.transfer(account, sUSD.balanceOf(address(this)));
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

    event SetPositionalMarketManager(address _manager);
    event SetSUSD(address sUSD);
    event SetPriceFeed(address _priceFeed);
    event SetCapPerMarket(uint _capPerMarket);
    event SetImpliedVolatilityPerAsset(bytes32 asset, uint _impliedVolatility);
    event SetMaxSpread(uint _spread);
    event SetMinSpread(uint _spread);
    event SetSafeBoxImpact(uint _safeBoxImpact);
    event SetSafeBox(address _safeBox);
    event SetMinimalTimeLeftToMaturity(uint _minimalTimeLeftToMaturity);
    event SetStakingThales(address _stakingThales);
    event SetMinSupportedPrice(uint _spread);
    event SetMaxSupportedPrice(uint _spread);
}

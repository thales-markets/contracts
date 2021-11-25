pragma solidity ^0.5.16;

import "synthetix-2.50.4-ovm/contracts/Pausable.sol";
import "openzeppelin-solidity-2.3.0/contracts/ownership/Ownable.sol";
import "synthetix-2.50.4-ovm/contracts/interfaces/IERC20.sol";
import "openzeppelin-solidity-2.3.0/contracts/math/Math.sol";
import "synthetix-2.50.4-ovm/contracts/SafeDecimalMath.sol";

import "../interfaces/IPriceFeed.sol";
import "../interfaces/IBinaryOptionMarket.sol";
import "../interfaces/IBinaryOption.sol";
import "./DeciMath.sol";

contract ThalesAMM is Owned, Pausable {
    using SafeMath for uint;
    using SafeDecimalMath for uint;

    DeciMath public deciMath;

    uint public capPerMarket = 1000 * 1e18;
    IPriceFeed public priceFeed;
    IERC20 public sUSD;
    address public manager;

    uint public impliedVolatility = 120 * 1e18;

    struct MarketSkew {
        uint longs;
        uint shorts;
    }

    enum Position {Long, Short}

    mapping(address => uint) public spentOnMarket;

    constructor(
        address _owner,
        IPriceFeed _priceFeed,
        IERC20 _sUSD,
        uint _capPerMarket,
        DeciMath _deciMath
    ) public Owned(_owner) {
        priceFeed = _priceFeed;
        sUSD = _sUSD;
        capPerMarket = _capPerMarket;
        deciMath = _deciMath;
    }

    function setBinaryOptionsMarketManager(address _manager) public onlyOwner {
        if (address(_manager) != address(0)) {
            sUSD.approve(address(_manager), 0);
        }
        manager = _manager;
        sUSD.approve(manager, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
    }

    function buyFromAMM(
        address market,
        Position position,
        uint amount
    ) public {
        require(amount < availableToBuyFromAMM(market, position), "Not enough liquidity.");

        uint sUSDPaid = amount.mul(price(market, position)).div(1e18);
        require(sUSD.balanceOf(msg.sender) >= sUSDPaid, "You dont have enough sUSD.");
        require(sUSD.allowance(msg.sender, address(this)) >= sUSDPaid, "No allowance.");

        uint availableInContract = balanceOfPositionOnMarket(market, position);

        uint toMint = 0;
        if (availableInContract < amount) {
            toMint = amount.sub(availableInContract);
            require(sUSD.balanceOf(address(this)) >= toMint, "Not enough sUSD in contract.");
            IBinaryOptionMarket(market).mint(toMint);
        }

        (IBinaryOption long, IBinaryOption short) = IBinaryOptionMarket(market).options();
        IBinaryOption target = position == Position.Long ? long : short;

        IERC20(address(target)).transfer(msg.sender, amount);
        sUSD.transferFrom(msg.sender, address(this), sUSDPaid);

        spentOnMarket[market] = spentOnMarket[market].add(toMint).sub(sUSDPaid);
    }

    function availableToBuyFromAMM(address market, Position position) public view returns (uint) {
        uint balance = balanceOfPositionOnMarket(market, position);
        uint availableUntilCapSUSD = capPerMarket.sub(spentOnMarket[market]);
        uint curprice = price(market, position);
        uint one = 1e18;
        uint additionalBufferFromSelling = availableUntilCapSUSD.div(one.sub(curprice)).mul(1e18);
        return balance.add(additionalBufferFromSelling);
    }

    function sellToAMM(
        address market,
        Position position,
        uint amount
    ) public {
        uint couldbuy = availableToSellToAMM(market, position);
        require(amount < couldbuy, "cant buy that much");

        (IBinaryOption long, IBinaryOption short) = IBinaryOptionMarket(market).options();
        IBinaryOption target = position == Position.Long ? long : short;
        uint pricePaid = amount.mul(price(market, position));

        sUSD.transfer(msg.sender, amount.mul(price(market, position)));
        IERC20(address(target)).transferFrom(msg.sender, address(this), amount);

        spentOnMarket[market] = spentOnMarket[market].add(pricePaid);
    }

    function availableToSellToAMM(address market, Position position) public view returns (uint) {
        // add burn to BinaryOptions market so that if AMM has 0 long and 1000 short it can still buy longs by burning the longs and getting sUSD back
        //e.g.
        //in the example above the bot would be able to buy up to 1000 shorts
        uint curprice = price(market, position);
        uint sUSDFromBurning = IBinaryOptionMarket(market).getMaximumBurnable(address(this));
        uint couldBuy = capPerMarket.add(sUSDFromBurning).sub(spentOnMarket[market]).div(curprice);
        return couldBuy;
    }

    function getBuyQuote(
        address market,
        Position position,
        uint amount
    ) public view returns (uint) {
        return price(market, position).mul(amount);
    }

    function getSellQuote(
        address market,
        Position position,
        uint amount
    ) public view returns (uint) {
        return price(market, position).mul(amount);
    }

    function price(address market, Position position) public view returns (uint) {
        // add price calculation
        IBinaryOptionMarket marketContract = IBinaryOptionMarket(market);
        (uint maturity, uint destructino) = marketContract.times();

        uint timeLeftToMaturity = maturity - block.timestamp;
        uint timeLeftToMaturityInDays = timeLeftToMaturity.mul(1e18).div(86400);
        uint oraclePrice = marketContract.oraclePrice();

        (bytes32 key, uint strikePrice, uint finalPrice) = marketContract.oracleDetails();

        return calculateOdds(oraclePrice, strikePrice, timeLeftToMaturityInDays, impliedVolatility).div(1e2);
    }

    function oraclePrice(address market, Position position) public view returns (uint) {
        // add price calculation
        IBinaryOptionMarket marketContract = IBinaryOptionMarket(market);
        (uint maturity, uint destructino) = marketContract.times();

        uint timeLeftToMaturity = maturity - block.timestamp;
        uint oraclePrice = marketContract.oraclePrice();

        (bytes32 key, uint strikePrice, uint finalPrice) = marketContract.oracleDetails();

        return oraclePrice;
    }

    function strikePrice(address market, Position position) public view returns (uint) {
        // add price calculation
        IBinaryOptionMarket marketContract = IBinaryOptionMarket(market);
        (uint maturity, uint destructino) = marketContract.times();

        uint timeLeftToMaturity = maturity - block.timestamp;
        uint oraclePrice = marketContract.oraclePrice();

        (bytes32 key, uint strikePrice, uint finalPrice) = marketContract.oracleDetails();

        return strikePrice;
    }

    function timeLeftToMaturityInDays(address market, Position position) public view returns (uint) {
        // add price calculation
        IBinaryOptionMarket marketContract = IBinaryOptionMarket(market);
        (uint maturity, uint destructino) = marketContract.times();

        uint timeLeftToMaturity = maturity - block.timestamp;
        uint timeLeftToMaturityInDays = timeLeftToMaturity.mul(1e18).div(86400);
        uint oraclePrice = marketContract.oraclePrice();

        (bytes32 key, uint strikePrice, uint finalPrice) = marketContract.oracleDetails();

        return timeLeftToMaturityInDays;
    }

    function calculateOdds(
        uint price,
        uint strike,
        uint timeLeftInDays,
        uint volatility
    ) public view returns (uint) {
        uint vt = volatility.div(100).mul(sqrt(timeLeftInDays.div(365))).div(1e9);
        uint d1 = deciMath.ln(strike.mul(1e18).div(price), 99).mul(1e18).div(vt);
        uint one = 1e18;
        uint y = one.mul(1e18).div(one.add(d1.mul(2316419).div(1e7)));
        uint d2 = d1.mul(d1).div(2).div(1e18);
        uint z = expneg(d2).mul(3989423).div(1e7);

        uint y5 = deciMath.pow(y, 5 * 1e18).mul(1330274).div(1e6);
        uint y4 = deciMath.pow(y, 4 * 1e18).mul(1821256).div(1e6);
        uint y3 = deciMath.pow(y, 3 * 1e18).mul(1781478).div(1e6);
        uint y2 = deciMath.pow(y, 2 * 1e18).mul(356538).div(1e6);
        uint y1 = y.mul(3193815).div(1e7);
        uint x1 = y5.add(y3).add(y1).sub(y4).sub(y2);
        uint x = one.sub(z.mul(x1).div(1e18));
        uint result = one.mul(1e2).sub(x.mul(1e2));

        return result;
    }

    function power(uint A, uint B) public returns (uint256) {
        return A**B;
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

    function balanceOfPositionOnMarket(address market, Position position) internal view returns (uint) {
        (IBinaryOption long, IBinaryOption short) = IBinaryOptionMarket(market).options();
        uint balance = position == Position.Long ? long.balanceOf(address(this)) : short.balanceOf(address(this));
        return balance;
    }

    function setImpliedVolatility(uint _impliedVolatility) public onlyOwner {
        impliedVolatility = _impliedVolatility;
    }

    function expneg(uint x) public view returns (uint result) {
        result = (1e18 * 1e18) / expnegpow(x);
    }

    function expnegpow(uint x) public view returns (uint result) {
        uint e = 2718280000000000000;
        result = deciMath.pow(e, x);
    }
}

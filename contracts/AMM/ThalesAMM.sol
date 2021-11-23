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

    function buyFromAMM(
        address market,
        Position position,
        uint amount
    ) public {
        uint balance = balanceOfPositionOnMarket(market, position);
        uint needToMint = amount;

        if (balance > amount) {
            uint needToMint = amount.sub(balance);
            require(spentOnMarket[market].add(needToMint) < capPerMarket, "Not enough options to sell");
            IBinaryOptionMarket(market).mint(needToMint);
        }

        (IBinaryOption long, IBinaryOption short) = IBinaryOptionMarket(market).options();
        IBinaryOption target = position == Position.Long ? long : short;
        uint pricePaid = amount.mul(price(market, position));

        IERC20(address(target)).transfer(msg.sender, amount.mul(price(market, position)));
        sUSD.transferFrom(msg.sender, address(this), amount);

        spentOnMarket[market] = spentOnMarket[market].add(needToMint).sub(pricePaid);
    }

    function availableToBuyFromAMM(address market, Position position) public view returns (uint) {
        uint balance = balanceOfPositionOnMarket(market, position);
        uint couldmint = capPerMarket.sub(spentOnMarket[market]);
        return balance.add(couldmint).div(1e18);
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
        uint couldBuy = capPerMarket.sub(spentOnMarket[market]).div(curprice);
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

        uint timeLeftToMaturity = block.timestamp - maturity;
        uint oraclePrice = marketContract.oraclePrice();

        (bytes32 key, uint strikePrice, uint finalPrice) = marketContract.oracleDetails();

        uint impliedVolatility = 140 * 1e18;

        // TODO: inject the odds calculation
        return position == Position.Long ? 4 * 1e17 : 6 * 1e17;
    }

    function calculateOdds(
        uint price,
        uint strike,
        uint timeLeftInDays,
        uint volatility
    ) public view returns (uint) {
        uint vt = (volatility / 100) * sqrt((timeLeftInDays * 1e18) / 365) * 1e9;
        uint d1 = (deciMath.ln(((strike * 1e18) / price), 99) * 1e18) / vt;
        uint one = 1e18;
        uint y = one.mul(1e18).div(1e18 + (2316419 * d1) / 1e7);
        uint d2 = ((d1 * d1) / 2) / 1e18;
        uint z = (3989423 * expneg(d2)) / 1e7;

        uint y5 = (1330274 * deciMath.pow(y, 5 * 1e18)) / 1e6;
        uint y4 = (1821256 * deciMath.pow(y, 4 * 1e18)) / 1e6;
        uint y3 = (1781478 * deciMath.pow(y, 3 * 1e18)) / 1e6;
        uint y2 = (356538 * deciMath.pow(y, 2 * 1e18)) / 1e6;
        uint y1 = (3193815 * y) / 1e7;
        uint x1 = y5.add(y3).add(y1).sub(y4).sub(y2);
        uint x = one - z.mul(x1) / 1e18;
        //        x = deciMath.floor(x * 100000) / 100000;
        //
        //        if (d1 < 0) {
        //            x = 1 - x;
        //        }
        //
        uint result = one * 1e2 - x * 1e2;

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

    function lntest(uint256 x) public view returns (uint256 result) {
        // Do the fixed-point multiplication inline to save gas. This is overflow-safe because the maximum value that log2(x)
        // can return is 195205294292027477728.
        result = deciMath.ln(x, 99);
    }

    function exptest(uint256 x) public view returns (uint256 result) {
        // Do the fixed-point multiplication inline to save gas. This is overflow-safe because the maximum value that log2(x)
        // can return is 195205294292027477728.
        result = deciMath.exp(x);
    }

    function expneg(uint x) public view returns (uint result) {
        result = (1e18 * 1e18) / expnegpow(x);
    }

    function expnegpow(uint x) public view returns (uint result) {
        uint e = 2718280000000000000;
        result = deciMath.pow(e, x);
    }

    function balanceOfPositionOnMarket(address market, Position position) internal view returns (uint) {
        (IBinaryOption long, IBinaryOption short) = IBinaryOptionMarket(market).options();
        uint balance = position == Position.Long ? long.balanceOf(address(this)) : short.balanceOf(address(this));
        return balance;
    }
}

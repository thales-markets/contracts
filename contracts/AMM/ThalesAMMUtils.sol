// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@prb/math/contracts/PRBMathUD60x18.sol";

import "../interfaces/IThalesAMM.sol";
import "../interfaces/IPositionalMarket.sol";

/// @title An AMM using BlackScholes odds algorithm to provide liqudidity for traders of UP or DOWN positions
contract ThalesAMMUtils {
    using PRBMathUD60x18 for uint256;

    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;

    struct PriceImpactParams {
        uint amount;
        uint balanceOtherSide;
        uint balancePosition;
        uint balanceOtherSideAfter;
        uint balancePositionAfter;
        uint availableToBuyFromAMM;
        uint max_spread;
    }

    struct DiscountParams {
        uint balancePosition;
        uint balanceOtherSide;
        uint amount;
        uint availableToBuyFromAMM;
        uint max_spread;
    }

    struct BuyUtilsPriceImpactParams {
        address market;
        IThalesAMM.Position position;
        uint amount;
        uint _availableToBuyFromAMM;
        uint _availableToBuyFromAMMOtherSide;
        address roundPool;
        uint basePrice;
        uint max_spread;
        uint impliedVolPerAsset;
    }

    // IThalesAMM public thalesAMM;

    // constructor(address _thalesAMM) {
    //     thalesAMM = IThalesAMM(_thalesAMM);
    // }

    /// @notice get the algorithmic odds of market being in the money, taken from JS code https://gist.github.com/aasmith/524788/208694a9c74bb7dfcb3295d7b5fa1ecd1d662311
    /// @param _price current price of the asset
    /// @param strike price of the asset
    /// @param timeLeftInDays when does the market mature
    /// @param volatility implied yearly volatility of the asset
    /// @return result odds of market being in the money
    function calculateOdds(
        uint _price,
        uint strike,
        uint timeLeftInDays,
        uint volatility
    ) public view returns (uint result) {
        uint vt = ((volatility / (100)) * (sqrt(timeLeftInDays / (365)))) / (1e9);
        bool direction = strike >= _price;
        uint lnBase = strike >= _price ? (strike * (ONE)) / (_price) : (_price * (ONE)) / (strike);
        uint d1 = (PRBMathUD60x18.ln(lnBase) * (ONE)) / (vt);
        uint y = (ONE * (ONE)) / (ONE + ((d1 * (2316419)) / (1e7)));
        uint d2 = (d1 * (d1)) / (2) / (ONE);
        if (d2 < 130 * ONE) {
            uint z = (_expneg(d2) * (3989423)) / (1e7);

            uint y5 = (powerInt(y, 5) * (1330274)) / (1e6);
            uint y4 = (powerInt(y, 4) * (1821256)) / (1e6);
            uint y3 = (powerInt(y, 3) * (1781478)) / (1e6);
            uint y2 = (powerInt(y, 2) * (356538)) / (1e6);
            uint y1 = (y * (3193815)) / (1e7);
            uint x1 = y5 + (y3) + (y1) - (y4) - (y2);
            uint x = ONE - ((z * (x1)) / (ONE));
            result = ONE * (1e2) - (x * (1e2));
            if (direction) {
                return result;
            } else {
                return ONE * (1e2) - result;
            }
        } else {
            result = direction ? 0 : ONE * 1e2;
        }
    }

    function _expneg(uint x) internal view returns (uint result) {
        result = (ONE * ONE) / _expNegPow(x);
    }

    function _expNegPow(uint x) internal view returns (uint result) {
        uint e = 2718280000000000000;
        result = PRBMathUD60x18.pow(e, x);
    }

    function powerInt(uint A, int8 B) internal pure returns (uint result) {
        result = ONE;
        for (int8 i = 0; i < B; i++) {
            result = (result * (A)) / (ONE);
        }
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

    function calculateDiscount(DiscountParams memory params) public view returns (int) {
        uint currentBuyImpactOtherSide = buyPriceImpactImbalancedSkew(
            PriceImpactParams(
                params.amount,
                params.balancePosition,
                params.balanceOtherSide,
                params.balanceOtherSide > ONE
                    ? params.balancePosition
                    : params.balancePosition + (ONE - params.balanceOtherSide),
                params.balanceOtherSide > ONE ? params.balanceOtherSide - ONE : 0,
                params.availableToBuyFromAMM,
                params.max_spread
            )
        );

        uint startDiscount = currentBuyImpactOtherSide;
        uint tempMultiplier = params.balancePosition - params.amount;
        uint finalDiscount = ((startDiscount / 2) * ((tempMultiplier * ONE) / params.balancePosition + ONE)) / ONE;

        return -int(finalDiscount);
    }

    function buyPriceImpactImbalancedSkew(PriceImpactParams memory params) public view returns (uint) {
        uint maxPossibleSkew = params.balanceOtherSide + params.availableToBuyFromAMM - params.balancePosition;
        uint skew = params.balanceOtherSideAfter - (params.balancePositionAfter);
        uint newImpact = (params.max_spread * ((skew * ONE) / (maxPossibleSkew))) / ONE;
        if (params.balancePosition > 0 && params.amount > params.balancePosition) {
            uint newPriceForMintedOnes = newImpact / (2);
            uint tempMultiplier = (params.amount - params.balancePosition) * (newPriceForMintedOnes);
            return (tempMultiplier * ONE) / (params.amount) / ONE;
        } else {
            uint previousSkew = params.balanceOtherSide;
            uint previousImpact = (params.max_spread * ((previousSkew * ONE) / (maxPossibleSkew))) / ONE;
            return (newImpact + previousImpact) / (2);
        }
    }

    function sellPriceImpactImbalancedSkew(
        uint amount,
        uint balanceOtherSide,
        uint _balancePosition,
        uint balanceOtherSideAfter,
        uint balancePositionAfter,
        uint available,
        uint max_spread
    ) public view returns (uint _sellImpactReturned) {
        uint maxPossibleSkew = _balancePosition + (available) - (balanceOtherSide);
        uint skew = balancePositionAfter - (balanceOtherSideAfter);
        uint newImpact = (max_spread * ((skew * ONE) / (maxPossibleSkew))) / ONE;

        if (balanceOtherSide > 0 && amount > _balancePosition) {
            uint newPriceForMintedOnes = newImpact / (2);
            uint tempMultiplier = (amount - _balancePosition) * (newPriceForMintedOnes);
            _sellImpactReturned = tempMultiplier / (amount);
        } else {
            uint previousSkew = _balancePosition;
            uint previousImpact = (max_spread * ((previousSkew * ONE) / (maxPossibleSkew))) / ONE;
            _sellImpactReturned = (newImpact + previousImpact) / (2);
        }
    }

    function balanceOfPositionOnMarket(
        address market,
        IThalesAMM.Position position,
        address addressToCheck
    ) public view returns (uint balance) {
        (IPosition up, IPosition down) = IPositionalMarket(market).getOptions();
        balance = position == IThalesAMM.Position.Up ? up.getBalanceOf(addressToCheck) : down.getBalanceOf(addressToCheck);
    }

    function balanceOfPositionsOnMarket(
        address market,
        IThalesAMM.Position position,
        address addressToCheck
    ) public view returns (uint balance, uint balanceOtherSide) {
        (IPosition up, IPosition down) = IPositionalMarket(market).getOptions();
        balance = position == IThalesAMM.Position.Up ? up.getBalanceOf(addressToCheck) : down.getBalanceOf(addressToCheck);
        balanceOtherSide = position == IThalesAMM.Position.Up
            ? down.getBalanceOf(addressToCheck)
            : up.getBalanceOf(addressToCheck);
    }

    function getBalanceOfPositionsOnMarket(address market, address addressToCheck)
        public
        view
        returns (uint upBalance, uint downBalance)
    {
        (IPosition up, IPosition down) = IPositionalMarket(market).getOptions();
        upBalance = up.getBalanceOf(addressToCheck);
        downBalance = down.getBalanceOf(addressToCheck);
    }

    function sellPriceImpact(
        address market,
        IThalesAMM.Position position,
        uint amount,
        uint available,
        address liquidityPoolAddress,
        uint max_spread
    ) public view returns (uint _sellImpact) {
        (uint _balancePosition, uint balanceOtherSide) = balanceOfPositionsOnMarket(market, position, liquidityPoolAddress);
        uint balancePositionAfter = _balancePosition > 0 ? _balancePosition + (amount) : balanceOtherSide > amount
            ? 0
            : amount - (balanceOtherSide);
        uint balanceOtherSideAfter = balanceOtherSide > amount ? balanceOtherSide - (amount) : 0;
        if (!(balancePositionAfter < balanceOtherSideAfter)) {
            _sellImpact = sellPriceImpactImbalancedSkew(
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

    function price(
        address market,
        IThalesAMM.Position position,
        uint impliedVolPerAsset
    ) public view returns (uint priceToReturn) {
        // add price calculation
        IPositionalMarket marketContract = IPositionalMarket(market);
        (uint maturity, ) = marketContract.times();

        uint timeLeftToMaturity = maturity - block.timestamp;
        uint timeLeftToMaturityInDays = (timeLeftToMaturity * ONE) / 86400;
        uint oraclePrice = marketContract.oraclePrice();

        (bytes32 key, uint strikePrice, ) = marketContract.getOracleDetails();

        priceToReturn = calculateOdds(oraclePrice, strikePrice, timeLeftToMaturityInDays, impliedVolPerAsset) / 1e2;

        if (position == IThalesAMM.Position.Down) {
            priceToReturn = ONE - priceToReturn;
        }
    }

    function availableToSellToAMM(
        address market,
        IThalesAMM.Position position,
        uint basePrice,
        address liquidityPoolAddress,
        uint capOnMarket,
        uint spentOnMarket,
        uint sellMaxPrice
    ) public view returns (uint _available) {
        if (sellMaxPrice > 0) {
            (, uint balanceOfTheOtherSide) = balanceOfPositionsOnMarket(market, position, liquidityPoolAddress);

            // any balanceOfTheOtherSide will be burned to get sUSD back (1 to 1) at the `willPay` cost
            uint willPay = (balanceOfTheOtherSide * (sellMaxPrice)) / ONE;
            uint capWithBalance = capOnMarket + (balanceOfTheOtherSide);
            if (capWithBalance >= (spentOnMarket + willPay)) {
                uint usdAvailable = capWithBalance - spentOnMarket - (willPay);
                _available = (usdAvailable / (sellMaxPrice)) * ONE + (balanceOfTheOtherSide);
            }
        }
    }

    function availableToBuyFromAMMWithBasePrice(
        address market,
        IThalesAMM.Position position,
        uint basePrice,
        bool skipCheck,
        address liquidityPoolAddress,
        uint capOnMarket,
        uint spentOnMarket,
        uint max_spread,
        uint min_spread
    ) public view returns (uint availableAmount) {
        basePrice = basePrice + min_spread;
        if (basePrice < ONE) {
            uint discountedPrice = (basePrice * (ONE - max_spread / 2)) / ONE;
            uint balance = balanceOfPositionOnMarket(market, position, liquidityPoolAddress);
            uint additionalBufferFromSelling = (balance * discountedPrice) / ONE;

            if ((capOnMarket + additionalBufferFromSelling) > spentOnMarket) {
                uint availableUntilCapSUSD = capOnMarket + additionalBufferFromSelling - spentOnMarket;
                if (availableUntilCapSUSD > capOnMarket) {
                    availableUntilCapSUSD = capOnMarket;
                }

                uint midImpactPriceIncrease = ((ONE - basePrice) * (max_spread / 2)) / ONE;
                if ((basePrice + midImpactPriceIncrease) < ONE) {
                    uint divider_price = ONE - (basePrice + midImpactPriceIncrease);

                    availableAmount = balance + ((availableUntilCapSUSD * ONE) / divider_price);
                }
            }
        }
    }

    function buyPriceImpact(BuyUtilsPriceImpactParams memory params) public view returns (int priceImpact) {
        (uint balancePosition, uint balanceOtherSide) = balanceOfPositionsOnMarket(
            params.market,
            params.position,
            params.roundPool
        );

        uint balancePositionAfter = balancePosition > params.amount ? balancePosition - params.amount : 0;
        uint balanceOtherSideAfter = balanceOtherSide +
            (balancePosition > params.amount ? 0 : (params.amount - balancePosition));
        if (balancePositionAfter >= balanceOtherSideAfter) {
            priceImpact = calculateDiscount(
                DiscountParams(
                    balancePosition,
                    balanceOtherSide,
                    params.amount,
                    params._availableToBuyFromAMMOtherSide,
                    params.max_spread
                )
            );
        } else {
            if (params.amount > balancePosition && balancePosition > 0) {
                uint amountToBeMinted = params.amount - balancePosition;
                uint positiveSkew = buyPriceImpactImbalancedSkew(
                    PriceImpactParams(
                        amountToBeMinted,
                        balanceOtherSide + balancePosition,
                        0,
                        balanceOtherSide + amountToBeMinted,
                        0,
                        params._availableToBuyFromAMM - balancePosition,
                        params.max_spread
                    )
                );

                uint pricePosition = price(params.market, params.position, params.impliedVolPerAsset);
                uint priceOtherPosition = price(
                    params.market,
                    params.position == IThalesAMM.Position.Up ? IThalesAMM.Position.Down : IThalesAMM.Position.Up,
                    params.impliedVolPerAsset
                );
                uint skew = (priceOtherPosition * positiveSkew) / pricePosition;

                int discount = calculateDiscount(
                    DiscountParams(
                        balancePosition,
                        balanceOtherSide,
                        balancePosition,
                        params._availableToBuyFromAMMOtherSide,
                        params.max_spread
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
                    buyPriceImpactImbalancedSkew(
                        PriceImpactParams(
                            params.amount,
                            balanceOtherSide,
                            balancePosition,
                            balanceOtherSideAfter,
                            balancePositionAfter,
                            params._availableToBuyFromAMM,
                            params.max_spread
                        )
                    )
                );
            }
        }
    }
}

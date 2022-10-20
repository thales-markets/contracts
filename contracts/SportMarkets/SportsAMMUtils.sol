// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/ISportPositionalMarket.sol";
import "../interfaces/ISportPositionalMarketManager.sol";
import "../interfaces/IPosition.sol";
import "../interfaces/ITherundownConsumer.sol";
import "../interfaces/IApexConsumer.sol";
import "../interfaces/ISportsAMM.sol";

/// @title Sports AMM utils
contract SportsAMMUtils {
    uint private constant ONE = 1e18;
    uint private constant ZERO_POINT_ONE = 1e17;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant MAX_APPROVAL = type(uint256).max;
    int private constant ONE_INT = 1e18;
    int private constant ONE_PERCENT_INT = 1e16;

    struct DiscountParams {
        uint balancePosition;
        uint balanceOtherSide;
        uint amount;
        uint availableToBuyFromAMM;
        uint max_spread;
    }

    struct NegativeDiscountsParams {
        uint amount;
        uint balancePosition;
        uint balanceOtherSide;
        uint _availableToBuyFromAMMOtherSide;
        uint _availableToBuyFromAMM;
        uint pricePosition;
        uint priceOtherPosition;
        uint max_spread;
    }

    function sellPriceImpactImbalancedSkew(
        uint amount,
        uint balanceOtherSide,
        uint _balancePosition,
        uint balanceOtherSideAfter,
        uint balancePositionAfter,
        uint available,
        uint max_spread
    ) external view returns (uint _sellImpactReturned) {
        uint maxPossibleSkew = _balancePosition + (available) - (balanceOtherSide);
        uint skew = balancePositionAfter - (balanceOtherSideAfter);
        uint newImpact = (max_spread * ((skew * ONE) / (maxPossibleSkew))) / ONE;

        if (balanceOtherSide > 0) {
            uint newPriceForMintedOnes = newImpact / (2);
            uint tempMultiplier = (amount - _balancePosition) * (newPriceForMintedOnes);
            _sellImpactReturned = tempMultiplier / (amount);
        } else {
            uint previousSkew = _balancePosition;
            uint previousImpact = (max_spread * ((previousSkew * ONE) / (maxPossibleSkew))) / ONE;
            _sellImpactReturned = (newImpact + previousImpact) / (2);
        }
    }

    function buyPriceImpactImbalancedSkew(
        uint amount,
        uint balanceOtherSide,
        uint balancePosition,
        uint balanceOtherSideAfter,
        uint balancePositionAfter,
        uint availableToBuyFromAMM,
        uint max_spread
    ) public view returns (uint) {
        uint maxPossibleSkew = balanceOtherSide + availableToBuyFromAMM - balancePosition;
        uint skew = balanceOtherSideAfter - (balancePositionAfter);
        uint newImpact = (max_spread * ((skew * ONE) / (maxPossibleSkew))) / ONE;
        if (balancePosition > 0) {
            uint newPriceForMintedOnes = newImpact / (2);
            uint tempMultiplier = (amount - balancePosition) * (newPriceForMintedOnes);
            return (tempMultiplier * ONE) / (amount) / ONE;
        } else {
            uint previousSkew = balanceOtherSide;
            uint previousImpact = (max_spread * ((previousSkew * ONE) / (maxPossibleSkew))) / ONE;
            return (newImpact + previousImpact) / (2);
        }
    }

    function calculateDiscount(DiscountParams memory params) public view returns (int) {
        uint currentBuyImpactOtherSide = buyPriceImpactImbalancedSkew(
            params.amount,
            params.balancePosition,
            params.balanceOtherSide,
            params.balanceOtherSide > ONE
                ? params.balancePosition
                : params.balancePosition + (ONE - params.balanceOtherSide),
            params.balanceOtherSide > ONE ? params.balanceOtherSide - ONE : 0,
            params.availableToBuyFromAMM,
            params.max_spread
        );

        uint startDiscount = currentBuyImpactOtherSide / 2;
        uint tempMultiplier = params.balancePosition - params.amount;
        uint finalDiscount = ((startDiscount / 2) * ((tempMultiplier * ONE) / params.balancePosition + ONE)) / ONE;

        return -int(finalDiscount);
    }

    function calculateDiscountFromNegativeToPositive(NegativeDiscountsParams memory params)
        public
        view
        returns (int priceImpact)
    {
        uint amountToBeMinted = params.amount - params.balancePosition;
        uint sum1 = params.balanceOtherSide + params.balancePosition;
        uint sum2 = params.balanceOtherSide + amountToBeMinted;
        uint red3 = params._availableToBuyFromAMM - params.balancePosition;
        uint positiveSkew = buyPriceImpactImbalancedSkew(amountToBeMinted, sum1, 0, sum2, 0, red3, params.max_spread);

        uint skew = (params.priceOtherPosition * positiveSkew) / params.pricePosition;

        int discount = calculateDiscount(
            DiscountParams(
                params.balancePosition,
                params.balanceOtherSide,
                params.balancePosition,
                params._availableToBuyFromAMMOtherSide,
                params.max_spread
            )
        );

        int discountBalance = int(params.balancePosition) * discount;
        int discountMinted = int(amountToBeMinted * skew);
        int amountInt = int(params.balancePosition + amountToBeMinted);

        priceImpact = (discountBalance + discountMinted) / amountInt;

        if (priceImpact > 0) {
            int numerator = int(params.pricePosition) * priceImpact;
            priceImpact = numerator / int(params.priceOtherPosition);
        }
    }

    function calculateTempQuote(
        int skewImpact,
        uint baseOdds,
        uint safeBoxImpact,
        uint amount
    ) public view returns (int tempQuote) {
        if (skewImpact >= 0) {
            int impactPrice = ((ONE_INT - int(baseOdds)) * skewImpact) / ONE_INT;
            // add 2% to the price increase to avoid edge cases on the extremes
            impactPrice = (impactPrice * (ONE_INT + (ONE_PERCENT_INT * 2))) / ONE_INT;
            tempQuote = (int(amount) * (int(baseOdds) + impactPrice)) / ONE_INT;
        } else {
            tempQuote = ((int(amount)) * ((int(baseOdds) * (ONE_INT + skewImpact)) / ONE_INT)) / ONE_INT;
        }
        tempQuote = (tempQuote * (ONE_INT + (int(safeBoxImpact)))) / ONE_INT;
    }

    function _calculateAvailableToBuy(
        uint capUsed,
        uint spentOnThisGame,
        uint baseOdds,
        uint max_spread,
        uint balance
    ) public view returns (uint availableAmount) {
        uint discountedPrice = (baseOdds * (ONE - max_spread / 4)) / ONE;
        uint additionalBufferFromSelling = (balance * discountedPrice) / ONE;
        if ((capUsed + additionalBufferFromSelling) > spentOnThisGame) {
            uint availableUntilCapSUSD = capUsed + additionalBufferFromSelling - spentOnThisGame;
            if (availableUntilCapSUSD > capUsed) {
                availableUntilCapSUSD = capUsed;
            }

            uint midImpactPriceIncrease = ((ONE - baseOdds) * (max_spread / 2)) / ONE;
            uint divider_price = ONE - (baseOdds + midImpactPriceIncrease);

            availableAmount = balance + ((availableUntilCapSUSD * ONE) / divider_price);
        }
    }

    function _calculateAvailableToSell(
        uint balanceOfTheOtherSide,
        uint sell_max_price,
        uint capPlusBalance,
        uint spentOnThisGame
    ) public view returns (uint _available) {
        uint willPay = (balanceOfTheOtherSide * (sell_max_price)) / ONE;
        uint capWithBalance = capPlusBalance + (balanceOfTheOtherSide);
        if (capWithBalance >= (spentOnThisGame + willPay)) {
            uint usdAvailable = capWithBalance - (spentOnThisGame) - (willPay);
            _available = (usdAvailable / (sell_max_price)) * ONE + (balanceOfTheOtherSide);
        }
    }

    function getCanExercize(
        address market,
        address toCheck,
        address manager
    ) public view returns (bool canExercize) {
        if (
            ISportPositionalMarketManager(manager).isKnownMarket(market) &&
            !ISportPositionalMarket(market).paused() &&
            ISportPositionalMarket(market).resolved()
        ) {
            (IPosition home, IPosition away, IPosition draw) = ISportPositionalMarket(market).getOptions();
            if (
                (home.getBalanceOf(address(toCheck)) > 0) ||
                (away.getBalanceOf(address(toCheck)) > 0) ||
                (ISportPositionalMarket(market).optionsCount() > 2 && draw.getBalanceOf(address(toCheck)) > 0)
            ) {
                canExercize = true;
            }
        }
    }

    function isMarketInAMMTrading(
        address market,
        address manager,
        uint minimalTimeLeftToMaturity
    ) public view returns (bool isTrading) {
        if (ISportPositionalMarketManager(manager).isActiveMarket(market)) {
            (uint maturity, ) = ISportPositionalMarket(market).times();
            if (maturity >= block.timestamp) {
                uint timeLeftToMaturity = maturity - block.timestamp;
                isTrading = timeLeftToMaturity > minimalTimeLeftToMaturity;
            }
        }
    }

    function obtainOdds(
        address _market,
        ISportsAMM.Position _position,
        address apexConsumer,
        address theRundownConsumer
    ) public view returns (uint oddsToReturn) {
        bytes32 gameId = ISportPositionalMarket(_market).getGameId();
        if (ISportPositionalMarket(_market).optionsCount() > uint(_position)) {
            uint[] memory odds = new uint[](ISportPositionalMarket(_market).optionsCount());
            bool isApexGame = apexConsumer != address(0) && IApexConsumer(apexConsumer).isApexGame(gameId);
            odds = isApexGame
                ? IApexConsumer(apexConsumer).getNormalizedOdds(gameId)
                : ITherundownConsumer(theRundownConsumer).getNormalizedOdds(gameId);
            oddsToReturn = odds[uint(_position)];
        }
    }

    function getBalanceOtherSideOnThreePositions(
        ISportsAMM.Position position,
        address addressToCheck,
        address market
    ) public view returns (uint balanceOfTheOtherSide) {
        (uint homeBalance, uint awayBalance, uint drawBalance) = getBalanceOfPositionsOnMarket(
            market,
            position,
            addressToCheck
        );
        if (position == ISportsAMM.Position.Home) {
            balanceOfTheOtherSide = awayBalance < drawBalance ? awayBalance : drawBalance;
        } else if (position == ISportsAMM.Position.Away) {
            balanceOfTheOtherSide = homeBalance < drawBalance ? homeBalance : drawBalance;
        } else {
            balanceOfTheOtherSide = homeBalance < awayBalance ? homeBalance : awayBalance;
        }
    }

    function getBalanceOfPositionsOnMarket(
        address market,
        ISportsAMM.Position position,
        address addressToCheck
    )
        public
        view
        returns (
            uint homeBalance,
            uint awayBalance,
            uint drawBalance
        )
    {
        (IPosition home, IPosition away, IPosition draw) = ISportPositionalMarket(market).getOptions();
        homeBalance = home.getBalanceOf(address(addressToCheck));
        awayBalance = away.getBalanceOf(address(addressToCheck));
        if (ISportPositionalMarket(market).optionsCount() == 3) {
            drawBalance = draw.getBalanceOf(address(addressToCheck));
        }
    }

    function balanceOfPositionsOnMarket(
        address market,
        ISportsAMM.Position position,
        address addressToCheck
    )
        public
        view
        returns (
            uint,
            uint,
            uint
        )
    {
        (IPosition home, IPosition away, IPosition draw) = ISportPositionalMarket(market).getOptions();
        uint balance = position == ISportsAMM.Position.Home
            ? home.getBalanceOf(addressToCheck)
            : away.getBalanceOf(addressToCheck);
        uint balanceOtherSideMax = position == ISportsAMM.Position.Home
            ? away.getBalanceOf(addressToCheck)
            : home.getBalanceOf(addressToCheck);
        uint balanceOtherSideMin = balanceOtherSideMax;
        if (ISportPositionalMarket(market).optionsCount() == 3) {
            (uint homeBalance, uint awayBalance, uint drawBalance) = getBalanceOfPositionsOnMarket(
                market,
                position,
                addressToCheck
            );
            if (position == ISportsAMM.Position.Home) {
                balance = homeBalance;
                if (awayBalance < drawBalance) {
                    balanceOtherSideMax = drawBalance;
                    balanceOtherSideMin = awayBalance;
                } else {
                    balanceOtherSideMax = awayBalance;
                    balanceOtherSideMin = drawBalance;
                }
            } else if (position == ISportsAMM.Position.Away) {
                balance = awayBalance;
                if (homeBalance < drawBalance) {
                    balanceOtherSideMax = drawBalance;
                    balanceOtherSideMin = homeBalance;
                } else {
                    balanceOtherSideMax = homeBalance;
                    balanceOtherSideMin = drawBalance;
                }
            } else if (position == ISportsAMM.Position.Draw) {
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

    function balanceOfPositionOnMarket(
        address market,
        ISportsAMM.Position position,
        address addressToCheck
    ) public view returns (uint) {
        (IPosition home, IPosition away, IPosition draw) = ISportPositionalMarket(market).getOptions();
        uint balance = position == ISportsAMM.Position.Home
            ? home.getBalanceOf(addressToCheck)
            : away.getBalanceOf(addressToCheck);
        if (ISportPositionalMarket(market).optionsCount() == 3 && position != ISportsAMM.Position.Home) {
            balance = position == ISportsAMM.Position.Away
                ? away.getBalanceOf(addressToCheck)
                : draw.getBalanceOf(addressToCheck);
        }
        return balance;
    }
}

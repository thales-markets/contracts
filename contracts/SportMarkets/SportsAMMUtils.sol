// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "../interfaces/ISportPositionalMarket.sol";
import "../interfaces/ISportPositionalMarketManager.sol";
import "../interfaces/IPosition.sol";
import "../interfaces/ITherundownConsumer.sol";
import "../interfaces/ISportsAMM.sol";
import "../interfaces/ISportAMMRiskManager.sol";

import "./LiquidityPool/SportAMMLiquidityPool.sol";

/// @title Sports AMM utils
contract SportsAMMUtils {
    uint private constant ONE = 1e18;
    uint private constant ZERO_POINT_ONE = 1e17;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant MAX_APPROVAL = type(uint256).max;
    int private constant ONE_INT = 1e18;
    int private constant ONE_PERCENT_INT = 1e16;
    uint public constant TAG_NUMBER_PLAYERS = 10010;

    ISportsAMM public sportsAMM;

    constructor(address _sportsAMM) {
        sportsAMM = ISportsAMM(_sportsAMM);
    }

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

    struct PriceImpactParams {
        address market;
        ISportsAMM.Position position;
        uint amount;
        uint _availableToBuyFromAMM;
        uint _availableToBuyFromAMMOtherSide;
        SportAMMLiquidityPool liquidityPool;
        uint max_spread;
        uint minSupportedOdds;
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
            uint newPriceForMintedOnes = newImpact / 2;
            uint tempMultiplier = (amount - balancePosition) * newPriceForMintedOnes;
            return (tempMultiplier * ONE) / (amount) / ONE;
        } else {
            uint previousSkew = balanceOtherSide;
            uint previousImpact = (max_spread * ((previousSkew * ONE) / maxPossibleSkew)) / ONE;
            return (newImpact + previousImpact) / 2;
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

        uint startDiscount = currentBuyImpactOtherSide;
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
    ) public pure returns (int tempQuote) {
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

    function calculateAvailableToBuy(
        uint capUsed,
        uint spentOnThisGame,
        uint baseOdds,
        uint balance,
        uint max_spread
    ) public view returns (uint availableAmount) {
        uint discountedPrice = (baseOdds * (ONE - max_spread / 2)) / ONE;
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

    function getCanExercize(address market, address toCheck) public view returns (bool canExercize) {
        if (
            ISportPositionalMarketManager(sportsAMM.manager()).isKnownMarket(market) &&
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

    function obtainOdds(address _market, ISportsAMM.Position _position) public view returns (uint oddsToReturn) {
        address theRundownConsumer = sportsAMM.theRundownConsumer();
        ISportAMMRiskManager riskManager = sportsAMM.riskManager();
        if (ISportPositionalMarket(_market).optionsCount() > uint(_position)) {
            uint[] memory odds = new uint[](ISportPositionalMarket(_market).optionsCount());
            odds = ITherundownConsumer(theRundownConsumer).getNormalizedOddsForMarket(_market);
            (uint firstTag, uint secondTag, uint thirdTag) = _getTagsForMarket(_market);
            if (secondTag == TAG_NUMBER_PLAYERS) {
                if (!riskManager.isMarketForPlayerPropsOnePositional(thirdTag) || uint(_position) == 0) {
                    oddsToReturn = odds[uint(_position)];
                }
            } else {
                if ((!riskManager.isMarketForSportOnePositional(firstTag) || uint(_position) == 0)) {
                    oddsToReturn = odds[uint(_position)];
                }
            }
        }
    }

    function obtainOddsMulti(
        address _market,
        ISportsAMM.Position _position1,
        ISportsAMM.Position _position2
    ) public view returns (uint oddsToReturn1, uint oddsToReturn2) {
        address theRundownConsumer = sportsAMM.theRundownConsumer();
        uint positionsCount = ISportPositionalMarket(_market).optionsCount();
        uint[] memory odds = new uint[](ISportPositionalMarket(_market).optionsCount());
        odds = ITherundownConsumer(theRundownConsumer).getNormalizedOddsForMarket(_market);
        if (positionsCount > uint(_position1)) {
            oddsToReturn1 = odds[uint(_position1)];
        }
        if (positionsCount > uint(_position2)) {
            oddsToReturn2 = odds[uint(_position2)];
        }
    }

    function getBalanceOtherSideOnThreePositions(
        ISportsAMM.Position position,
        address addressToCheck,
        address market
    ) public view returns (uint balanceOfTheOtherSide) {
        (uint homeBalance, uint awayBalance, uint drawBalance) = getBalanceOfPositionsOnMarket(market, addressToCheck);
        if (position == ISportsAMM.Position.Home) {
            balanceOfTheOtherSide = awayBalance < drawBalance ? awayBalance : drawBalance;
        } else if (position == ISportsAMM.Position.Away) {
            balanceOfTheOtherSide = homeBalance < drawBalance ? homeBalance : drawBalance;
        } else {
            balanceOfTheOtherSide = homeBalance < awayBalance ? homeBalance : awayBalance;
        }
    }

    function getBalanceOfPositionsOnMarket(address market, address addressToCheck)
        public
        view
        returns (
            uint homeBalance,
            uint awayBalance,
            uint drawBalance
        )
    {
        (IPosition home, IPosition away, IPosition draw) = ISportPositionalMarket(market).getOptions();
        homeBalance = home.getBalanceOf(addressToCheck);
        awayBalance = away.getBalanceOf(addressToCheck);
        if (ISportPositionalMarket(market).optionsCount() == 3) {
            drawBalance = draw.getBalanceOf(addressToCheck);
        }
    }

    function getBalanceOfPositionsOnMarketByPositions(
        address market,
        address addressToCheck,
        ISportsAMM.Position position1,
        ISportsAMM.Position position2
    ) public view returns (uint firstBalance, uint secondBalance) {
        (uint homeBalance, uint awayBalance, uint drawBalance) = getBalanceOfPositionsOnMarket(market, addressToCheck);
        firstBalance = position1 == ISportsAMM.Position.Home ? homeBalance : position1 == ISportsAMM.Position.Away
            ? awayBalance
            : drawBalance;
        secondBalance = position2 == ISportsAMM.Position.Home ? homeBalance : position2 == ISportsAMM.Position.Away
            ? awayBalance
            : drawBalance;
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
        (IPosition home, IPosition away, ) = ISportPositionalMarket(market).getOptions();
        uint balance = position == ISportsAMM.Position.Home
            ? home.getBalanceOf(addressToCheck)
            : away.getBalanceOf(addressToCheck);
        uint balanceOtherSideMax = position == ISportsAMM.Position.Home
            ? away.getBalanceOf(addressToCheck)
            : home.getBalanceOf(addressToCheck);
        uint balanceOtherSideMin = balanceOtherSideMax;
        if (ISportPositionalMarket(market).optionsCount() == 3) {
            (uint homeBalance, uint awayBalance, uint drawBalance) = getBalanceOfPositionsOnMarket(market, addressToCheck);
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

    function getParentMarketPositions(address market)
        public
        view
        returns (
            ISportsAMM.Position position1,
            ISportsAMM.Position position2,
            address parentMarket
        )
    {
        ISportPositionalMarket parentMarketContract = ISportPositionalMarket(market).parentMarket();
        (IPosition parentPosition1, IPosition parentPosition2) = ISportPositionalMarket(market).getParentMarketPositions();
        (IPosition home, IPosition away, ) = parentMarketContract.getOptions();
        position1 = parentPosition1 == home ? ISportsAMM.Position.Home : parentPosition1 == away
            ? ISportsAMM.Position.Away
            : ISportsAMM.Position.Draw;
        position2 = parentPosition2 == home ? ISportsAMM.Position.Home : parentPosition2 == away
            ? ISportsAMM.Position.Away
            : ISportsAMM.Position.Draw;

        parentMarket = address(parentMarketContract);
    }

    function getParentMarketPositionAddresses(address market)
        public
        view
        returns (address parentMarketPosition1, address parentMarketPosition2)
    {
        (IPosition position1, IPosition position2) = ISportPositionalMarket(market).getParentMarketPositions();

        parentMarketPosition1 = address(position1);
        parentMarketPosition2 = address(position2);
    }

    function getBaseOddsForDoubleChance(address market, uint minSupportedOdds)
        public
        view
        returns (uint oddsPosition1, uint oddsPosition2)
    {
        (ISportsAMM.Position position1, ISportsAMM.Position position2, address parentMarket) = getParentMarketPositions(
            market
        );
        oddsPosition1 = obtainOdds(parentMarket, position1);
        oddsPosition2 = obtainOdds(parentMarket, position2);

        if (oddsPosition1 > 0 && oddsPosition2 > 0) {
            oddsPosition1 = oddsPosition1 < minSupportedOdds ? minSupportedOdds : oddsPosition1;
            oddsPosition2 = oddsPosition2 < minSupportedOdds ? minSupportedOdds : oddsPosition2;
        }
    }

    function getBaseOddsForDoubleChanceSum(address market, uint minSupportedOdds) public view returns (uint sum) {
        (uint oddsPosition1, uint oddsPosition2) = getBaseOddsForDoubleChance(market, minSupportedOdds);

        sum = oddsPosition1 + oddsPosition2;
    }

    function getBuyPriceImpact(PriceImpactParams memory params) public view returns (int priceImpact) {
        (uint balancePosition, , uint balanceOtherSide) = balanceOfPositionsOnMarket(
            params.market,
            params.position,
            params.liquidityPool.getMarketPool(params.market)
        );
        bool isTwoPositional = ISportPositionalMarket(params.market).optionsCount() == 2;
        uint balancePositionAfter = balancePosition > params.amount ? balancePosition - params.amount : 0;
        uint balanceOtherSideAfter = balancePosition > params.amount
            ? balanceOtherSide
            : balanceOtherSide + (params.amount - balancePosition);
        if (params.amount <= balancePosition) {
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
            if (balancePosition > 0) {
                uint pricePosition = _obtainOdds(params.market, params.position, params.minSupportedOdds);
                uint priceOtherPosition = isTwoPositional
                    ? _obtainOdds(
                        params.market,
                        params.position == ISportsAMM.Position.Home ? ISportsAMM.Position.Away : ISportsAMM.Position.Home,
                        params.minSupportedOdds
                    )
                    : ONE - pricePosition;
                priceImpact = calculateDiscountFromNegativeToPositive(
                    NegativeDiscountsParams(
                        params.amount,
                        balancePosition,
                        balanceOtherSide,
                        params._availableToBuyFromAMMOtherSide,
                        params._availableToBuyFromAMM,
                        pricePosition,
                        priceOtherPosition,
                        params.max_spread
                    )
                );
            } else {
                priceImpact = int(
                    buyPriceImpactImbalancedSkew(
                        params.amount,
                        balanceOtherSide,
                        balancePosition,
                        balanceOtherSideAfter,
                        balancePositionAfter,
                        params._availableToBuyFromAMM,
                        params.max_spread
                    )
                );
            }
        }
    }

    function _obtainOdds(
        address _market,
        ISportsAMM.Position _position,
        uint minSupportedOdds
    ) internal view returns (uint) {
        if (ISportPositionalMarket(_market).isDoubleChance()) {
            if (_position == ISportsAMM.Position.Home) {
                return getBaseOddsForDoubleChanceSum(_market, minSupportedOdds);
            }
        }
        return obtainOdds(_market, _position);
    }

    function _getTagsForMarket(address _market)
        internal
        view
        returns (
            uint tag1,
            uint tag2,
            uint tag3
        )
    {
        ISportPositionalMarket sportMarket = ISportPositionalMarket(_market);
        tag1 = sportMarket.tags(0);
        tag2 = sportMarket.isChild() ? sportMarket.tags(1) : 0;
        tag3 = sportMarket.isChild() && sportMarket.tags(1) == TAG_NUMBER_PLAYERS ? sportMarket.tags(2) : 0;
    }
}

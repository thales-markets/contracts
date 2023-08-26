// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./ICurveSUSD.sol";
import "./IPositionalMarket.sol";
import "./IStakingThales.sol";
import "./IRangedMarket.sol";
import "./IThalesAMM.sol";

interface IRangedMarketsAMM {
    function createRangedMarket(address leftMarket, address rightMarket) external;

    function createRangedMarkets(address[] calldata leftMarkets, address[] calldata rightMarkets) external;

    function canCreateRangedMarket(address leftMarket, address rightMarket) external view returns (bool toReturn);

    function availableToBuyFromAMM(IRangedMarket rangedMarket, IRangedMarket.Position position) external view returns (uint);

    function buyFromAmmQuote(
        IRangedMarket rangedMarket,
        IRangedMarket.Position position,
        uint amount
    ) external view returns (uint sUSDPaid);

    function buyFromAmmQuoteDetailed(
        IRangedMarket rangedMarket,
        IRangedMarket.Position position,
        uint amount
    )
        external
        view
        returns (
            uint quoteWithFees,
            uint leftQuote,
            uint rightQuote
        );

    function buyFromAmmQuoteWithDifferentCollateral(
        IRangedMarket rangedMarket,
        IRangedMarket.Position position,
        uint amount,
        address collateral
    ) external view returns (uint collateralQuote, uint sUSDToPay);

    function buyFromAMMWithReferrer(
        IRangedMarket rangedMarket,
        IRangedMarket.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        address referrer
    ) external;

    function buyFromAMMWithDifferentCollateralAndReferrer(
        IRangedMarket rangedMarket,
        IRangedMarket.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage,
        address collateral,
        address _referrer
    ) external;

    function buyFromAMM(
        IRangedMarket rangedMarket,
        IRangedMarket.Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) external;

    function availableToSellToAMM(IRangedMarket rangedMarket, IRangedMarket.Position position)
        external
        view
        returns (uint _available);

    function sellToAmmQuote(
        IRangedMarket rangedMarket,
        IRangedMarket.Position position,
        uint amount
    ) external view returns (uint pricePaid);

    function sellToAmmQuoteDetailed(
        IRangedMarket rangedMarket,
        IRangedMarket.Position position,
        uint amount
    )
        external
        view
        returns (
            uint quoteWithFees,
            uint leftQuote,
            uint rightQuote
        );

    function resolveRangedMarketsBatch(address[] calldata markets) external;

    function getPriceImpact(IRangedMarket rangedMarket, IRangedMarket.Position position) external view returns (int _impact);

    function transferSusdTo(address receiver, uint amount) external;

    function retrieveSUSDAmount(address payable account, uint amount) external;

    function setRangedMarketMastercopies(address _rangedMarketMastercopy, address _rangedPositionMastercopy) external;

    function setMinMaxSupportedPrice(
        uint _minSupportedPrice,
        uint _maxSupportedPrice,
        uint _minDiffBetweenStrikes,
        uint _maxDiffBetweenStrikes
    ) external;

    function setSafeBoxDataAndRangedAMMFee(
        address _safeBox,
        uint _safeBoxImpact,
        uint _rangedAMMFee
    ) external;

    function setThalesAMMStakingThalesAndReferrals(
        address _thalesAMM,
        IStakingThales _stakingThales,
        address _referrals,
        uint _referrerFee
    ) external;

    function setCurveSUSD(bool _curveOnrampEnabled, uint _maxAllowedPegSlippagePercentage) external;

    function isKnownMarket(address market) external view returns (bool);

    // State Variables
    function thalesAmm() external view returns (IThalesAMM);

    function rangedAmmFee() external view returns (uint);

    function createdRangedMarkets(address leftMarket, address rightMarket) external view returns (address);

    function rangedMarketMastercopy() external view returns (address);

    function rangedPositionMastercopy() external view returns (address);

    function sUSD() external view returns (IERC20Upgradeable);

    function spentOnMarket(address) external view returns (uint);

    function capPerMarket() external view returns (uint);

    function minSupportedPrice() external view returns (uint);

    function maxSupportedPrice() external view returns (uint);

    function safeBox() external view returns (address);

    function safeBoxImpact() external view returns (uint);

    function minimalDifBetweenStrikes() external view returns (uint);

    function stakingThales() external view returns (IStakingThales);

    function maximalDifBetweenStrikes() external view returns (uint);

    function referrals() external view returns (address);

    function referrerFee() external view returns (uint);

    function curveSUSD() external view returns (ICurveSUSD);

    function usdc() external view returns (address);

    function usdt() external view returns (address);

    function dai() external view returns (address);

    function curveOnrampEnabled() external view returns (bool);

    function maxAllowedPegSlippagePercentage() external view returns (uint);
}

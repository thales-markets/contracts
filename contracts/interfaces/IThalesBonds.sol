// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IThalesBonds {
    /* ========== VIEWS / VARIABLES ========== */
    function getTotalDepositedBondAmountForMarket(address _market) external view returns (uint);

    function getClaimedBondAmountForMarket(address _market) external view returns (uint);

    function getClaimableBondAmountForMarket(address _market) external view returns (uint);

    function getDisputorBondForMarket(address _market, address _disputorAddress) external view returns (uint);

    function getCreatorBondForMarket(address _market) external view returns (uint);

    function getResolverBondForMarket(address _market) external view returns (uint);

    function getCurveQuoteForDifferentCollateral(
        uint amount,
        address collateral,
        bool toSUSD
    ) external view returns (uint);

    function sendCreatorBondToMarket(
        address _market,
        address _creatorAddress,
        uint _amount
    ) external;

    function sendResolverBondToMarket(
        address _market,
        address _resolverAddress,
        uint _amount
    ) external;

    function sendDisputorBondToMarket(
        address _market,
        address _disputorAddress,
        uint _amount
    ) external;

    function sendBondFromMarketToUser(
        address _market,
        address _account,
        uint _amount,
        uint _bondToReduce,
        address _disputorAddress
    ) external;

    function sendOpenDisputeBondFromMarketToDisputor(
        address _market,
        address _account,
        uint _amount
    ) external;

    function setOracleCouncilAddress(address _oracleCouncilAddress) external;

    function setManagerAddress(address _managerAddress) external;

    function setCurveSUSD(
        address _curveSUSD,
        address _dai,
        address _usdc,
        address _usdt,
        bool _curveOnrampEnabled
    ) external;

    function issueBondsBackToCreatorAndResolver(address _market) external;

    function transferToMarket(address _account, uint _amount) external;

    function transferToMarket(
        address _account,
        uint _amount,
        address collateral,
        uint expectedPayout,
        uint additionalSlippage
    ) external;

    function transferFromMarket(address _account, uint _amount) external;

    function transferCreatorToResolverBonds(address _market) external;

    function decreaseCreatorVolume(address _market) external;
}

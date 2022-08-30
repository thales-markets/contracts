// SPDX-License-Identifier: MIT
pragma solidity >=0.5.16;

interface IThalesAMM {
    enum Position {Up, Down}

    function manager() external view returns (address);

    function availableToBuyFromAMM(address market, Position position) external view returns (uint);

    function impliedVolatilityPerAsset(bytes32 oracleKey) external view returns(uint);

    function buyFromAmmQuote(
        address market,
        Position position,
        uint amount
    ) external view returns (uint);

    function buyFromAMM(
        address market,
        Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) external;

    function availableToSellToAMM(address market, Position position) external view returns (uint);

    function sellToAmmQuote(
        address market,
        Position position,
        uint amount
    ) external view returns (uint);

    function sellToAMM(
        address market,
        Position position,
        uint amount,
        uint expectedPayout,
        uint additionalSlippage
    ) external;

    function isMarketInAMMTrading(address market) external view returns (bool);
    function price(address market, Position position) external view returns (uint);
    function buyPriceImpact(
        address market,
        Position position,
        uint amount
    ) external view returns (uint);
}

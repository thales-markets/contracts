// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IRangedPosition.sol";
import "../interfaces/IPositionalMarket.sol";

interface IRangedMarket {
    enum Position {
        In,
        Out
    }

    struct Positions {
        IRangedPosition inp;
        IRangedPosition outp;
    }

    function positions() external view returns (Positions memory);

    function initialize(
        address _leftMarket,
        address _rightMarket,
        address _in,
        address _out,
        address _rangedMarketsAMM
    ) external;

    function mint(
        uint value,
        Position _position,
        address minter
    ) external;

    function burnIn(uint value, address claimant) external;

    function burnOut(uint value, address claimant) external;

    function resolveMarket() external;

    function leftMarket() external view returns (IPositionalMarket);

    function rightMarket() external view returns (IPositionalMarket);

    function resolved() external view returns (bool);
}

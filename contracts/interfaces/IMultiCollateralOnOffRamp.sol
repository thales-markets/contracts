// SPDX-License-Identifier: MIT

pragma solidity >=0.5.16;

interface IMultiCollateralOnOffRamp {
    function onramp(
        uint buyinAmount,
        address collateral,
        uint collateralAmount
    ) external returns (uint);

    function onrampWithEth(uint buyinAmount, uint collateralAmount) external payable returns (uint);
}

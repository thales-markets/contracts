// SPDX-License-Identifier: MIT

pragma solidity >=0.5.16;

interface IMultiCollateralOnOffRamp {
    function onramp(address collateral, uint collateralAmount) external returns (uint);

    function onrampWithEth(uint amount) external payable returns (uint);

    function getMinimumReceived(address collateral, uint amount) external view returns (uint);

    function getMinimumNeeded(address collateral, uint amount) external view returns (uint);

    function WETH9() external view returns (address);

    function offrampIntoEth(uint amount) external returns (uint);

    function offramp(address collateral, uint amount) external returns (uint);
}

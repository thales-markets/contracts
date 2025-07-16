// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title An AMM utils for Thales speed markets
interface ISpeedMarketsAMMUtils {
    function getFeeByTimeThreshold(
        uint64 _deltaTimeSec,
        uint[] calldata _timeThresholds,
        uint[] calldata _fees,
        uint _defaultFee
    ) external pure returns (uint fee);

    function collateralKey(address _collateral) external view returns (bytes32);

    function setCollateralKey(address _collateral, bytes32 _key) external;

    function transformCollateralToUSD(
        address _collateral,
        address defaultCollateral,
        uint _amount
    ) external view returns (uint);
}

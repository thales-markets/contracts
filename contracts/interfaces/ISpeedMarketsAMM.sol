// SPDX-License-Identifier: MIT

pragma solidity >=0.5.16;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";

import "../interfaces/IReferrals.sol";
import "../interfaces/IMultiCollateralOnOffRamp.sol";

import "../SpeedMarkets/SpeedMarket.sol";

interface ISpeedMarketsAMM {
    function sUSD() external view returns (IERC20Upgradeable);

    function supportedAsset(bytes32 asset) external view returns (bool);

    function pyth() external view returns (IPyth);

    function assetToPythId(bytes32 asset) external view returns (bytes32);

    function minBuyinAmount() external view returns (uint);

    function maxBuyinAmount() external view returns (uint);

    function minimalTimeToMaturity() external view returns (uint);

    function maximalTimeToMaturity() external view returns (uint);

    function maximumPriceDelay() external view returns (uint64);

    function maximumPriceDelayForResolving() external view returns (uint64);

    function timeThresholdsForFees(uint index) external view returns (uint);

    function lpFees(uint index) external view returns (uint);

    function lpFee() external view returns (uint);

    function safeBox() external view returns (address);

    function safeBoxImpact() external view returns (uint);

    function marketHasCreatedAtAttribute(address _market) external view returns (bool);

    function marketHasFeeAttribute(address _market) external view returns (bool);

    function maxRiskPerAsset(bytes32 _asset) external view returns (uint);

    function currentRiskPerAsset(bytes32 _asset) external view returns (uint);

    function maxRiskPerAssetAndDirection(bytes32 _asset, SpeedMarket.Direction _direction) external view returns (uint);

    function currentRiskPerAssetAndDirection(bytes32 _asset, SpeedMarket.Direction _direction) external view returns (uint);

    function whitelistedAddresses(address _wallet) external view returns (bool);

    function getLengths(address user) external view returns (uint[5] memory);

    function referrals() external view returns (IReferrals);
}

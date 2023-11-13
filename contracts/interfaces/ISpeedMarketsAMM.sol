// SPDX-License-Identifier: MIT

pragma solidity >=0.5.16;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "../SpeedMarkets/SpeedMarket.sol";

interface ISpeedMarketsAMM {
    struct Params {
        bool supportedAsset;
        bytes32 pythId;
        uint safeBoxImpact;
        uint64 maximumPriceDelay;
    }

    function sUSD() external view returns (IERC20Upgradeable);

    function supportedAsset(bytes32 _asset) external view returns (bool);

    function assetToPythId(bytes32 _asset) external view returns (bytes32);

    function minBuyinAmount() external view returns (uint);

    function maxBuyinAmount() external view returns (uint);

    function minimalTimeToMaturity() external view returns (uint);

    function maximalTimeToMaturity() external view returns (uint);

    function maximumPriceDelay() external view returns (uint64);

    function maximumPriceDelayForResolving() external view returns (uint64);

    function timeThresholdsForFees(uint _index) external view returns (uint);

    function lpFees(uint _index) external view returns (uint);

    function lpFee() external view returns (uint);

    function safeBoxImpact() external view returns (uint);

    function marketHasCreatedAtAttribute(address _market) external view returns (bool);

    function marketHasFeeAttribute(address _market) external view returns (bool);

    function maxRiskPerAsset(bytes32 _asset) external view returns (uint);

    function currentRiskPerAsset(bytes32 _asset) external view returns (uint);

    function maxRiskPerAssetAndDirection(bytes32 _asset, SpeedMarket.Direction _direction) external view returns (uint);

    function currentRiskPerAssetAndDirection(bytes32 _asset, SpeedMarket.Direction _direction) external view returns (uint);

    function whitelistedAddresses(address _wallet) external view returns (bool);

    function getLengths(address _user) external view returns (uint[5] memory);

    function getParams(bytes32 _asset) external view returns (Params memory);
}

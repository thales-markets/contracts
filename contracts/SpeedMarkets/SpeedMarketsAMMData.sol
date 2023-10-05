// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

import "../interfaces/ISpeedMarketsAMM.sol";

import "./SpeedMarket.sol";

contract SpeedMarketsAMMData is Initializable, ProxyOwned, ProxyPausable {
    address public speedMarketsAMM;

    struct MarketData {
        address user;
        bytes32 asset;
        uint64 strikeTime;
        int64 strikePrice;
        SpeedMarket.Direction direction;
        uint buyinAmount;
        bool resolved;
        int64 finalPrice;
        SpeedMarket.Direction result;
        bool isUserWinner;
        uint256 createdAt;
    }

    struct Risk {
        uint current;
        uint max;
    }

    struct RiskPerDirection {
        SpeedMarket.Direction direction;
        uint current;
        uint max;
    }

    struct SpeedMarketsAMMParameters {
        uint minBuyinAmount;
        uint maxBuyinAmount;
        uint minimalTimeToMaturity;
        uint maximalTimeToMaturity;
        uint64 maximumPriceDelay;
        uint64 maximumPriceDelayForResolving;
        uint lpFee;
        uint safeBoxImpact;
        bool isAddressWhitelisted;
    }

    function initialize(address _speedMarketsAMM) external initializer {
        speedMarketsAMM = _speedMarketsAMM;
    }

    /// @notice Set speed markets AMM address
    /// @param _speedMarketsAMM to use address for fetching data
    function setSpeedMarketsAMM(address _speedMarketsAMM) external onlyOwner {
        speedMarketsAMM = _speedMarketsAMM;
        emit SetSpeedMarketsAMM(_speedMarketsAMM);
    }

    //////////////////getters/////////////////

    /// @notice return all market data for an array of markets
    function getMarketsData(address[] calldata marketsArray) external view returns (MarketData[] memory) {
        MarketData[] memory markets = new MarketData[](marketsArray.length);
        for (uint i = 0; i < marketsArray.length; i++) {
            SpeedMarket market = SpeedMarket(marketsArray[i]);
            markets[i].user = market.user();
            markets[i].asset = market.asset();
            markets[i].strikeTime = market.strikeTime();
            markets[i].strikePrice = market.strikePrice();
            markets[i].direction = market.direction();
            markets[i].buyinAmount = market.buyinAmount();
            markets[i].resolved = market.resolved();
            markets[i].finalPrice = market.finalPrice();
            markets[i].result = market.result();
            markets[i].isUserWinner = market.isUserWinner();

            if (ISpeedMarketsAMM(speedMarketsAMM).marketHasCreatedAtAttribute(marketsArray[i])) {
                markets[i].createdAt = market.createdAt();
            }
        }
        return markets;
    }

    /// @notice return all risk data (current and max) by specified asset
    function getRiskPerAsset(bytes32 asset) external view returns (Risk memory) {
        Risk memory risk;
        risk.current = ISpeedMarketsAMM(speedMarketsAMM).currentRiskPerAsset(asset);
        risk.max = ISpeedMarketsAMM(speedMarketsAMM).maxRiskPerAsset(asset);
        return risk;
    }

    /// @notice return all risk data (direction, current and max) for both directions (Up and Down) by specified asset
    function getDirectionalRiskPerAsset(bytes32 asset) external view returns (RiskPerDirection[] memory) {
        SpeedMarket.Direction[] memory directions = new SpeedMarket.Direction[](2);
        directions[0] = SpeedMarket.Direction.Up;
        directions[1] = SpeedMarket.Direction.Down;

        RiskPerDirection[] memory risks = new RiskPerDirection[](directions.length);
        for (uint i = 0; i < directions.length; i++) {
            SpeedMarket.Direction currentDirection = directions[i];
            risks[i].direction = currentDirection;
            risks[i].current = ISpeedMarketsAMM(speedMarketsAMM).currentRiskPerAssetAndDirection(asset, currentDirection);
            risks[i].max = ISpeedMarketsAMM(speedMarketsAMM).maxRiskPerAssetAndDirection(asset, currentDirection);
        }

        return risks;
    }

    /// @notice return all AMM parameters
    function getSpeedMarketsAMMParameters(address _walletAddress) external view returns (SpeedMarketsAMMParameters memory) {
        return
            SpeedMarketsAMMParameters(
                ISpeedMarketsAMM(speedMarketsAMM).minBuyinAmount(),
                ISpeedMarketsAMM(speedMarketsAMM).maxBuyinAmount(),
                ISpeedMarketsAMM(speedMarketsAMM).minimalTimeToMaturity(),
                ISpeedMarketsAMM(speedMarketsAMM).maximalTimeToMaturity(),
                ISpeedMarketsAMM(speedMarketsAMM).maximumPriceDelay(),
                ISpeedMarketsAMM(speedMarketsAMM).maximumPriceDelayForResolving(),
                ISpeedMarketsAMM(speedMarketsAMM).lpFee(),
                ISpeedMarketsAMM(speedMarketsAMM).safeBoxImpact(),
                _walletAddress != address(0) ? ISpeedMarketsAMM(speedMarketsAMM).whitelistedAddresses(_walletAddress) : false
            );
    }

    //////////////////events/////////////////

    event SetSpeedMarketsAMM(address _speedMarketsAMM);
}

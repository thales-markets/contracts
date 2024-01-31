// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

import "../interfaces/ISpeedMarkets.sol";

// import "../interfaces/IChainedSpeedMarketsAMM.sol";

// import "./SpeedMarket.sol";
// import "./ChainedSpeedMarket.sol";

/// @title An AMM data fetching for Thales speed markets
contract SpeedMarketsData is Initializable, ProxyOwned, ProxyPausable {
    address public speedMarketsAMM;

    address public chainedSpeedMarketsAMM;

    struct MarketData {
        address user;
        bytes32 asset;
        uint64 strikeTime;
        int64 strikePrice;
        ISpeedMarkets.Direction direction;
        uint buyinAmount;
        bool resolved;
        int64 finalPrice;
        ISpeedMarkets.Direction result;
        bool isUserWinner;
        uint safeBoxImpact;
        uint lpFee;
        uint256 createdAt;
    }

    struct Risk {
        uint current;
        uint max;
    }

    struct RiskPerDirection {
        ISpeedMarkets.Direction direction;
        uint current;
        uint max;
    }

    struct SpeedMarketsAMMParameters {
        uint numActiveMarkets;
        uint numMaturedMarkets;
        uint numActiveMarketsPerUser;
        uint numMaturedMarketsPerUser;
        uint minBuyinAmount;
        uint maxBuyinAmount;
        uint minimalTimeToMaturity;
        uint maximalTimeToMaturity;
        uint64 maximumPriceDelay;
        uint64 maximumPriceDelayForResolving;
        uint[] timeThresholdsForFees;
        uint[] lpFees;
        uint lpFee;
        uint maxSkewImpact;
        uint safeBoxImpact;
        bool isAddressWhitelisted;
    }

    function initialize(address _owner, address _speedMarketsAMM) external initializer {
        setOwner(_owner);
        speedMarketsAMM = _speedMarketsAMM;
    }

    /// @notice Set speed and chained speed markets AMM addresses
    /// @param _speedMarketsAMM to use address for fetching speed AMM data
    /// @param _chainedSpeedMarketsAMM to use address for fetching chained speed AMM data
    function setSpeedMarketsAMM(address _speedMarketsAMM, address _chainedSpeedMarketsAMM) external onlyOwner {
        speedMarketsAMM = _speedMarketsAMM;
        chainedSpeedMarketsAMM = _chainedSpeedMarketsAMM;
        emit SetSpeedMarketsAMM(_speedMarketsAMM, _chainedSpeedMarketsAMM);
    }

    //////////////////getters/////////////////

    /// @notice return all speed market data for an array of markets
    function getMarketsData(bytes32[] calldata marketsArray) external view returns (MarketData[] memory) {
        MarketData[] memory markets = new MarketData[](marketsArray.length);
        ISpeedMarkets speedMarkets = ISpeedMarkets(speedMarketsAMM);
        for (uint i = 0; i < marketsArray.length; i++) {
            ISpeedMarkets.SpeedMarketData memory market = speedMarkets.speedMarket(marketsArray[i]);
            markets[i].user = market.user;
            markets[i].asset = market.asset;
            markets[i].strikeTime = market.strikeTime;
            markets[i].strikePrice = market.strikePrice;
            markets[i].direction = market.direction;
            markets[i].buyinAmount = market.buyinAmount;
            markets[i].resolved = market.resolved;
            markets[i].finalPrice = market.finalPrice;
            markets[i].result = market.result;
            markets[i].isUserWinner = market.resolved && (market.direction == market.result);
            markets[i].safeBoxImpact = market.safeBoxImpact;
            markets[i].lpFee = market.lpFee;
            markets[i].createdAt = market.createdAt;
        }
        return markets;
    }

    /// @notice return all risk data (current and max) by specified asset
    function getRiskPerAsset(bytes32 asset) external view returns (Risk memory) {
        Risk memory risk;
        risk.current = ISpeedMarkets(speedMarketsAMM).currentRiskPerAsset(asset);
        risk.max = ISpeedMarkets(speedMarketsAMM).maxRiskPerAsset(asset);
        return risk;
    }

    /// @notice return all risk data (direction, current and max) for both directions (Up and Down) by specified asset
    function getDirectionalRiskPerAsset(bytes32 asset) external view returns (RiskPerDirection[] memory) {
        ISpeedMarkets.Direction[] memory directions = new ISpeedMarkets.Direction[](2);
        directions[0] = ISpeedMarkets.Direction.Up;
        directions[1] = ISpeedMarkets.Direction.Down;

        RiskPerDirection[] memory risks = new RiskPerDirection[](directions.length);
        for (uint i = 0; i < directions.length; i++) {
            ISpeedMarkets.Direction currentDirection = directions[i];
            risks[i].direction = currentDirection;
            risks[i].current = ISpeedMarkets(speedMarketsAMM).currentRiskPerAssetAndDirection(asset, currentDirection);
            risks[i].max = ISpeedMarkets(speedMarketsAMM).maxRiskPerAssetAndDirection(asset, currentDirection);
        }

        return risks;
    }

    /// @notice return all speed AMM parameters
    function getSpeedMarketsAMMParameters(address _walletAddress) external view returns (SpeedMarketsAMMParameters memory) {
        uint[5] memory allLengths = ISpeedMarkets(speedMarketsAMM).getLengths(_walletAddress);

        uint lpFeesLength = allLengths[4];
        uint[] memory timeThresholdsForFees = new uint[](lpFeesLength);
        uint[] memory lpFees = new uint[](lpFeesLength);
        for (uint i = 0; i < lpFeesLength; i++) {
            timeThresholdsForFees[i] = ISpeedMarkets(speedMarketsAMM).timeThresholdsForFees(i);
            lpFees[i] = ISpeedMarkets(speedMarketsAMM).lpFees(i);
        }

        return
            SpeedMarketsAMMParameters(
                allLengths[0], // numActiveMarkets
                allLengths[1], // numMaturedMarkets
                _walletAddress != address(0) ? allLengths[2] : 0, // numActiveMarketsPerUser
                _walletAddress != address(0) ? allLengths[3] : 0, // numMaturedMarketsPerUser
                ISpeedMarkets(speedMarketsAMM).minBuyinAmount(),
                ISpeedMarkets(speedMarketsAMM).maxBuyinAmount(),
                ISpeedMarkets(speedMarketsAMM).minimalTimeToMaturity(),
                ISpeedMarkets(speedMarketsAMM).maximalTimeToMaturity(),
                ISpeedMarkets(speedMarketsAMM).maximumPriceDelay(),
                ISpeedMarkets(speedMarketsAMM).maximumPriceDelayForResolving(),
                timeThresholdsForFees,
                lpFees,
                ISpeedMarkets(speedMarketsAMM).lpFee(),
                ISpeedMarkets(speedMarketsAMM).maxSkewImpact(),
                ISpeedMarkets(speedMarketsAMM).safeBoxImpact(),
                _walletAddress != address(0) ? ISpeedMarkets(speedMarketsAMM).whitelistedAddresses(_walletAddress) : false
            );
    }

    //////////////////events/////////////////

    event SetSpeedMarketsAMM(address _speedMarketsAMM, address _chainedSpeedMarketsAMM);
}

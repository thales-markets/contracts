// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

import "../interfaces/ISpeedMarketsAMM.sol";
import "../interfaces/IChainedSpeedMarketsAMM.sol";

import "./SpeedMarket.sol";
import "./ChainedSpeedMarket.sol";

/// @title An AMM data fetching for Thales speed markets
contract SpeedMarketsAMMData is Initializable, ProxyOwned, ProxyPausable {
    address public speedMarketsAMM;

    address public chainedSpeedMarketsAMM;

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
        uint safeBoxImpact;
        uint lpFee;
        uint256 createdAt;
    }

    struct ChainedMarketData {
        address user;
        bytes32 asset;
        uint64 timeFrame;
        uint64 initialStrikeTime;
        uint64 strikeTime;
        int64 initialStrikePrice;
        SpeedMarket.Direction[] directions;
        int64[] strikePrices;
        int64[] finalPrices;
        uint buyinAmount;
        uint payout;
        bool resolved;
        bool isUserWinner;
        uint safeBoxImpact;
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

    struct ChainedSpeedMarketsAMMParameters {
        uint numActiveMarkets;
        uint numMaturedMarkets;
        uint numActiveMarketsPerUser;
        uint numMaturedMarketsPerUser;
        uint minChainedMarkets;
        uint maxChainedMarkets;
        uint64 minTimeFrame;
        uint64 maxTimeFrame;
        uint minBuyinAmount;
        uint maxBuyinAmount;
        uint maxProfitPerIndividualMarket;
        Risk risk;
        uint payoutMultiplier;
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

            if (ISpeedMarketsAMM(speedMarketsAMM).marketHasFeeAttribute(marketsArray[i])) {
                markets[i].safeBoxImpact = market.safeBoxImpact();
                markets[i].lpFee = market.lpFee();
            }
            if (ISpeedMarketsAMM(speedMarketsAMM).marketHasCreatedAtAttribute(marketsArray[i])) {
                markets[i].createdAt = market.createdAt();
            }
        }
        return markets;
    }

    /// @notice return all chained speed market data for an array of markets
    function getChainedMarketsData(address[] calldata marketsArray) external view returns (ChainedMarketData[] memory) {
        ChainedMarketData[] memory markets = new ChainedMarketData[](marketsArray.length);
        for (uint i = 0; i < marketsArray.length; i++) {
            ChainedSpeedMarket market = ChainedSpeedMarket(marketsArray[i]);
            markets[i].user = market.user();
            markets[i].asset = market.asset();
            markets[i].timeFrame = market.timeFrame();
            markets[i].initialStrikeTime = market.initialStrikeTime();
            markets[i].strikeTime = market.strikeTime();
            markets[i].initialStrikePrice = market.initialStrikePrice();

            SpeedMarket.Direction[] memory marketDirections = new SpeedMarket.Direction[](market.numOfDirections());
            int64[] memory marketStrikePrices = new int64[](market.numOfPrices());
            int64[] memory marketFinalPrices = new int64[](market.numOfPrices());
            for (uint j = 0; j < market.numOfDirections(); j++) {
                marketDirections[j] = market.directions(j);
                if (j < market.numOfPrices()) {
                    marketStrikePrices[j] = market.strikePrices(j);
                    marketFinalPrices[j] = market.finalPrices(j);
                }
            }
            markets[i].directions = marketDirections;
            markets[i].strikePrices = marketStrikePrices;
            markets[i].finalPrices = marketFinalPrices;

            markets[i].buyinAmount = market.buyinAmount();
            markets[i].payout = IChainedSpeedMarketsAMM(chainedSpeedMarketsAMM).sUSD().balanceOf(address(market));
            markets[i].resolved = market.resolved();
            markets[i].isUserWinner = market.isUserWinner();
            markets[i].safeBoxImpact = market.safeBoxImpact();
            markets[i].createdAt = market.createdAt();
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

    /// @notice return all speed AMM parameters
    function getSpeedMarketsAMMParameters(address _walletAddress) external view returns (SpeedMarketsAMMParameters memory) {
        uint[5] memory allLengths = ISpeedMarketsAMM(speedMarketsAMM).getLengths(_walletAddress);

        uint lpFeesLength = allLengths[4];
        uint[] memory timeThresholdsForFees = new uint[](lpFeesLength);
        uint[] memory lpFees = new uint[](lpFeesLength);
        for (uint i = 0; i < lpFeesLength; i++) {
            timeThresholdsForFees[i] = (ISpeedMarketsAMM(speedMarketsAMM).timeThresholdsForFees(i));
            lpFees[i] = (ISpeedMarketsAMM(speedMarketsAMM).lpFees(i));
        }

        return
            SpeedMarketsAMMParameters(
                allLengths[0], // numActiveMarkets
                allLengths[1], // numMaturedMarkets
                _walletAddress != address(0) ? allLengths[2] : 0, // numActiveMarketsPerUser
                _walletAddress != address(0) ? allLengths[3] : 0, // numMaturedMarketsPerUser
                ISpeedMarketsAMM(speedMarketsAMM).minBuyinAmount(),
                ISpeedMarketsAMM(speedMarketsAMM).maxBuyinAmount(),
                ISpeedMarketsAMM(speedMarketsAMM).minimalTimeToMaturity(),
                ISpeedMarketsAMM(speedMarketsAMM).maximalTimeToMaturity(),
                ISpeedMarketsAMM(speedMarketsAMM).maximumPriceDelay(),
                ISpeedMarketsAMM(speedMarketsAMM).maximumPriceDelayForResolving(),
                timeThresholdsForFees,
                lpFees,
                ISpeedMarketsAMM(speedMarketsAMM).lpFee(),
                ISpeedMarketsAMM(speedMarketsAMM).maxSkewImpact(),
                ISpeedMarketsAMM(speedMarketsAMM).safeBoxImpact(),
                _walletAddress != address(0) ? ISpeedMarketsAMM(speedMarketsAMM).whitelistedAddresses(_walletAddress) : false
            );
    }

    /// @notice return all chained speed AMM parameters
    function getChainedSpeedMarketsAMMParameters(address _walletAddress)
        external
        view
        returns (ChainedSpeedMarketsAMMParameters memory)
    {
        uint[4] memory allLengths = IChainedSpeedMarketsAMM(chainedSpeedMarketsAMM).getLengths(_walletAddress);

        Risk memory risk;
        risk.current = IChainedSpeedMarketsAMM(chainedSpeedMarketsAMM).currentRisk();
        risk.max = IChainedSpeedMarketsAMM(chainedSpeedMarketsAMM).maxRisk();

        return
            ChainedSpeedMarketsAMMParameters(
                allLengths[0], // numActiveMarkets
                allLengths[1], // numMaturedMarkets
                _walletAddress != address(0) ? allLengths[2] : 0, // numActiveMarketsPerUser
                _walletAddress != address(0) ? allLengths[3] : 0, // numMaturedMarketsPerUser
                IChainedSpeedMarketsAMM(chainedSpeedMarketsAMM).minChainedMarkets(),
                IChainedSpeedMarketsAMM(chainedSpeedMarketsAMM).maxChainedMarkets(),
                IChainedSpeedMarketsAMM(chainedSpeedMarketsAMM).minTimeFrame(),
                IChainedSpeedMarketsAMM(chainedSpeedMarketsAMM).maxTimeFrame(),
                IChainedSpeedMarketsAMM(chainedSpeedMarketsAMM).minBuyinAmount(),
                IChainedSpeedMarketsAMM(chainedSpeedMarketsAMM).maxBuyinAmount(),
                IChainedSpeedMarketsAMM(chainedSpeedMarketsAMM).maxProfitPerIndividualMarket(),
                risk,
                IChainedSpeedMarketsAMM(chainedSpeedMarketsAMM).payoutMultiplier()
            );
    }

    //////////////////events/////////////////

    event SetSpeedMarketsAMM(address _speedMarketsAMM, address _chainedSpeedMarketsAMM);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";

import "../interfaces/IStakingThales.sol";

contract StakingThalesBonusRewardsManager is ProxyOwned, Initializable, ProxyReentrancyGuard {
    uint private constant ONE = 1e18;

    /// @return the adddress of the staking contract
    address public stakingThales;

    uint public stakingBaseDivider;

    uint public vaultsMultiplier;
    uint public lpMultiplier;
    uint public tradingMultiplier;

    mapping(address => mapping(uint => uint)) public userVaultBasePointsPerRound;
    mapping(address => mapping(uint => uint)) public userLPBasePointsPerRound;
    mapping(address => mapping(uint => uint)) public userTradingBasePointsPerRound;
    mapping(address => mapping(uint => uint)) public userRoundBonusPoints;

    mapping(uint => uint) public totalVaultBasePointsPerRound;
    mapping(uint => uint) public totalLPBasePointsPerRound;
    mapping(uint => uint) public totalTradingBasePointsPerRound;
    mapping(uint => uint) public totalRoundBonusPoints;

    mapping(address => bool) public knownVaults;
    mapping(address => bool) public knownLiquidityPools;
    mapping(address => bool) public knownTradingAMMs;

    bool public useNewBonusModel;

    function initialize(address _owner, address _stakingThales) public initializer {
        setOwner(_owner);
        initNonReentrant();
        stakingThales = _stakingThales;
    }

    /// @notice Setting the SportAMMLiquidityPool
    /// @param _stakingThales Address of Staking contract
    function setStakingThales(address _stakingThales) external onlyOwner {
        stakingThales = _stakingThales;
        emit SetStakingThales(_stakingThales);
    }

    /// @notice Save gamified staking bonus points
    /// @param user to save points for
    /// @param origin where the points originated from (vaults, lp or trading)
    /// @param basePoints how many points were scored
    /// @param round in which round to store the points
    function storePoints(
        address user,
        address origin,
        uint basePoints,
        uint round
    ) external {
        require(msg.sender == stakingThales, "Only allowed from StakingThales");
        require(
            knownVaults[origin] || knownLiquidityPools[origin] || knownTradingAMMs[origin],
            "Only allowed for known origin"
        );
        uint multiplierToUse;
        if (knownVaults[origin]) {
            userVaultBasePointsPerRound[user][round] += basePoints;
            totalVaultBasePointsPerRound[round] += basePoints;
            multiplierToUse = vaultsMultiplier;
        } else if (knownLiquidityPools[origin]) {
            userLPBasePointsPerRound[user][round] += basePoints;
            totalLPBasePointsPerRound[round] += basePoints;
            multiplierToUse = lpMultiplier;
        } else if (knownTradingAMMs[origin]) {
            userTradingBasePointsPerRound[user][round] += basePoints;
            totalTradingBasePointsPerRound[round] += basePoints;
            multiplierToUse = tradingMultiplier;
        }
        uint newBonusPoints = ((ONE + getStakingMultiplier(user)) * (basePoints * tradingMultiplier)) / ONE;
        userRoundBonusPoints[user][round] += newBonusPoints;
        totalRoundBonusPoints[round] += newBonusPoints;
        emit PointsStored(user, origin, basePoints, round);
    }

    /// @notice Register or unregister a known vault to accept vault points from
    function setKnownVault(address vault, bool value) external onlyOwner {
        knownVaults[vault] = value;
        emit SetKnownVault(vault, value);
    }

    /// @notice Register or unregister a known liquidity pool to accept lp points from
    function setKnownLiquidityPool(address pool, bool value) external onlyOwner {
        knownLiquidityPools[pool] = value;
        emit SetKnownLiquidityPool(pool, value);
    }

    /// @notice Register or unregister a known AMM to accept trading points from
    function setKnownTradingAMM(address amm, bool value) external onlyOwner {
        knownTradingAMMs[amm] = value;
        emit SetKnownTradingAMM(amm, value);
    }

    /// @notice A value to use for the staking multiplier, e.g. 100k on Optimism
    function setStakingBaseDivider(uint value) external onlyOwner {
        stakingBaseDivider = value;
        emit SetStakingBaseDivider(value);
    }

    /// @notice set multiplers for each category
    function setMultipliers(
        uint _vaultsMultiplier,
        uint _lpMultiplier,
        uint _tradingMultiplier
    ) external onlyOwner {
        vaultsMultiplier = _vaultsMultiplier;
        lpMultiplier = _lpMultiplier;
        tradingMultiplier = _tradingMultiplier;
        emit SetMultipliers(_vaultsMultiplier, _lpMultiplier, _tradingMultiplier);
    }

    /// @notice a boolean to use for when to turn the new model on.
    function setUseNewModel(bool value) external onlyOwner {
        useNewBonusModel = value;
        emit SetUseNewModel(value);
    }

    /// @notice return the share of bonus rewards per user per round.
    function getUserRoundBonusShare(address user, uint round) public view returns (uint) {
        return (userRoundBonusPoints[user][round] * ONE) / totalRoundBonusPoints[round];
    }

    /// @notice return the staking multipler per user
    function getStakingMultiplier(address user) public view returns (uint) {
        return IStakingThales(stakingThales).stakedBalanceOf(user) / stakingBaseDivider;
    }

    event SetStakingThales(address _stakingThales);
    event PointsStored(address user, address origin, uint basePoints, uint round);
    event SetKnownVault(address vault, bool value);
    event SetKnownLiquidityPool(address pool, bool value);
    event SetKnownTradingAMM(address amm, bool value);
    event SetMultipliers(uint _vaultsMultiplier, uint _lpMultiplier, uint _tradingMultiplier);
    event SetStakingBaseDivider(uint value);
    event SetUseNewModel(bool value);
}

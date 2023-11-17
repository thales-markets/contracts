// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";

import "../interfaces/IStakingThales.sol";
import "../interfaces/IVault.sol";
import "../interfaces/IPositionalMarketManagerTruncated.sol";

import "../utils/libraries/AddressSetLib.sol";

contract StakingThalesBonusRewardsManager is ProxyOwned, Initializable, ProxyReentrancyGuard {
    using AddressSetLib for AddressSetLib.AddressSet;

    uint private constant ONE = 1e18;

    struct LeaderboardStakerData {
        uint share;
        uint stakingMultiplier;
        uint userVaultBasePointsPerRound;
        uint userVaultPointsPerRound;
        uint userLPBasePointsPerRound;
        uint userLPPointsPerRound;
        uint userTradingBasePointsPerRound;
        uint userRoundBonusPoints;
    }

    /// @return the adddress of the staking contract
    address public stakingThales;

    uint public stakingBaseDivider;

    uint public maxStakingMultiplier;

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

    AddressSetLib.AddressSet internal vaults;
    AddressSetLib.AddressSet internal lps;

    struct EstimatedLeaderboardStakerData {
        uint stakingMultiplier;
        uint userVaultPointsPerRound;
        uint userLPPointsPerRound;
        uint userTradingPointsPerRound;
    }

    IPositionalMarketManagerTruncated public manager;

    function initialize(address _owner, address _stakingThales) public initializer {
        setOwner(_owner);
        initNonReentrant();
        stakingThales = _stakingThales;
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
        if (IStakingThales(stakingThales).stakedBalanceOf(user) > 0) {
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
            uint newBonusPoints = ((ONE + getStakingMultiplier(user)) * ((basePoints * multiplierToUse) / ONE)) / ONE;
            userRoundBonusPoints[user][round] += newBonusPoints;
            totalRoundBonusPoints[round] += newBonusPoints;
            emit PointsStored(user, origin, basePoints, round);
        }
    }

    /// @notice Setting the SportAMMLiquidityPool
    /// @param _stakingThales Address of Staking contract
    function setStakingThales(address _stakingThales) external onlyOwner {
        stakingThales = _stakingThales;
        emit SetStakingThales(_stakingThales);
    }

    /// @notice Register or unregister a known vault to accept vault points from
    function setKnownVault(address vault, bool value) external onlyOwner {
        knownVaults[vault] = value;
        if (value) {
            vaults.add(vault);
        } else {
            vaults.remove(vault);
        }
        emit SetKnownVault(vault, value);
    }

    /// @notice Register or unregister a known liquidity pool to accept lp points from
    function setKnownLiquidityPool(address pool, bool value) external onlyOwner {
        knownLiquidityPools[pool] = value;
        if (value) {
            lps.add(pool);
        } else {
            lps.remove(pool);
        }
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

    /// @notice Maximum value of Staking Multiplier
    function setMaxStakingMultiplier(uint value) external onlyOwner {
        maxStakingMultiplier = value;
        emit SetMaxStakingMultiplier(value);
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

    function setTotalBonusPointsPerRound(uint _round, uint _points) external {
        require(msg.sender == stakingThales, "InvSender");
        totalRoundBonusPoints[_round] = _points;
    }

    /// @notice add known vaults array
    function addVaults(address[] calldata _vaults, bool add) external onlyOwner {
        require(_vaults.length > 0, "vaults addresses cannot be empty");
        for (uint i = 0; i < _vaults.length; i++) {
            if (add) {
                vaults.add(_vaults[i]);
            } else {
                vaults.remove(_vaults[i]);
            }
        }
    }

    /// @notice add known lps array
    function addLPs(address[] calldata _lps, bool add) external onlyOwner {
        require(_lps.length > 0, "_lps addresses cannot be empty");
        for (uint i = 0; i < _lps.length; i++) {
            if (add) {
                lps.add(_lps[i]);
            } else {
                lps.remove(_lps[i]);
            }
        }
    }

    function setManager(address _manager) external onlyOwner {
        manager = IPositionalMarketManagerTruncated(_manager);
        emit ManagerChanged(_manager);
    }

    //***********************VIEWS***********************

    /// @notice return the share of bonus rewards per user per round.
    function getUserRoundBonusShare(address user, uint round) public view returns (uint userShare) {
        if (totalRoundBonusPoints[round] > 0) {
            userShare = (userRoundBonusPoints[user][round] * ONE) / totalRoundBonusPoints[round];
        }
    }

    /// @notice return the staking multipler per user
    function getStakingMultiplier(address user) public view returns (uint) {
        uint calculatedMultiplier = IStakingThales(stakingThales).stakedBalanceOf(user) / stakingBaseDivider;
        return calculatedMultiplier < maxStakingMultiplier ? calculatedMultiplier : maxStakingMultiplier;
    }

    /// @notice return leaderboard data
    function getStakersLeaderboardData(address[] calldata stakers, uint round)
        external
        view
        returns (LeaderboardStakerData[] memory)
    {
        LeaderboardStakerData[] memory stakersArray = new LeaderboardStakerData[](stakers.length);

        for (uint i = 0; i < stakers.length; i++) {
            stakersArray[i].share = getUserRoundBonusShare(stakers[i], round);
            stakersArray[i].stakingMultiplier = getStakingMultiplier(stakers[i]);
            stakersArray[i].userVaultBasePointsPerRound = userVaultBasePointsPerRound[stakers[i]][round];
            stakersArray[i].userLPBasePointsPerRound = userLPBasePointsPerRound[stakers[i]][round];
            stakersArray[i].userVaultPointsPerRound =
                (userVaultBasePointsPerRound[stakers[i]][round] * vaultsMultiplier) /
                ONE;
            stakersArray[i].userLPPointsPerRound = (userLPBasePointsPerRound[stakers[i]][round] * lpMultiplier) / ONE;
            stakersArray[i].userTradingBasePointsPerRound = userTradingBasePointsPerRound[stakers[i]][round];
            stakersArray[i].userRoundBonusPoints = userRoundBonusPoints[stakers[i]][round];
        }
        return stakersArray;
    }

    /// @notice return estimated leaderboard data
    function getEstimatedCurrentStakersLeaderboardData(address[] calldata stakers, uint round)
        external
        view
        returns (EstimatedLeaderboardStakerData[] memory)
    {
        EstimatedLeaderboardStakerData[] memory stakersArray = new EstimatedLeaderboardStakerData[](stakers.length);

        for (uint i = 0; i < stakers.length; i++) {
            stakersArray[i].stakingMultiplier = getStakingMultiplier(stakers[i]);
            stakersArray[i].userVaultPointsPerRound = getEstimatedCurrentVaultPoints(stakers[i]);
            stakersArray[i].userLPPointsPerRound = getEstimatedCurrentLPsPoints(stakers[i]);
            stakersArray[i].userTradingPointsPerRound = userTradingBasePointsPerRound[stakers[i]][round];
        }
        return stakersArray;
    }

    function getEstimatedCurrentVaultPoints(address user) public view returns (uint estimatedPoints) {
        uint numVaults = vaults.elements.length;
        address[] memory vaultsIterable = vaults.getPage(0, numVaults);
        for (uint i = 0; i < vaultsIterable.length; i++) {
            uint vaultRound = IVault(vaultsIterable[i]).round();
            uint vaultPoints = (IVault(vaultsIterable[i]).balancesPerRound(vaultRound, user) * vaultsMultiplier) / ONE;
            if (address(manager) != address(0)) {
                vaultPoints = manager.reverseTransformCollateral(vaultPoints);
            }
            estimatedPoints += vaultPoints;
        }
    }

    function getEstimatedCurrentLPsPoints(address user) public view returns (uint estimatedPoints) {
        uint numLPs = lps.elements.length;
        address[] memory vaultsIterable = lps.getPage(0, numLPs);
        for (uint i = 0; i < vaultsIterable.length; i++) {
            uint vaultRound = IVault(vaultsIterable[i]).round();
            uint vaultPoints = (IVault(vaultsIterable[i]).balancesPerRound(vaultRound, user) * lpMultiplier) / ONE;
            if (address(manager) != address(0)) {
                vaultPoints = manager.reverseTransformCollateral(vaultPoints);
            }
            estimatedPoints += vaultPoints;
        }
    }

    event ManagerChanged(address manager);
    event SetStakingThales(address _stakingThales);
    event PointsStored(address user, address origin, uint basePoints, uint round);
    event SetKnownVault(address vault, bool value);
    event SetKnownLiquidityPool(address pool, bool value);
    event SetKnownTradingAMM(address amm, bool value);
    event SetMultipliers(uint _vaultsMultiplier, uint _lpMultiplier, uint _tradingMultiplier);
    event SetStakingBaseDivider(uint value);
    event SetMaxStakingMultiplier(uint value);
    event SetUseNewModel(bool value);
}

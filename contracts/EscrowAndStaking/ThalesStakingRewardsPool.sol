// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../interfaces/IEscrowThales.sol";
import "../interfaces/IStakingThales.sol";
import "../interfaces/IThalesStakingRewardsPool.sol";

contract ThalesStakingRewardsPool is IThalesStakingRewardsPool, Initializable, ProxyOwned, ProxyReentrancyGuard, ProxyPausable {
    /* ========== LIBRARIES ========== */
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    IStakingThales public iStakingThales;
    IEscrowThales public iEscrowThales;
    IERC20 public rewardToken;
    
    uint public lifetimeClaimedRewards;

    function initialize(
        address _owner,
        address _stakingToken,
        address _rewardToken,
        address _escrowToken //THALES
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        iStakingThales = IStakingThales(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        iEscrowThales = IEscrowThales(_escrowToken);
        rewardToken.approve(_escrowToken, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
    }

    function setStakingThalesContract(address _stakingThalesContract) external onlyOwner {
        require(_stakingThalesContract != address(0), "Invalid address set");
        iStakingThales = IStakingThales(_stakingThalesContract);
        emit StakingThalesChanged(_stakingThalesContract);
    }

    function setEscrow(address _escrowThalesContract) public onlyOwner {
        if (address(iEscrowThales) != address(0)) {
            rewardToken.approve(address(iEscrowThales), 0);
        }
        iEscrowThales = IEscrowThales(_escrowThalesContract);
        rewardToken.approve(_escrowThalesContract, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
        emit EscrowThalesChanged(_escrowThalesContract);
    }

    function setRewardToken(address _rewardToken) external onlyOwner {
        require(_rewardToken != address(0), "Invalid address set");
        if (address(iEscrowThales) != address(0)) {
            rewardToken.approve(address(iEscrowThales), 0);
        }
        rewardToken = IERC20(_rewardToken);
        rewardToken.approve(address(iEscrowThales), 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
        emit RewardTokenChanged(_rewardToken);
    }


    function addToEscrow(address account, uint amount) external override {
        require(account != address(0), "Invalid address");
        require(amount > 0, "Amount is 0");
        require(
            msg.sender == address(iStakingThales),
            "Add to escrow can only be called from staking or ongoing airdrop contracts"
        );

        iEscrowThales.addToEscrow(account, amount);
        lifetimeClaimedRewards = lifetimeClaimedRewards.add(amount);

    }

    event StakingThalesChanged(address stakingThales);
    event EscrowThalesChanged(address escrowThalesContract);
    event RewardTokenChanged(address rewardToken);

}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";

contract DefaultLiquidityProvider is ProxyOwned, Initializable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable public sUSD;

    uint private constant MAX_APPROVAL = type(uint256).max;

    /// @return the adddress of the AMMLP contract
    address public liquidityPool;

    function initialize(
        address _owner,
        IERC20Upgradeable _sUSD,
        address _sportAMMLiquidityPool
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        sUSD = _sUSD;
        liquidityPool = _sportAMMLiquidityPool;
        sUSD.approve(liquidityPool, MAX_APPROVAL);
    }

    /// @notice Setting the SportAMMLiquidityPool
    /// @param _sportAMMLiquidityPool Address of Staking contract
    function setSportAMMLiquidityPool(address _sportAMMLiquidityPool) external onlyOwner {
        if (liquidityPool != address(0)) {
            sUSD.approve(liquidityPool, 0);
        }
        liquidityPool = _sportAMMLiquidityPool;
        sUSD.approve(_sportAMMLiquidityPool, MAX_APPROVAL);
        emit SetSportAMMLiquidityPool(_sportAMMLiquidityPool);
    }

    function retrieveSUSDAmount(address payable account, uint amount) external onlyOwner nonReentrant {
        sUSD.safeTransfer(account, amount);
    }

    event SetSportAMMLiquidityPool(address _sportAMMLiquidityPool);
}

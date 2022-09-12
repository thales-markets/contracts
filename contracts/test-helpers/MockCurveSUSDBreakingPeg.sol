// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "../utils/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "../utils/libraries/UniswapMath.sol";

contract MockCurveSUSDBreakingPeg {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable public sUSD;
    IERC20Upgradeable public USDC;
    IERC20Upgradeable public USDT;
    IERC20Upgradeable public DAI;

    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant BREAKING_PERCENT = 3e16;

    constructor(
        address _sUSD,
        address _USDC,
        address _USDT,
        address _DAI
    ) {
        sUSD = IERC20Upgradeable(_sUSD);
        USDC = IERC20Upgradeable(_USDC);
        USDT = IERC20Upgradeable(_USDT);
        DAI = IERC20Upgradeable(_DAI);
    }

    function exchange_underlying(
        int128 i,
        int128 j,
        uint256 _dx,
        uint256 _min_dy
    ) external returns (uint256) {
        if (j == 1) {
            DAI.transfer(msg.sender, (_dx * (ONE - BREAKING_PERCENT)) / ONE);
            sUSD.transferFrom(msg.sender, address(this), _dx);
            return (_dx * (ONE - BREAKING_PERCENT)) / ONE;
        }
        if (j == 2) {
            USDC.transfer(msg.sender, ((_dx / 1e12) * (ONE - BREAKING_PERCENT)) / ONE);
            sUSD.transferFrom(msg.sender, address(this), _dx);
            return ((_dx / 1e12) * (ONE - BREAKING_PERCENT)) / ONE;
        }
        if (j == 3) {
            USDT.transfer(msg.sender, ((_dx / 1e12) * (ONE - BREAKING_PERCENT)) / ONE);
            sUSD.transferFrom(msg.sender, address(this), _dx);
            return ((_dx / 1e12) * (ONE - BREAKING_PERCENT)) / ONE;
        } else return 0;
    }

    function get_dy_underlying(
        int128 i,
        int128 j,
        uint256 _dx
    ) external view returns (uint256) {
        if (j == 1) {
            return (_dx * (ONE - BREAKING_PERCENT)) / ONE;
        } else return ((_dx / 1e12) * (ONE - BREAKING_PERCENT)) / ONE;
    }
}

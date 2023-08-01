pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

contract CurveMock {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable public sUSD;
    IERC20Upgradeable public USDC;
    IERC20Upgradeable public USDT;
    IERC20Upgradeable public DAI;

    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;

    uint public multiplier = 1;

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
    ) external returns (uint256 amountOut) {
        USDC.safeTransferFrom(msg.sender, address(this), _dx);
        sUSD.safeTransfer(msg.sender, _min_dy * multiplier);
        amountOut = _min_dy * multiplier;
    }

    function setMultiplier(uint _multiplier) external {
        multiplier = _multiplier;
    }
}

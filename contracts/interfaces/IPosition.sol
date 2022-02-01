pragma solidity >=0.5.16 <0.8.4;

import "../interfaces/IPositionalMarket.sol";
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/IERC20.sol";

interface IPosition {
    /* ========== VIEWS / VARIABLES ========== */

    function market() external view returns (IPositionalMarket);

    function balanceOf(address account) external view returns (uint);

    function totalSupply() external view returns (uint);

}

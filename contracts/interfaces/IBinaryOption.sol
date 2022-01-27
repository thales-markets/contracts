pragma solidity >=0.5.16 <0.8.4;

import "../interfaces/IBinaryOptionMarket.sol";
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/IERC20.sol";

interface IBinaryOption {
    /* ========== VIEWS / VARIABLES ========== */

    function market() external view returns (IBinaryOptionMarket);

    function balanceOf(address account) external view returns (uint);

    function totalSupply() external view returns (uint);

}

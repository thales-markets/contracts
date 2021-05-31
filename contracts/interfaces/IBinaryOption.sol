pragma solidity >=0.4.24;

import "../interfaces/IBinaryOptionMarket.sol";
import "synthetix-2.43.1/contracts/interfaces/IERC20.sol";

interface IBinaryOption {
    /* ========== VIEWS / VARIABLES ========== */

    function market() external view returns (IBinaryOptionMarket);

    function balanceOf(address account) external view returns (uint);

    function totalSupply() external view returns (uint);

}

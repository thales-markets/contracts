pragma solidity ^0.5.16;

import "../interfaces/IBinaryOptionMarket.sol";
import "synthetix-2.50.4-ovm/contracts/interfaces/IERC20.sol";

interface IBinaryOption {
    /* ========== VIEWS / VARIABLES ========== */

    function market() external view returns (IBinaryOptionMarket);

    function balanceOf(address account) external view returns (uint);

    function totalSupply() external view returns (uint);

}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IParlayMarketsAMM {
    /* ========== VIEWS / VARIABLES ========== */

    function parlaySize() external view returns (uint);
    function sUSD() external view returns(IERC20Upgradeable);

    function transferRestOfSUSDAmount(address receiver, uint amount, bool dueToCancellation) external;
    function triggerResolvedEvent(address _account, bool _userWon) external;

}

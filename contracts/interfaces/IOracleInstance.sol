pragma solidity >=0.5.16 <0.8.4;

import "../interfaces/IPositionalMarket.sol";

interface IOracleInstance {
    /* ========== VIEWS / VARIABLES ========== */

    function getOutcome() external view returns (bool);

    function resolvable() external view returns (bool);

    function targetName() external view returns (string memory);

    function targetOutcome() external view returns (string memory);

    function eventName() external view returns (string memory);

    /* ========== MUTATIVE FUNCTIONS ========== */
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISportPositionalMarketFactory {
    function sportsAMM() external view returns (address);

    function positionMastercopy() external view returns (address);
}

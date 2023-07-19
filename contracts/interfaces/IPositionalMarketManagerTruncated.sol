// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IPositionalMarketManagerTruncated {
    function transformCollateral(uint value) external view returns (uint);

    function reverseTransformCollateral(uint value) external view returns (uint);
}

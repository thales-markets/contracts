// SPDX-License-Identifier: MIT
pragma solidity ^0.5.16;

import "@chainlink/contracts/src/v0.5/interfaces/AggregatorV2V3Interface.sol";
import "synthetix-2.50.4-ovm/contracts/SafeDecimalMath.sol";

import "synthetix-2.50.4-ovm/contracts/Owned.sol";

contract TestFlippeningRatioOracle is Owned {
    using SafeMath for uint;
    using SafeDecimalMath for uint;

    AggregatorV2V3Interface internal firstMarketcap;
    AggregatorV2V3Interface internal secondMarketcap;

    constructor(
        address _owner,
        address _first,
        address _second
    ) public Owned(_owner) {
        firstMarketcap = AggregatorV2V3Interface(_first);
        secondMarketcap = AggregatorV2V3Interface(_second);
    }

    function getRatio() public pure returns (uint) {
        // uint firstPrice = uint(firstMarketcap.latestAnswer());
        // uint secondPrice = uint(secondMarketcap.latestAnswer());
        uint firstPrice = 38952110225900000000;
        uint secondPrice = 90409822707281120000;
       
        return firstPrice.mul(1e18).div(secondPrice);
    }

    function setFirstMarketcap(address _marketcap) public onlyOwner {
        firstMarketcap = AggregatorV2V3Interface(_marketcap);
    }

    function setSecondMarketcap(address _marketcap) public onlyOwner {
        secondMarketcap = AggregatorV2V3Interface(_marketcap);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.5.16;

import "@chainlink/contracts/src/v0.5/interfaces/AggregatorV3Interface.sol";
import "../interfaces/IOracleInstance.sol";
import "synthetix-2.43.1/contracts/Owned.sol";

contract PriceFeedInstance is IOracleInstance, Owned {

    AggregatorV3Interface internal priceFeed;

    string public targetName;
    constructor(
        address _owner,
        address _priceFeed,
        string memory _targetName
    ) public Owned(_owner) {
        priceFeed = AggregatorV3Interface(_priceFeed);
        targetName = _targetName;
    }

    function setPriceFeed(address _priceFeed) public onlyOwner {
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    function getPrice() public view returns(int) {
        (
            uint80 roundID, 
            int price,
            uint startedAt,
            uint timeStamp,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        return price;
    }
}
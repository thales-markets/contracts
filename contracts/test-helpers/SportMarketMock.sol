pragma solidity ^0.8.0;

contract SportMarketMock {
    uint public tag;
    uint public startTime;

    constructor(uint _tag) {
        tag = _tag;
    }

    function setStartTime(uint _startTime) external {
        startTime = _startTime;
    }

    function tags(uint idx) external view returns (uint) {
        if (idx == 0) {
            return tag;
        } else return 0;
    }

    function isChild() external view returns (bool) {
        return false;
    }

    function times() external view returns (uint maturity, uint destruction) {
        maturity = startTime;
    }

    function getTags() external view returns (uint tag1, uint tag2) {
        tag1 = tag;
    }
}

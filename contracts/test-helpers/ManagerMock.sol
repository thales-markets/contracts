pragma solidity ^0.8.0;

contract ManagerMock {
    bool public needsTransformingCollateral = true;

    function transformCollateral(uint value) external view returns (uint) {
        return _transformCollateral(value);
    }

    function _transformCollateral(uint value) internal view returns (uint) {
        if (needsTransformingCollateral) {
            return value / 1e12;
        } else {
            return value;
        }
    }

    function reverseTransformCollateral(uint value) external view returns (uint) {
        if (needsTransformingCollateral) {
            return value * 1e12;
        } else {
            return value;
        }
    }
}

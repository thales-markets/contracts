// SPDX-License-Identifier: MIT

pragma solidity >=0.5.16;

interface IStakingThalesBonusRewardsManager {
    function storePoints(
        address user,
        address origin,
        uint basePoins,
        uint round
    ) external;

    function getUserRoundBonusShare(address user, uint round) external view returns (uint);

    function useNewBonusModel() external view returns (bool);

    function totalRoundBonusPoints(uint round) external view returns (uint);
}

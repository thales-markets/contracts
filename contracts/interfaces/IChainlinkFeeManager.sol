pragma solidity ^0.8.0;

import "@chainlink/contracts-0.8.0/src/v0.8/libraries/Common.sol";

interface IChainlinkFeeManager {
    /**
     * @return fee, reward, totalDiscount
     */
    function getFeeAndReward(
        address subscriber,
        bytes memory unverifiedReport,
        address quoteAddress
    )
        external
        returns (
            Common.Asset memory,
            Common.Asset memory,
            uint256
        );

    function i_linkAddress() external view returns (address);

    function i_nativeAddress() external view returns (address);

    function i_rewardManager() external view returns (address);
}

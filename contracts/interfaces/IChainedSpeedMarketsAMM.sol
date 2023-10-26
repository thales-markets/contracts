// SPDX-License-Identifier: MIT

pragma solidity >=0.5.16;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "../SpeedMarkets/SpeedMarket.sol";
import "../SpeedMarkets/ChainedSpeedMarket.sol";

interface IChainedSpeedMarketsAMM {
    function sUSD() external view returns (IERC20Upgradeable);

    function minChainedMarkets() external view returns (uint);

    function maxChainedMarkets() external view returns (uint);

    function minTimeFrame() external view returns (uint64);

    function maxTimeFrame() external view returns (uint64);

    function minBuyinAmount() external view returns (uint);

    function maxBuyinAmount() external view returns (uint);

    function maxProfitPerIndividualMarket() external view returns (uint);

    function payoutMultiplier() external view returns (uint);

    function maxRisk() external view returns (uint);

    function currentRisk() external view returns (uint);

    function getLengths(address user) external view returns (uint[4] memory);
}

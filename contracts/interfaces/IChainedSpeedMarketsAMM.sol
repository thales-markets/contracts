// SPDX-License-Identifier: MIT

pragma solidity >=0.5.16;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

import "../SpeedMarkets/SpeedMarket.sol";
import "../SpeedMarkets/ChainedSpeedMarketsAMM.sol";

interface IChainedSpeedMarketsAMM {
    function sUSD() external view returns (IERC20Upgradeable);

    function createNewMarket(ChainedSpeedMarketsAMM.CreateMarketParams calldata _params)
        external
        returns (address marketAddress);

    function minChainedMarkets() external view returns (uint);

    function maxChainedMarkets() external view returns (uint);

    function minTimeFrame() external view returns (uint64);

    function maxTimeFrame() external view returns (uint64);

    function minBuyinAmount() external view returns (uint);

    function maxBuyinAmount() external view returns (uint);

    function maxProfitPerIndividualMarket() external view returns (uint);

    function payoutMultipliers(uint _index) external view returns (uint);

    function maxRisk() external view returns (uint);

    function currentRisk() external view returns (uint);

    function getLengths(address _user) external view returns (uint[4] memory);

    function multicollateralEnabled() external view returns (bool);

    function canResolveMarket(address market) external view returns (bool);

    function resolveMarketWithPrices(
        address _market,
        int64[] calldata _finalPrices,
        bool _manualResolution
    ) external;

    function offrampHelper(address user, uint amount) external;
}

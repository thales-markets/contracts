// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ISportsAMM.sol";
import "../interfaces/IPosition.sol";

interface ISportsAMMSeller {
    function availableToSellToAMM(address market, ISportsAMM.Position position) external view returns (uint _available);

    function sellToAmmQuote(
        address market,
        ISportsAMM.Position position,
        uint amount
    ) external view returns (uint _quote);

    function sellPriceImpact(
        address market,
        ISportsAMM.Position position,
        uint amount
    ) external view returns (uint _impact);

    function sellToAMMRequirements(ISportsAMM.SellRequirements memory requirements) external view returns (uint, IPosition);
}

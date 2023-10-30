// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// external
import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@openzeppelin/contracts-4.4.1/security/Pausable.sol";
import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";

/// @title Wrapper contract which calls CL sports data (Link to docs: https://market.link/nodes/TheRundown/integrations)
/// @author gruja
contract MockTherundownConsumerWrapper is ChainlinkClient, Ownable, Pausable {
    using Chainlink for Chainlink.Request;
    using SafeERC20 for IERC20;

    /* ========== CONSTRUCTOR ========== */

    constructor() {}

    /// @notice request for odds in games on a specific date with specific sport with filters
    /// @param _marketAddress market address which triggered
    function callUpdateOddsForSpecificGame(address _marketAddress) external whenNotPaused {}

    /// @notice Request odds update for specific player props when triggered by a market address
    /// @param _marketAddress Market address that triggered the update
    function callUpdateOddsForSpecificPlayerProps(address _marketAddress) external whenNotPaused {}
}

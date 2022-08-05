// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "../../interfaces/IParlayMarketsAMM.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract ParlayMarketData is Initializable, ProxyOwned, ProxyPausable {

    struct ParlayTicketDetails {
        uint amount;
        uint sUSDPaid;
    }

    mapping(address => mapping(uint => address[])) public ticketsGamePosition;
    mapping(address => ParlayTicketDetails) public ticketDetails;

    address public parlayMarketsAMM;

    function initialize(address _owner, address parlayMarketsAMM) external initializer {
        setOwner(_owner);
    }

    function addTicketForGamePosition(address _game, uint _position, address _ticket) external {
        require(msg.sender == parlayMarketsAMM, "Invalid sender");
        ticketsGamePosition[_game][_position].push(_ticket);
    }
    
    function setParlayMarketsAMM(address _parlayMarketsAMM) external onlyOwner {
        parlayMarketsAMM = _parlayMarketsAMM;
        emit SetParlayMarketsAMM(_parlayMarketsAMM);
    }

    event SetParlayMarketsAMM(address _parlayMarketsAMM);
}

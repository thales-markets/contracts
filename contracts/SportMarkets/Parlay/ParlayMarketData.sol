// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "../../interfaces/IParlayMarketsAMM.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../../utils/libraries/AddressSetLib.sol";

contract ParlayMarketData is Initializable, ProxyOwned, ProxyPausable {
    using AddressSetLib for AddressSetLib.AddressSet;
    AddressSetLib.AddressSet internal _knownMarkets;
    struct ParlayDetails {
        uint amount;
        uint sUSDPaid;
    }

    mapping(address => mapping(uint => AddressSetLib.AddressSet)) internal _parlaysInGamePosition;
    mapping(address => ParlayDetails) public parlayDetails;

    address public parlayMarketsAMM;

    function initialize(address _owner, address _parlayMarketsAMM) external initializer {
        setOwner(_owner);
        parlayMarketsAMM = _parlayMarketsAMM;
    }

    function addParlayForGamePosition(address _game, uint _position, address _parlayMarket) external onlyParlayAMM {
        require(msg.sender == parlayMarketsAMM, "Invalid sender");
        _parlaysInGamePosition[_game][_position].add(_parlayMarket);
    }
    function removeParlayForGamePosition(address _game, uint _position, address _parlayMarket) external onlyParlayAMM{
        require(msg.sender == parlayMarketsAMM, "Invalid sender");
        _parlaysInGamePosition[_game][_position].remove(_parlayMarket);
    }

    function hasParlayGamePosition(address _parlay, address _game, uint _position) external view returns(bool containsParlay) {
        containsParlay = _parlaysInGamePosition[_game][_position].contains(_parlay);
    }
    
    function setParlayMarketsAMM(address _parlayMarketsAMM) external onlyOwner {
        parlayMarketsAMM = _parlayMarketsAMM;
        emit SetParlayMarketsAMM(_parlayMarketsAMM);
    }

    modifier onlyParlayAMM() {
        _onlyParlayAMM();
        _;
    }

    function _onlyParlayAMM() internal view {
        require(msg.sender == parlayMarketsAMM, "Not ParlayAMM");
    }



    event SetParlayMarketsAMM(address _parlayMarketsAMM);
}

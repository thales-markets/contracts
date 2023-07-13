// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "../../interfaces/IParlayMarketsAMM.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

contract ParlayPolicy is Initializable, ProxyOwned, ProxyPausable {
    address public parlayMarketsAMM;

    mapping(uint => uint) public restrictedMarketsCount;
    mapping(uint => bool) public isRestrictedToBeCombined;
    mapping(uint => mapping(uint => bool)) public restrictedTagCombination;

    function initialize(address _owner, address _parlayMarketsAMM) external initializer {
        setOwner(_owner);
        parlayMarketsAMM = _parlayMarketsAMM;
    }

    function setRestrictedMarketsCountPerTag(uint tag, uint count) external onlyOwner {
        if (tag > 0) {
            restrictedMarketsCount[tag] = count;
        }
    }

    function setRestrictedTagToBeCombined(uint tag, bool restricted) external onlyOwner {
        if (tag > 0) {
            isRestrictedToBeCombined[tag] = restricted;
        }
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

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
    mapping(bytes32 => mapping(uint => uint)) public restrictedTagComboCount;
    mapping(uint => mapping(uint => bool)) public restrictedTag1Combo;

    function initialize(address _owner, address _parlayMarketsAMM) external initializer {
        setOwner(_owner);
        parlayMarketsAMM = _parlayMarketsAMM;
    }

    function isTags1ComboRestricted(uint tag1, uint tag2) external view returns (bool isRestricted) {
        isRestricted = restrictedTag1Combo[tag1][tag2];
    }

    function isRestrictedComboEligible(
        uint tag1,
        uint tag2,
        uint tag1Count,
        uint tag2Count
    ) external view returns (bool eligible) {
        bytes32 tagHash = keccak256(abi.encode(tag1, tag2));
        eligible = true;
        uint restrictTag1 = restrictedTagComboCount[tagHash][tag1];
        uint restrictTag2 = restrictedTagComboCount[tagHash][tag2];
        if (restrictTag1 > 0 && restrictTag1 < tag1Count) {
            eligible = false;
        } else if (restrictTag2 > 0 && restrictTag2 < tag2Count) {
            eligible = false;
        }
    }

    function setRestrictedTagCombos(
        uint tag1,
        uint tag2,
        uint tag1Count,
        uint tag2Count
    ) external onlyOwner {
        if (tag1Count > 0 && tag2Count > 0) {
            bytes32 tagHash = keccak256(abi.encode(tag1, tag2));
            restrictedTagCombination[tag1][tag2] = true;
            restrictedTagComboCount[tagHash][tag1] = tag1Count;
            restrictedTagComboCount[tagHash][tag2] = tag2Count;
            tagHash = keccak256(abi.encode(tag2, tag1));
            restrictedTagCombination[tag2][tag1] = true;
            restrictedTagComboCount[tagHash][tag1] = tag1Count;
            restrictedTagComboCount[tagHash][tag2] = tag2Count;
        }
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

    function setRestrictedTag1Combo(
        uint _tag1,
        uint _tag2,
        bool _restricted
    ) external onlyOwner {
        restrictedTag1Combo[_tag1][_tag2] = _restricted;
        restrictedTag1Combo[_tag2][_tag1] = _restricted;
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

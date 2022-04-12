pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";

contract ExoticPositionalTags is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    using SafeMathUpgradeable for uint;

    mapping(bytes32 => uint) public tagNumber;
    mapping(uint => string) public tagLabel;
    mapping(uint => uint) public tagNumberIndex;
    mapping(uint => uint) public tagIndexNumber;
    uint public tagsCount;

    function initialize(address _owner) public initializer {
        setOwner(_owner);
        initNonReentrant();
    }

    function isValidTagNumber(uint _number) public view returns (bool) {
        return _number > 0 && tagNumberIndex[_number] > 0;
    }

    function isValidTagLabel(string memory _label) public view returns (bool) {
        return
            keccak256(abi.encode(_label)) != keccak256(abi.encode("")) &&
            tagNumberIndex[tagNumber[keccak256(abi.encode(_label))]] > 0;
    }

    function isValidTag(string memory _label, uint _number) external view returns (bool) {
        return isValidTagNumber(_number) && isValidTagLabel(_label);
    }

    function getTagLabel(uint _number) external view returns (string memory) {
        return tagLabel[_number];
    }

    function getTagNumber(string memory _label) external view returns (uint) {
        return tagNumber[keccak256(abi.encode(_label))];
    }

    function getTagNumberIndex(uint _number) external view returns (uint) {
        return tagNumberIndex[_number];
    }

    function getTagIndexNumber(uint _index) external view returns (uint) {
        return tagIndexNumber[_index];
    }

    function getTagByIndex(uint _index) external view returns (string memory, uint) {
        return (tagLabel[tagIndexNumber[_index]], tagIndexNumber[_index]);
    }

    function getAllTags() external view returns (string[] memory, uint[] memory) {
        uint[] memory tagsNumber = new uint[](tagsCount);
        string[] memory tagsLabel = new string[](tagsCount);
        for (uint i = 1; i <= tagsCount; i++) {
            tagsNumber[i - 1] = tagIndexNumber[i];
            tagsLabel[i - 1] = tagLabel[tagIndexNumber[i]];
        }
        return (tagsLabel, tagsNumber);
    }

    function getAllTagsNumbers() external view returns (uint[] memory) {
        uint[] memory tagsNumber = new uint[](tagsCount);
        for (uint i = 1; i <= tagsCount; i++) {
            tagsNumber[i - 1] = tagIndexNumber[i];
        }
        return tagsNumber;
    }

    function getAllTagsLabels() external view returns (string[] memory) {
        string[] memory tagsLabel = new string[](tagsCount);
        for (uint i = 1; i <= tagsCount; i++) {
            tagsLabel[i - 1] = tagLabel[tagIndexNumber[i]];
        }
        return tagsLabel;
    }

    function getTagsCount() external view returns (uint) {
        return tagsCount;
    }

    function addTag(string memory _label, uint _number) external onlyOwner {
        require(_number > 0, "Number must not be zero");
        require(tagNumberIndex[_number] == 0, "Tag already exists");
        require(keccak256(abi.encode(_label)) != keccak256(abi.encode("")), "Invalid label (empty string)");
        require(bytes(_label).length < 50, "Tag label exceeds length");

        tagsCount = tagsCount.add(1);
        tagNumberIndex[_number] = tagsCount;
        tagIndexNumber[tagsCount] = _number;
        tagNumber[keccak256(abi.encode(_label))] = _number;
        tagLabel[_number] = _label;
        emit NewTagAdded(_label, _number);
    }

    function editTagNumber(string memory _label, uint _number) external onlyOwner {
        require(_number > 0, "Number must not be zero");
        require(keccak256(abi.encode(_label)) != keccak256(abi.encode("")), "Invalid label (empty string)");
        require(tagNumberIndex[_number] == 0, "New tag number already exists");
        require(tagNumberIndex[tagNumber[keccak256(abi.encode(_label))]] > 0, "Edited tag does not exist");
        if (tagNumber[keccak256(abi.encode(_label))] != _number) {
            uint old_number = tagNumber[keccak256(abi.encode(_label))];
            tagLabel[old_number] = "";
            tagNumberIndex[_number] = tagNumberIndex[old_number];
            tagIndexNumber[tagNumberIndex[_number]] = _number;
            tagNumberIndex[old_number] = 0;
            tagNumber[keccak256(abi.encode(_label))] = _number;
            tagLabel[_number] = _label;
            emit TagNumberChanged(_label, old_number, _number);
        }
    }

    function editTagLabel(string memory _label, uint _number) external onlyOwner {
        require(_number > 0, "Number must not be zero");
        require(keccak256(abi.encode(_label)) != keccak256(abi.encode("")), "Invalid label (empty string)");
        require(tagNumberIndex[_number] != 0, "Tag with number does not exists");
        if (keccak256(abi.encode(tagLabel[_number])) != keccak256(abi.encode(_label))) {
            string memory old_label = tagLabel[_number];
            tagNumber[keccak256(abi.encode(old_label))] = 0;
            tagNumber[keccak256(abi.encode(_label))] = _number;
            tagLabel[_number] = _label;
            emit TagLabelChanged(_number, old_label, _label);
        }
    }

    function removeTag(uint _number) external onlyOwner {
        require(_number > 0, "Number must not be zero");
        require(tagNumberIndex[_number] != 0, "Tag does not exists");
        if (tagNumberIndex[_number] > 0) {
            tagNumberIndex[tagIndexNumber[tagsCount]] = tagNumberIndex[_number];
            tagIndexNumber[tagNumberIndex[_number]] = tagIndexNumber[tagsCount];
            tagNumberIndex[_number] = 0;
            tagsCount = tagsCount.sub(1);
            emit TagRemoved(tagLabel[_number], _number);
            tagLabel[_number] = "";
        }
    }

    event NewTagAdded(string label, uint number);
    event TagNumberChanged(string label, uint old_number, uint number);
    event TagLabelChanged(uint number, string old_label, string label);
    event TagRemoved(string _label, uint _number);
}

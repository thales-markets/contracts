pragma solidity ^0.8.0;

interface IExoticPositionalTags {
    /* ========== VIEWS / VARIABLES ========== */
    function isValidTagNumber(uint _number) external view returns (bool);
    function isValidTagLabel(string memory _label) external view returns (bool);
    function isValidTag(string memory _label, uint _number) external view returns (bool);
    function getTagLabel(uint _number) external view returns (string memory);
    function getTagNumber(string memory _label) external view returns (uint);
    function getTagNumberIndex(uint _number) external view returns (uint);
    function getTagIndexNumber(uint _index) external view returns (uint);
    function getTagByIndex(uint _index) external view returns (string memory, uint);
    function getTagsCount() external view returns (uint);

    function addTag(string memory _label, uint _number) external;
    function editTagNumber(string memory _label, uint _number) external;
    function editTagLabel(string memory _label, uint _number) external;
    function removeTag(uint _number) external;
}
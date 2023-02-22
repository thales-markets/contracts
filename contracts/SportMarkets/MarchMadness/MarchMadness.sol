// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/utils/Counters.sol";
import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/security/Pausable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC721/extensions/ERC721URIStorage.sol";

contract MarchMadness is ERC721URIStorage, Pausable, Ownable {
    /* ========== LIBRARIES ========== */

    using Counters for Counters.Counter;

    /* ========== STATE VARIABLES ========== */

    Counters.Counter private _tokenIds;

    string public _name = "Overtime March Madness";
    string public _symbol = "OMM";

    uint public canNotMintOrUpdateAfter;

    uint[61] public results;

    mapping(address => bool) public addressAlreadyMinted;

    mapping(uint => uint[61]) public itemToBrackets;
    mapping(address => uint) public addressToTokenId;

    /* ========== CONSTRUCTOR ========== */

    constructor() ERC721(_name, _symbol) {}

    /* ========== OWC ========== */

    function mint(uint[61] memory _brackets) external whenNotPaused returns (uint newItemId) {
        require(addressAlreadyMinted[msg.sender] == false, "Address already minted");
        require(block.timestamp < canNotMintOrUpdateAfter, "Can not mint after settled date");

        _tokenIds.increment();

        newItemId = _tokenIds.current();

        _mint(msg.sender, newItemId);

        addressAlreadyMinted[msg.sender] = true;

        itemToBrackets[newItemId] = _brackets;
        addressToTokenId[msg.sender] = newItemId;

        emit Mint(msg.sender, newItemId, _brackets);
    }

    function updateBracketsForAlreadyMintedItem(uint _tokenId, uint[61] memory _brackets) external whenNotPaused {
        require(_exists(_tokenId), "Item does not exists");
        require(ownerOf(_tokenId) == msg.sender, "Caller is not owner of entered tokenId");
        itemToBrackets[_tokenId] = _brackets;
        emit UpdateBracketsForAlreadyMintedItem(msg.sender, _tokenId, _brackets);
    }

    /* ========== VIEW ========== */

    function getCorrectPositionsByTokenId(uint _tokenId) public view returns (uint) {
        uint[61] memory _brackets = itemToBrackets[_tokenId];
        if (_brackets[1] == 0) return 0;

        uint correctPredictions = 0;

        for (uint i = 0; i < _brackets.length; i++) {
            if (_brackets[i] == results[i]) {
                correctPredictions++;
            }
        }

        return correctPredictions;
    }

    function getCorrectPositionsByMinterAddress(address _minter) public view returns (uint) {
        if (addressToTokenId[_minter] == 0) return 0;
        return getCorrectPositionsByTokenId(addressToTokenId[_minter]);
    }

    /* ========== INTERNALS ========== */

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override {
        require(from == address(0) || to == address(0), "NonTransferrableERC721Token: non transferrable");
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function setResultForGame(uint _game, uint _teamIndex) external onlyOwner {
        require(_teamIndex < 69, "Not valid team index");
        require(_game < 61, "Not valid game index");
        results[_game] = _teamIndex;
        emit ResultForGameAdded(_game, _teamIndex);
    }

    function setFinalDateForPositioning(uint _toDate) external onlyOwner {
        canNotMintOrUpdateAfter = _toDate;
        emit FinalPositioningDateUpdated(_toDate);
    }

    /* ========== EVENTS ========== */

    event Mint(address _recipient, uint _id, uint[61] _brackets);
    event UpdateBracketsForAlreadyMintedItem(address _minter, uint itemIndex, uint[61] _newBrackets);
    event ResultForGameAdded(uint _gameIndex, uint _teamWinnerIndex);
    event FinalPositioningDateUpdated(uint _toDate);
}

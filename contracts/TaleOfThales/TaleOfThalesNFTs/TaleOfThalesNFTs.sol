// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/security/Pausable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts-4.4.1/utils/Counters.sol";

import "../../interfaces/IStakingThales.sol";

contract TaleOfThalesNFTs is ERC1155, Ownable, Pausable, ERC1155Burnable {
    /* ========== LIBRARIES ========== */

    using Counters for Counters.Counter;

    /* ========== STATE VARIABLES ========== */
    Counters.Counter private _lastCollectionId;
    Counters.Counter private _lastItemId;

    enum Type {
        headWear,
        topWear,
        footWear,
        weapon
    }

    struct Item {
        uint256 index;
        Type itemType;
    }

    string public name = "Tale of Thales";

    string public symbol = "TOT";

    mapping(uint256 => Item[]) public collectionToItems;
    mapping(uint256 => uint256) public itemIndexToCollection;
    mapping(uint256 => mapping(address => bool)) public addressCanMintCollection;
    mapping(uint256 => mapping(uint8 => uint256)) public collectionToTypeMapping;

    mapping(address => mapping(uint256 => bool)) public addressAlreadyMintedItem;

    IStakingThales public staking;
    mapping(uint256 => uint256) public collectionToMinimumStakeAmount;
    mapping(uint256 => uint256) public collectionToMinimalVolume;

    /* ========== CONSTRUCTOR ========== */

    constructor(address _stakingAddress, string memory newuri) ERC1155(newuri) {
        require(_stakingAddress != address(0), "Invalid address");
        staking = IStakingThales(_stakingAddress);
    }

    /* ========== VIEW ========== */

    function getLatestItemIndex() public view returns (uint256) {
        return _lastItemId.current();
    }

    function getLatestCollectionIndex() public view returns (uint256) {
        return _lastCollectionId.current();
    }

    function isEligibleToMintItem(uint256 _itemIndex, address _minter) public view returns (bool) {
        if (itemIndexToCollection[_itemIndex] == 0) return false;
        if (addressAlreadyMintedItem[_minter][_itemIndex] == true) return false;
        if (balanceOf(_minter, _itemIndex) > 0) return false;

        uint256 _collectionIndex = getCollectionIndexFromItemIndex(_itemIndex);

        return isEligibleToMintCollection(_collectionIndex, _minter);
    }

    function isEligibleToMintCollection(uint256 _collectionIndex, address _minter) public view returns (bool eligible) {
        if (_checkStakingConditionForAddress(_minter, 0, _collectionIndex)) {
            eligible = true;
        } else if (_checkVolumeConditionForAddress(_minter, 0, _collectionIndex)) {
            eligible = true;
        } else {
            if (addressCanMintCollection[_collectionIndex][_minter]) eligible = true;
        }
        return eligible;
    }

    /* ========== OWC ========== */

    function mintItem(uint256 _itemId) external whenNotPaused {
        require(isEligibleToMintItem(_itemId, msg.sender), "Address is not eligible to mint this item");
        _mint(msg.sender, _itemId, 1, "");
        addressAlreadyMintedItem[msg.sender][_itemId] = true;
        emit ItemMinted(_itemId, msg.sender);
    }

    function mintCollection(uint256 _collectionIndex) external whenNotPaused {
        require(isEligibleToMintCollection(_collectionIndex, msg.sender), "Address is not eligible to mint this collection");

        Item[] memory items = collectionToItems[_collectionIndex];
        require(items.length > 0, "There are no items in this collection");

        uint256[] memory itemsToMint = new uint256[](4);
        uint256[] memory amountToMint = new uint256[](4);

        bool anythingToMint = false;

        for (uint256 i = 0; i < items.length; i++) {
            if (balanceOf(msg.sender, collectionToItems[_collectionIndex][i].index) > 0) continue;
            if (addressAlreadyMintedItem[msg.sender][collectionToItems[_collectionIndex][i].index] == true) continue;
            addressAlreadyMintedItem[msg.sender][collectionToItems[_collectionIndex][i].index] = true;
            anythingToMint = true;
            itemsToMint[i] = collectionToItems[_collectionIndex][i].index;
            amountToMint[i] = 1;
        }

        require(anythingToMint, "There is nothing to mint.");

        _mintBatch(msg.sender, itemsToMint, amountToMint, "");
        emit CollectionMinted(itemsToMint, msg.sender);
    }

    function addNewCollection(
        bool _stakeCondition,
        bool _volumeCondition,
        uint256 _minimumStakeAmount,
        uint256 _minimumVolumeAmount,
        address[] calldata _whitelistedAddresses
    ) external onlyOwner whenNotPaused {
        _lastCollectionId.increment();
        if (_stakeCondition) {
            collectionToMinimumStakeAmount[_lastCollectionId.current()] = _minimumStakeAmount;
        } else if (_volumeCondition) {
            collectionToMinimalVolume[_lastCollectionId.current()] = _minimumVolumeAmount;
        } else {
            require(_whitelistedAddresses.length > 0, "Whitelist cannot be empty");
        }

        if (_whitelistedAddresses.length > 0) {
            for (uint256 i = 0; i < _whitelistedAddresses.length; i++) {
                addressCanMintCollection[_lastCollectionId.current()][_whitelistedAddresses[i]] = true;
            }
        }
    }

    function addItemToCollection(uint8 _itemType, uint256 _collectionIndex) external onlyOwner whenNotPaused {
        require(_collectionIndex <= _lastCollectionId.current(), "Collection with given index do not exist.");
        require(
            collectionToTypeMapping[_collectionIndex][_itemType] == 0,
            "This type of wear is already added to collection."
        );
        _lastItemId.increment();
        collectionToItems[_collectionIndex].push(Item(_lastItemId.current(), Type(_itemType)));
        itemIndexToCollection[_lastItemId.current()] = _collectionIndex;
        collectionToTypeMapping[_collectionIndex][_itemType] = _lastItemId.current();
        emit AddedNewItemToCollection(_lastItemId.current(), _collectionIndex, _itemType);
    }

    function updateWhitelistForCollection(
        uint256 _collectionId,
        address[] calldata _whitelistedAddresses,
        bool _flag
    ) public onlyOwner whenNotPaused {
        require(_whitelistedAddresses.length > 0, "Whitelist cannot be empty");
        require(_collectionId <= _lastCollectionId.current(), "Collection with entered id does not exists");

        for (uint256 index = 0; index < _whitelistedAddresses.length; index++) {
            // only if current flag is different, if same skip it
            if (addressCanMintCollection[_collectionId][_whitelistedAddresses[index]] != _flag) {
                addressCanMintCollection[_collectionId][_whitelistedAddresses[index]] = _flag;
                emit WhitelistUpdated(_whitelistedAddresses[index], _collectionId);
            }
        }
    }

    function updateMintingCondition(
        uint256 _collectionIndex,
        uint256 _minVolumeAmount,
        uint256 _minStakingAmount
    ) external onlyOwner whenNotPaused {
        require(_minVolumeAmount > 0 || _minStakingAmount > 0, "One of the condition must be entered.");
        require(!(_minVolumeAmount > 0 && _minStakingAmount > 0), "Can not add both conditions");
        if (_minStakingAmount > 0) {
            collectionToMinimalVolume[_collectionIndex] = 0;
            collectionToMinimumStakeAmount[_collectionIndex] = _minStakingAmount;
        } else {
            collectionToMinimalVolume[_collectionIndex] = _minVolumeAmount;
            collectionToMinimumStakeAmount[_collectionIndex] = 0;
        }
        emit MintingConditionUpdated(_minVolumeAmount, _minStakingAmount);
    }

    function getCollectionIndexFromItemIndex(uint256 _itemIndex) public view returns (uint256) {
        require(itemIndexToCollection[_itemIndex] != 0, "Item is not added into collection or not created");
        return itemIndexToCollection[_itemIndex];
    }

    /* ========== INTERNAL ========== */

    function _checkStakingConditionForAddress(
        address _minter,
        uint256 _itemIndex,
        uint256 _collectionIndex
    ) internal view returns (bool) {
        uint256 _collectionId = _collectionIndex != 0 ? _collectionIndex : itemIndexToCollection[_itemIndex];
        return
            collectionToMinimumStakeAmount[_collectionId] != 0 &&
            (staking.stakedBalanceOf(_minter) > collectionToMinimumStakeAmount[_collectionId] ||
                addressCanMintCollection[_collectionId][_minter]);
    }

    function _checkVolumeConditionForAddress(
        address _minter,
        uint256 _itemIndex,
        uint256 _collectionIndex
    ) internal view returns (bool) {
        uint256 _collectionId = _collectionIndex != 0 ? _collectionIndex : itemIndexToCollection[_itemIndex];
        return
            collectionToMinimalVolume[_collectionId] != 0 &&
            (staking.getAMMVolume(_minter) > collectionToMinimalVolume[_collectionId] ||
                addressCanMintCollection[_collectionId][_minter]);
    }

    /* ========== CONTRACT MANAGMENT ========== */

    function setURI(string memory newuri) public onlyOwner whenNotPaused {
        _setURI(newuri);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    event AddedNewItemToCollection(uint256 _itemIndex, uint256 _collectionIndex, uint8 _itemType);
    event ItemMinted(uint256 _itemIndex, address _minter);
    event CollectionMinted(uint256[] _items, address _minter);
    event WhitelistUpdated(address whitelisted, uint256 _collectionIndex);
    event MintingConditionUpdated(uint256 _minVolumeAmount, uint256 _minStakingAmount);
}

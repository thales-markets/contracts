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
        require(itemIndexToCollection[_itemIndex] != 0, "Item is not in any collection");
        require(addressAlreadyMintedItem[_minter][_itemIndex] == false, "Item is already minted by this address.");
        if (balanceOf(_minter, _itemIndex) > 0) return false;

        uint256 _collectionIndex = getCollectionIndexFromItemIndex(_itemIndex);

        if (_checkIsStakingAmountConditionForMinting(_itemIndex)) {
            if (!(staking.stakedBalanceOf(_minter) >= collectionToMinimumStakeAmount[_collectionIndex])) return false;
        } else if (_checkIsVolumeAmountConditionForMinting(_itemIndex)) {
            if (!(staking.getAMMVolume(_minter) >= collectionToMinimalVolume[_collectionIndex])) return false;
        } else {
            if (!addressCanMintCollection[_collectionIndex][_minter]) return false;
        }
        return true;
    }

    function isEligibleToMintCollection(uint256 _collectionIndex, address _minter) public view returns (bool) {
        Item[] memory items = collectionToItems[_collectionIndex];
        require(items.length > 0, "There are no items in this collection");
        if (collectionToMinimumStakeAmount[_collectionIndex] > 0) {
            if (!(staking.stakedBalanceOf(_minter) >= collectionToMinimumStakeAmount[_collectionIndex])) return false;
        } else if (collectionToMinimalVolume[_collectionIndex] > 0) {
            if (!(staking.getAMMVolume(_minter) >= collectionToMinimalVolume[_collectionIndex])) return false;
        } else {
            if (!addressCanMintCollection[_collectionIndex][_minter]) return false;
        }
        return true;
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

        for (uint256 i = 0; i < items.length; i++) {
            if (balanceOf(msg.sender, collectionToItems[_collectionIndex][i].index) > 0) continue;
            if (addressAlreadyMintedItem[msg.sender][collectionToItems[_collectionIndex][i].index] == true) continue;
            addressAlreadyMintedItem[msg.sender][collectionToItems[_collectionIndex][i].index] = true;
            itemsToMint[i] = collectionToItems[_collectionIndex][i].index;
            amountToMint[i] = 1;
        }
        _mintBatch(msg.sender, itemsToMint, amountToMint, "");
        emit CollectionMinted(itemsToMint, msg.sender);
    }

    function addNewCollection(
        bool _stakeCondition,
        bool _volumeCondition,
        uint256 _minimumStakeAmount,
        uint256 _minimumVolumeAmount,
        address[] calldata _whitelistedAddresses
    ) external onlyOwner whenNotPaused returns (uint256) {
        _lastCollectionId.increment();
        if (_stakeCondition == true) {
            collectionToMinimumStakeAmount[_lastCollectionId.current()] = _minimumStakeAmount;
        } else if (_volumeCondition == true) {
            collectionToMinimalVolume[_lastCollectionId.current()] = _minimumVolumeAmount;
        } else {
            require(_whitelistedAddresses.length > 0, "Whitelist cannot be empty");
            for (uint256 i = 0; i < _whitelistedAddresses.length; i++) {
                addressCanMintCollection[_lastCollectionId.current()][_whitelistedAddresses[i]] = true;
            }
        }
        return _lastCollectionId.current();
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
        require(collectionToMinimumStakeAmount[_collectionId] == 0, "Collection has minimal staking as minting condition");
        require(collectionToMinimalVolume[_collectionId] == 0, "Collection has minimal volume as minting condition");

        for (uint256 index = 0; index < _whitelistedAddresses.length; index++) {
            // only if current flag is different, if same skip it
            if (addressCanMintCollection[_collectionId][_whitelistedAddresses[index]] != _flag) {
                addressCanMintCollection[_collectionId][_whitelistedAddresses[index]] = _flag;
                emit WhitelistUpdated(_whitelistedAddresses[index], _collectionId);
            }
        }
    }

    function getCollectionIndexFromItemIndex(uint256 _itemIndex) public view returns (uint256) {
        require(itemIndexToCollection[_itemIndex] != 0, "Item is not added into collection or not created");
        return itemIndexToCollection[_itemIndex];
    }

    /* ========== INTERNAL ========== */

    function _checkIsStakingAmountConditionForMinting(uint256 _itemIndex) internal view returns (bool) {
        return collectionToMinimumStakeAmount[itemIndexToCollection[_itemIndex]] != 0;
    }

    function _checkIsVolumeAmountConditionForMinting(uint256 _itemIndex) internal view returns (bool) {
        return collectionToMinimalVolume[itemIndexToCollection[_itemIndex]] != 0;
    }

    function _checkIsWhitelistConditionForMinting(uint256 _itemIndex) internal view returns (bool) {
        require(itemIndexToCollection[_itemIndex] != 0, "Item is not part of any colllection");
        return
            collectionToMinimalVolume[itemIndexToCollection[_itemIndex]] == 0 &&
            collectionToMinimumStakeAmount[itemIndexToCollection[_itemIndex]] == 0;
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
}

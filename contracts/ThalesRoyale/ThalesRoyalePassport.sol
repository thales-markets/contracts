// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

import "../interfaces/IThalesRoyale.sol";
import "../utils/libraries/NFTSVG.sol";
import "../utils/libraries/NFTDescriptor.sol";

contract ThalesRoyalePassport is
    ERC721EnumerableUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    ERC721BurnableUpgradeable,
    OwnableUpgradeable
{
    /* ========== LIBRARIES ========== */

    using CountersUpgradeable for CountersUpgradeable.Counter;

    /* ========== STATE VARIABLES ========== */

    CountersUpgradeable.Counter private _tokenIdCounter;

    IThalesRoyale public thalesRoyale;
    mapping(uint => uint) public tokenTimestamps;

    /* ========== CONSTRUCTOR ========== */

    function initialize(address _thalesRoyaleAddress) public initializer {
        __ERC721_init("Thales Royale Passport", "TRS");
        thalesRoyale = IThalesRoyale(_thalesRoyaleAddress);
    }

    function safeMint(address recipient) external whenNotPaused onlyRoyale returns (uint tokenId) {
        _tokenIdCounter.increment();

        tokenId = _tokenIdCounter.current();
        _safeMint(recipient, tokenId);

        tokenTimestamps[tokenId] = block.timestamp;

        emit ThalesRoyalePassportMinted(recipient, tokenId);
    }

    function burn(uint tokenId) public override canBeBurned(tokenId) {
        _burn(tokenId);

        emit ThalesRoyalePassportBurned(tokenId);
    }

    /* ========== VIEW ========== */
    function tokenURI(uint tokenId) public view override returns (string memory imageURI) {
        require(_exists(tokenId), "Passport doesn't exist");

        address player = ownerOf(tokenId);
        uint timestamp = tokenTimestamps[tokenId];

        uint season = thalesRoyale.tokenSeason(tokenId);
        uint currentRound = thalesRoyale.roundInASeason(season);
        bool alive = thalesRoyale.isTokenAliveInASpecificSeason(tokenId, season);
        uint[] memory positions = thalesRoyale.getTokenPositions(tokenId);
        bool seasonFinished = thalesRoyale.seasonFinished(season);

        imageURI = NFTDescriptor.constructTokenURI(
            NFTSVG.SVGParams(player, timestamp, tokenId, season, currentRound, positions, alive, seasonFinished)
        );
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    function pause() external onlyOwner {
        _pause();
        emit ThalesRoyalePassportPaused(true);
    }

    function unpause() external onlyOwner {
        _unpause();
        emit ThalesRoyalePassportPaused(false);
    }

    function setThalesRoyale(address _thalesRoyaleAddress) external onlyOwner {
        require(_thalesRoyaleAddress != address(0), "Invalid address");
        thalesRoyale = IThalesRoyale(_thalesRoyaleAddress);
        emit ThalesRoyaleAddressChanged(_thalesRoyaleAddress);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721EnumerableUpgradeable, ERC721Upgradeable) whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721EnumerableUpgradeable, ERC721Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /* ========== MODIFIERS ========== */

    modifier canBeBurned(uint tokenId) {
        require(_exists(tokenId), "Passport doesn't exist");
        require(_isApprovedOrOwner(msg.sender, tokenId), "Must be owner or approver");
        _;
    }

    modifier onlyRoyale() {
        require(msg.sender == address(thalesRoyale), "Invalid address");
        _;
    }

    /* ========== EVENTS ========== */

    event ThalesRoyalePassportMinted(address _recipient, uint _tokenId);
    event ThalesRoyalePassportBurned(uint _tokenId);
    event ThalesRoyaleAddressChanged(address _thalesRoyaleAddress);
    event ThalesRoyalePassportPaused(bool _state);
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/utils/Counters.sol";
import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC721/extensions/ERC721URIStorage.sol";

import "../../interfaces/IStakingThales.sol";

contract OvertimeWorldCupZebro is ERC721URIStorage, Ownable {
    /* ========== LIBRARIES ========== */

    using Counters for Counters.Counter;

    /* ========== STATE VARIABLES ========== */

    Counters.Counter private _tokenIds;

    // NFT Global
    string public _name = "Overtime World Cup Zebro";
    string public _symbol = "OWC";
    bool public paused = false;

    // NFT props.
    mapping(uint => bool) public allowedCountryNumber;
    mapping(uint => string) public countryNameByNumber;
    mapping(uint => string) public countryUrl;
    mapping(address => bool) public whitelistedAddressesForMinting;

    // user props.
    mapping(address => uint) public usersFavoriteTeamId;
    mapping(address => string) public usersFavoriteTeamName;
    mapping(address => string) public usersFavoriteTeamUrl;
    mapping(uint => address[]) public listOfUsersByCountry;

    IStakingThales public staking;
    uint public minimumStake;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        string[] memory _allowedCountries,
        string[] memory _countryURLs,
        address _staking,
        uint _minimumStake
    ) ERC721(_name, _symbol) {
        require(_countryURLs.length == _allowedCountries.length, "Provide same length in country array");
        // countries start from 1
        uint countryIndex = 1;
        // populate allowed countries
        for (uint i; i < _allowedCountries.length; i++) {
            allowedCountryNumber[countryIndex] = true;
            countryNameByNumber[countryIndex] = _allowedCountries[i];
            countryUrl[countryIndex] = _countryURLs[i];
            countryIndex++;
        }
        staking = IStakingThales(_staking);
        minimumStake = _minimumStake;
    }

    /* ========== OWC ========== */

    function mint(address _recipient, uint _country) external returns (uint newItemId) {
        require(!paused, "Cant mint while paused");
        require(_recipient == msg.sender, "Soulbound NFT can be only minted for his owner");
        require(allowedCountryNumber[_country], "Country not allowed");
        require(usersFavoriteTeamId[_recipient] == 0, "Recipient has picked the team already");
        require(isMinterEligibleToMint(_recipient), "User is not allowed to mint this NFT");

        _tokenIds.increment();

        newItemId = _tokenIds.current();

        _mint(_recipient, newItemId);

        _setTokenURI(newItemId, countryUrl[_country]);

        usersFavoriteTeamId[_recipient] = _country;
        usersFavoriteTeamName[_recipient] = countryNameByNumber[_country];
        usersFavoriteTeamUrl[_recipient] = countryUrl[_country];

        listOfUsersByCountry[_country].push(_recipient);

        emit Mint(_recipient, newItemId, _country, countryNameByNumber[_country], usersFavoriteTeamUrl[_recipient]);
    }

    function burn(uint _tokenId) external {
        require(ownerOf(_tokenId) == msg.sender, "Not owner");
        super._burn(_tokenId);
        emit Burn(_tokenId, msg.sender);
    }

    /* ========== VIEW ========== */

    function getFavoriteTeamForUser(address _user)
        external
        view
        returns (
            uint _id,
            string memory _name,
            string memory _url
        )
    {
        return (usersFavoriteTeamId[_user], usersFavoriteTeamName[_user], usersFavoriteTeamUrl[_user]);
    }

    function getListOfUsersPerTeam(uint _country) external view returns (address[] memory) {
        return listOfUsersByCountry[_country];
    }

    function isMinterEligibleToMint(address _minter) public view returns (bool) {
        return whitelistedAddressesForMinting[_minter] || staking.stakedBalanceOf(_minter) >= minimumStake;
    }

    /* ========== INTERNALS ========== */

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual {
        require(from == address(0) || to == address(0), "Can not transfer NFT, only mint and burn");
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    function setPause(bool _state) external onlyOwner {
        require(_state != paused, "Already in that state");
        paused = _state;
        emit Paused(_state);
    }

    function setAllowedCountryNumber(uint _country, bool _flag) external onlyOwner {
        require(allowedCountryNumber[_country] != _flag, "Already in that state");
        allowedCountryNumber[_country] = _flag;
        emit SetAllowedCountryNumber(_country, _flag);
    }

    function setCountryNameByNumber(uint _country, string memory _name) external onlyOwner {
        require(
            keccak256(abi.encodePacked(countryNameByNumber[_country])) != keccak256(abi.encodePacked(_name)),
            "Same as before"
        );
        countryNameByNumber[_country] = _name;
        emit SetCountryNameByNumber(_country, _name);
    }

    function setCountryURL(uint _country, string memory _url) external onlyOwner {
        require(keccak256(abi.encodePacked(countryUrl[_country])) != keccak256(abi.encodePacked(_url)), "Same as before");
        countryUrl[_country] = _url;
        emit SetCountryURLByNumber(_country, _url);
    }

    function setWhitelistedAddresses(address[] calldata _whitelistedAddresses, bool _flag) external onlyOwner {
        require(_whitelistedAddresses.length > 0, "Whitelisted addresses cannot be empty");
        for (uint256 index = 0; index < _whitelistedAddresses.length; index++) {
            // only if current flag is different, if same skip it
            if (whitelistedAddressesForMinting[_whitelistedAddresses[index]] != _flag) {
                whitelistedAddressesForMinting[_whitelistedAddresses[index]] = _flag;
                emit AddedIntoWhitelist(_whitelistedAddresses[index], _flag);
            }
        }
    }

    function setStakingAddress(address _staking) external onlyOwner {
        require(_staking != address(0), "Invalid address");
        staking = IStakingThales(_staking);
        emit NewStakingAddress(_staking);
    }

    function setMinimumStakeAmount(uint _minimumAmount) external onlyOwner {
        require(_minimumAmount > 0, "Can not be zero");
        minimumStake = _minimumAmount;
        emit NewMinimumStakeAmount(_minimumAmount);
    }

    /* ========== EVENTS ========== */

    event Paused(bool _state);
    event AddedIntoWhitelist(address _whitelistAddress, bool _flag);
    event Mint(address _recipient, uint _id, uint _country, string _countryName, string _url);
    event NewStakingAddress(address _staking);
    event SetAllowedCountryNumber(uint _country, bool _flag);
    event SetCountryNameByNumber(uint _country, string _name);
    event SetCountryURLByNumber(uint _country, string _url);
    event Burn(uint _tokenId, address _exHolder);
    event NewMinimumStakeAmount(uint _minimumAmount);
}

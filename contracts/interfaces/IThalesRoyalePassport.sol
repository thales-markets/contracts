// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
interface IThalesRoyalePassport {

    function ownerOf(uint256 tokenId) external view returns (address);

    function safeMint(address recipient) external returns (uint tokenId);

    function burn(uint tokenId) external;
    
    function tokenURI(uint256 tokenId) external view returns (string memory);

    function setPause(bool _state) external;

    function setThalesRoyale(address _thalesRoyaleAddress) external;

}
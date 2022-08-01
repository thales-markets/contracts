// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

interface IThalesRoyalePass is IERC721Upgradeable {
    function burn(uint256 tokenId) external;

    function burnWithTransfer(address player, uint256 tokenId) external;

    function pricePaidForVoucher(uint tokenId) external view returns (uint);
}

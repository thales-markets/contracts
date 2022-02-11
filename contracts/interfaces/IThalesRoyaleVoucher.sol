pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

interface IThalesRoyaleVoucher is IERC721Upgradeable {
    function burn(uint256 tokenId) external;
    function burnWithTransfer(uint256 tokenId) external;
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-4.4.1/utils/Counters.sol";
import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/IThalesRoyale.sol";

contract ThalesRoyalePass is ERC721URIStorage, Ownable {
    /* ========== LIBRARIES ========== */

    using Counters for Counters.Counter;
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    Counters.Counter private _tokenIds;

    string public _name = "Thales Royale Pass";
    string public _symbol = "TRP";
    bool public paused = false;
    string public tokenURI;

    IThalesRoyale public thalesRoyale;

    IERC20 public sUSD;
    mapping(uint => uint) public pricePerPass;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _sUSD,
        string memory _initURI,
        address _thalesRoyaleAddress
    ) ERC721(_name, _symbol) {
        sUSD = IERC20(_sUSD);
        tokenURI = _initURI;
        thalesRoyale = IThalesRoyale(_thalesRoyaleAddress);
    }

    /* ========== TRV ========== */

    function mint(address recipient) external returns (uint) {
        require(!paused);
        // check sUSD
        require(sUSD.balanceOf(msg.sender) >= thalesRoyale.getBuyInAmount(), "No enough sUSD");
        require(sUSD.allowance(msg.sender, address(this)) >= thalesRoyale.getBuyInAmount(), "No allowance");

        _tokenIds.increment();

        uint newItemId = _tokenIds.current();
        pricePerPass[newItemId] = thalesRoyale.getBuyInAmount();

        // pay for pass
        _payForPass(msg.sender, thalesRoyale.getBuyInAmount());

        _mint(recipient, newItemId);
        _setTokenURI(newItemId, tokenURI);

        return newItemId;
    }

    function burnWithTransfer(address player, uint tokenId) external {
        require(sUSD.balanceOf(address(this)) >= thalesRoyale.getBuyInAmount(), "Not enough sUSD");
        require(msg.sender == address(thalesRoyale), "Sender must be thales royale contract");
        require(thalesRoyale.getBuyInAmount() <= pricePerPass[tokenId], "Not enough sUSD allocated in the pass");

        if (thalesRoyale.getBuyInAmount() < pricePerPass[tokenId]) {

            uint diferenceInPrice = pricePerPass[tokenId].sub(thalesRoyale.getBuyInAmount());

            // send diference to player
            sUSD.safeTransfer(player, diferenceInPrice);

            // set new price per pass
            pricePerPass[tokenId] = thalesRoyale.getBuyInAmount();
        }

        // burn at the end and transfer to royale
        sUSD.safeTransfer(address(thalesRoyale), thalesRoyale.getBuyInAmount());
        super._burn(tokenId);
    }

    function topUp(uint tokenId, uint amount) external {
        require(sUSD.balanceOf(msg.sender) >= amount, "No enough sUSD");
        require(sUSD.allowance(msg.sender, address(this)) >= amount, "No allowance.");
        require(_exists(tokenId), "Not existing pass");
        sUSD.safeTransferFrom(msg.sender, address(this), amount);
        pricePerPass[tokenId] = pricePerPass[tokenId] + amount;
    }

    /* ========== VIEW ========== */

    function pricePaidForPass(uint tokenId) public view returns (uint) {
        return pricePerPass[tokenId];
    }

    /* ========== INTERNALS ========== */

    function _payForPass(address _sender, uint _amount) internal {
        sUSD.safeTransferFrom(_sender, address(this), _amount);
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    function setTokenUri(string memory _tokenURI) public onlyOwner {
        tokenURI = _tokenURI;
        emit NewTokenUri(_tokenURI);
    }

    function setPause(bool _state) public onlyOwner {
        paused = _state;
        emit ThalesRoyalePassPaused(_state);
    }

    function setThalesRoyaleAddress(address _thalesRoyaleAddress) public onlyOwner {
        thalesRoyale = IThalesRoyale(_thalesRoyaleAddress);
        emit NewThalesRoyaleAddress(_thalesRoyaleAddress);
    }

    /* ========== EVENTS ========== */

    event NewTokenUri(string _tokenURI);
    event NewThalesRoyaleAddress(address _thalesRoyaleAddress);
    event ThalesRoyalePassPaused(bool _state);
}

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-4.4.1/utils/Counters.sol";
import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";

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

    address public thalesRoyaleAddress;

    IERC20 public sUSD;
    uint public price;
    mapping(uint => uint) public pricePerPass;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _sUSD,
        uint _price,
        string memory _initURI,
        address _thalesRoyaleAddress
    ) ERC721(_name, _symbol) {
        sUSD = IERC20(_sUSD);
        price = _price;
        tokenURI = _initURI;
        thalesRoyaleAddress = _thalesRoyaleAddress;
    }

    /* ========== TRV ========== */

    function mint(address recipient) external returns (uint) {
        require(!paused);
        // check sUSD
        require(sUSD.balanceOf(msg.sender) >= price, "No enough sUSD");
        require(sUSD.allowance(msg.sender, address(this)) >= price, "No allowance");

        _tokenIds.increment();

        uint newItemId = _tokenIds.current();
        pricePerPass[newItemId] = price;

        // pay for pass
        _payForPass(msg.sender, price);

        _mint(recipient, newItemId);
        _setTokenURI(newItemId, tokenURI);

        return newItemId;
    }

    function burn(uint tokenId) external canBeBurned(tokenId) {
        super._burn(tokenId);
    }

    function burnWithTransfer(uint tokenId) external {
        require(sUSD.balanceOf(address(this)) >= pricePerPass[tokenId], "No enough sUSD");
        require(msg.sender == thalesRoyaleAddress, "Sender must be thales royale contract");
        sUSD.safeTransfer(thalesRoyaleAddress, pricePerPass[tokenId]);
        super._burn(tokenId);
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

    function setPriceForPass(uint _price) public onlyOwner {
        price = _price;
        emit NewPriceForPass(_price);
    }

    function setTokenUri(string memory _tokenURI) public onlyOwner {
        tokenURI = _tokenURI;
        emit NewTokenUri(_tokenURI);
    }

    function setPause(bool _state) public onlyOwner {
        paused = _state;
        emit ThalesRoyalePassPaused(_state);
    }

    function setThalesRoyaleAddress(address _thalesRoyaleAddress) public onlyOwner {
        thalesRoyaleAddress = _thalesRoyaleAddress;
        emit NewThalesRoyaleAddress(_thalesRoyaleAddress);
    }

    /* ========== MODIFIERS ========== */

    modifier canBeBurned(uint tokenId) {
        require(_exists(tokenId), "Not existing pass");
        require(_isApprovedOrOwner(msg.sender, tokenId), "Must be owner or approver");
        _;
    }

    /* ========== EVENTS ========== */

    event NewPriceForPass(uint _price);
    event NewTokenUri(string _tokenURI);
    event NewThalesRoyaleAddress(address _thalesRoyaleAddress);
    event ThalesRoyalePassPaused(bool _state);
}

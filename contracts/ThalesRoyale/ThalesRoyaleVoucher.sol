pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-4.4.1/utils/Counters.sol";
import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";

contract ThalesRoyaleVoucher is ERC721URIStorage, Ownable {
    /* ========== LIBRARIES ========== */

    using Counters for Counters.Counter;
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    Counters.Counter private _tokenIds;

    string public _name = "Thales Royale Voucher";
    string public _symbol = "TRV";
    bool public paused = false;
    string public tokenURI;

    address public thalesRoyaleAddress;

    IERC20 public sUSD;
    uint public price;
    mapping(uint => uint) public pricePerVoucher;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _sUSD,
        uint _price,
        string memory _initURI
    ) ERC721(_name, _symbol) {
        sUSD = IERC20(_sUSD);
        price = _price;
        tokenURI = _initURI;
    }

    /* ========== TRV ========== */

    function mint(address recipient) external returns (uint) {
        require(!paused);
        // check sUSD
        require(sUSD.balanceOf(msg.sender) >= price, "No enough sUSD");
        require(sUSD.allowance(msg.sender, address(this)) >= price, "No allowance");

        _tokenIds.increment();

        uint newItemId = _tokenIds.current();
        pricePerVoucher[newItemId] = price;

        // pay for voucher
        _payForVoucher(msg.sender, price);

        _mint(recipient, newItemId);
        _setTokenURI(newItemId, tokenURI);

        return newItemId;
    }

    function burn(uint tokenId) external canBeBurned(tokenId) {
        super._burn(tokenId);
    }

    function burnWithTransfer(uint tokenId) external canBeBurned(tokenId) {
        require(sUSD.balanceOf(address(this)) >= pricePerVoucher[tokenId], "No enough sUSD");
        sUSD.safeTransfer(thalesRoyaleAddress, pricePerVoucher[tokenId]);
        super._burn(tokenId);
    }

    /* ========== VIEW ========== */

    function pricePaidForVoucher(uint tokenId) public view returns (uint) {
        return pricePerVoucher[tokenId];
    }

    /* ========== INTERNALS ========== */

    function _payForVoucher(address _sender, uint _amount) internal {
        sUSD.safeTransferFrom(_sender, address(this), _amount);
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    function setPriceForVoucher(uint _price) public onlyOwner {
        price = _price;
        emit NewPriceForVoucher(_price);
    }

    function setTokenUri(string memory _tokenURI) public onlyOwner {
        tokenURI = _tokenURI;
        emit NewTokenUri(_tokenURI);
    }

    function setPause(bool _state) public onlyOwner {
        paused = _state;
        emit VoucherPaused(_state);
    }

    function setThalesRoyaleAddress(address _thalesRoyaleAddress) public onlyOwner {
        thalesRoyaleAddress = _thalesRoyaleAddress;
        emit NewThalesRoyaleAddress(_thalesRoyaleAddress);
    }

    /* ========== MODIFIERS ========== */

    modifier canBeBurned(uint tokenId) {
        require(_exists(tokenId), "Not existing voucher");
        require(_isApprovedOrOwner(msg.sender, tokenId), "Must be owner or approver");
        _;
    }

    /* ========== EVENTS ========== */

    event NewPriceForVoucher(uint _price);
    event NewTokenUri(string _tokenURI);
    event NewThalesRoyaleAddress(address _thalesRoyaleAddress);
    event VoucherPaused(bool _state);
}

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-4.4.1/utils/Counters.sol";
import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";

contract ThalesRoyaleVoucher is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    Counters.Counter private _tokenIds;

    string public _name = "ThalesRoyaleVoucher";
    string public _symbol = "TRV";
    bool public paused = false;
    string public tokenURI;

    address public thalesRoyaleAddress;

    IERC20 public sUSD;
    uint public price;

    constructor(
        address _sUSD,
        uint _price,
        string memory _initURI
    ) ERC721(_name, _symbol) {
        sUSD = IERC20(_sUSD);
        price = _price;
        tokenURI = _initURI;
    }

    function mint(address recipient) external returns (uint256) {
        require(!paused);
        // check sUSD
        require(sUSD.balanceOf(msg.sender) >= price, "No enough sUSD");
        require(sUSD.allowance(msg.sender, address(this)) >= price, "No allowance");

        _tokenIds.increment();

        uint256 newItemId = _tokenIds.current();

        // pay for voucher
        _payForVoucher(msg.sender, price);

        _mint(recipient, newItemId);
        _setTokenURI(newItemId, tokenURI);

        return newItemId;
    }

    function burn(uint256 tokenId) external canBeBurned(tokenId) {
        super._burn(tokenId);
    }

    function burnWithTransfer(uint256 tokenId) external canBeBurned(tokenId) {
        require(sUSD.balanceOf(address(this)) >= price, "No enough sUSD");
        sUSD.safeTransfer(thalesRoyaleAddress, price);
        super._burn(tokenId);
    }

    function _payForVoucher(address _sender, uint _amount) internal {
        sUSD.safeTransferFrom(_sender, address(this), _amount);
    }

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

    modifier canBeBurned(uint256 tokenId) {
        require(_exists(tokenId), "Not existing voucher");
        require(_isApprovedOrOwner(msg.sender, tokenId), "Must be owner or approver");
        _;
    }

    event NewPriceForVoucher(uint _price);
    event NewTokenUri(string _tokenURI);
    event NewThalesRoyaleAddress(address _thalesRoyaleAddress);
    event VoucherPaused(bool _state);
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-4.4.1/utils/Counters.sol";
import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";

import "../../interfaces/ISportsAMM.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/IPosition.sol";

contract OvertimeVoucher is ERC721URIStorage, Ownable {
    /* ========== LIBRARIES ========== */

    using Counters for Counters.Counter;
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    Counters.Counter private _tokenIds;

    string public _name = "Overtime Voucher";
    string public _symbol = "OVER";
    bool public paused = false;
    string public tokenURITwenty;
    string public tokenURIFifty;
    string public tokenURIHundred;
    string public tokenURITwoHundred;

    ISportsAMM public sportsAMM;

    IERC20 public sUSD;
    mapping(uint => uint) public amountInVoucher;

    /* ========== CONSTANTS ========== */
    uint private constant ONE = 1e18;
    uint private constant TWENTY = 20 * 1e18;
    uint private constant FIFTY = 50 * 1e18;
    uint private constant HUNDRED = 100 * 1e18;
    uint private constant TWO_HUNDRED = 200 * 1e18;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _sUSD,
        string memory _tokenURITwenty,
        string memory _tokenURIFifty,
        string memory _tokenURIHundred,
        string memory _tokenURITwoHundred,
        address _sportsamm
    ) ERC721(_name, _symbol) {
        sUSD = IERC20(_sUSD);
        tokenURITwenty = _tokenURITwenty;
        tokenURIFifty = _tokenURIFifty;
        tokenURIHundred = _tokenURIHundred;
        tokenURITwoHundred = _tokenURITwoHundred;
        sportsAMM = ISportsAMM(_sportsamm);
        sUSD.approve(_sportsamm, type(uint256).max);
    }

    /* ========== TRV ========== */

    function mint(address recipient, uint amount) external returns (uint newItemId) {
        require(!paused, "Cant mint while paused");

        require(amount == TWENTY || amount == FIFTY || amount == HUNDRED || amount == TWO_HUNDRED, "Invalid amount");

        sUSD.safeTransferFrom(msg.sender, address(this), amount);

        _tokenIds.increment();

        newItemId = _tokenIds.current();

        _mint(recipient, newItemId);

        _setTokenURI(
            newItemId,
            amount == TWENTY ? tokenURITwenty : amount == FIFTY ? tokenURIFifty : amount == HUNDRED
                ? tokenURIHundred
                : tokenURITwoHundred
        );

        amountInVoucher[newItemId] = amount;
    }

    function buyFromAMMWithVoucher(
        address market,
        ISportsAMM.Position position,
        uint amount,
        uint tokenId
    ) external {
        require(!paused, "Cant buy while paused");
        require(ERC721.ownerOf(tokenId) == msg.sender, "You are not the voucher owner!");

        uint quote = sportsAMM.buyFromAmmQuote(market, position, amount);
        require(quote < amountInVoucher[tokenId], "Insufficient amount in voucher");

        uint balanceBefore = sUSD.balanceOf(address(this));
        sportsAMM.buyFromAMM(market, position, amount, quote, 0);
        amountInVoucher[tokenId] = amountInVoucher[tokenId] - quote;

        (IPosition home, IPosition away, IPosition draw) = ISportPositionalMarket(market).getOptions();
        IPosition target = position == ISportsAMM.Position.Home ? home : position == ISportsAMM.Position.Away ? away : draw;

        IERC20(address(target)).safeTransfer(msg.sender, amount);
    }

    /* ========== VIEW ========== */

    /* ========== INTERNALS ========== */

    /* ========== CONTRACT MANAGEMENT ========== */

    /// @notice Retrieve sUSD from the contract
    /// @param account whom to send the sUSD
    /// @param amount how much sUSD to retrieve
    function retrieveSUSDAmount(address payable account, uint amount) external onlyOwner {
        sUSD.safeTransfer(account, amount);
    }

    function setTokenUris(
        string memory _tokenURITwenty,
        string memory _tokenURIFifty,
        string memory _tokenURIHundred,
        string memory _tokenURITwoHundred
    ) public onlyOwner {
        tokenURITwenty = _tokenURITwenty;
        tokenURIFifty = _tokenURIFifty;
        tokenURIHundred = _tokenURIHundred;
        tokenURITwoHundred = _tokenURITwoHundred;
    }

    function setPause(bool _state) public onlyOwner {
        paused = _state;
        emit Paused(_state);
    }

    function setSportsAMM(address _sportsAMM) public onlyOwner {
        if (address(_sportsAMM) != address(0)) {
            sUSD.approve(address(sportsAMM), 0);
        }
        sportsAMM = ISportsAMM(_sportsAMM);
        sUSD.approve(_sportsAMM, type(uint256).max);
        emit NewSportsAMM(_sportsAMM);
    }

    /* ========== EVENTS ========== */

    event NewTokenUri(string _tokenURI);
    event NewSportsAMM(address _thalesRoyaleAddress);
    event Paused(bool _state);
}

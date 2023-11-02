// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../OwnedWithInit.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";

// Internal references
import "../../interfaces/IParlayMarketsAMM.sol";
import "../SportPositions/SportPosition.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/ISportPositionalMarketManager.sol";

contract ParlayMarket is OwnedWithInit {
    using SafeERC20 for IERC20;

    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant TWELVE_DECIMAL = 1e6;

    enum Phase {
        Trading,
        Maturity,
        Expiry
    }

    struct SportMarkets {
        address sportAddress;
        uint position;
        uint odd;
        uint result;
        bool resolved;
        bool exercised;
        bool hasWon;
        bool isCancelled;
    }

    IParlayMarketsAMM public parlayMarketsAMM;
    address public parlayOwner;

    uint public expiry;
    uint public amount;
    uint public sUSDPaid;
    uint public totalResultQuote;
    uint public numOfSportMarkets;

    bool public resolved;
    bool public paused;
    bool public parlayAlreadyLost;
    bool public initialized;

    mapping(uint => SportMarkets) public sportMarket;
    mapping(address => uint) private _sportMarketIndex;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address[] calldata _sportMarkets,
        uint[] calldata _positionPerMarket,
        uint _amount,
        uint _sUSDPaid,
        uint _expiryDuration,
        address _parlayMarketsAMM,
        address _parlayOwner,
        uint _totalQuote,
        uint[] calldata _marketQuotes
    ) external {
        require(!initialized, "Parlay Market already initialized");
        initialized = true;
        initOwner(msg.sender);
        parlayMarketsAMM = IParlayMarketsAMM(_parlayMarketsAMM);
        require(_sportMarkets.length == _positionPerMarket.length, "Lengths not matching");
        numOfSportMarkets = _sportMarkets.length;
        for (uint i = 0; i < numOfSportMarkets; i++) {
            sportMarket[i].sportAddress = _sportMarkets[i];
            sportMarket[i].position = _positionPerMarket[i];
            sportMarket[i].odd = _marketQuotes[i];
            _sportMarketIndex[_sportMarkets[i]] = i + 1;
        }
        amount = _amount;
        expiry = _expiryDuration;
        sUSDPaid = _sUSDPaid;
        parlayOwner = _parlayOwner;
        totalResultQuote = _totalQuote;
    }

    //===================== VIEWS ===========================

    function isParlayLost() public view returns (bool) {
        bool marketWinning;
        bool marketResolved;
        bool hasPendingWinningMarkets;
        for (uint i = 0; i < numOfSportMarkets; i++) {
            (marketWinning, marketResolved) = _isWinningPosition(sportMarket[i].sportAddress, sportMarket[i].position);
            if (marketResolved && !marketWinning) {
                return true;
            }
        }
        return false;
    }

    function areAllPositionsResolved() public view returns (bool) {
        for (uint i = 0; i < numOfSportMarkets; i++) {
            if (!ISportPositionalMarket(sportMarket[i].sportAddress).resolved()) {
                return false;
            }
        }
        return true;
    }

    function isUserTheWinner() external view returns (bool hasUserWon) {
        if (areAllPositionsResolved()) {
            hasUserWon = !isParlayLost();
        }
    }

    function phase() public view returns (Phase) {
        if (resolved) {
            if (resolved && expiry < block.timestamp) {
                return Phase.Expiry;
            } else {
                return Phase.Maturity;
            }
        } else {
            return Phase.Trading;
        }
    }

    function isParlayExercisable() public view returns (bool isExercisable) {
        isExercisable = !resolved && (areAllPositionsResolved() || isParlayLost());
    }

    //============================== UPDATE PARAMETERS ===========================

    function setPaused(bool _paused) external onlyAMM {
        require(paused != _paused, "State not changed");
        paused = _paused;
        emit PauseUpdated(_paused);
    }

    //============================== EXERCISE ===================================

    function exerciseWiningSportMarkets() external onlyAMM {
        require(!paused, "Market paused");
        require(isParlayExercisable(), "Parlay not exercisable yet");
        require(areAllPositionsResolved() || isParlayLost(), "Parlay already exercised");
        uint totalSUSDamount = parlayMarketsAMM.sUSD().balanceOf(address(this));
        if (isParlayLost()) {
            if (totalSUSDamount > 0) {
                parlayMarketsAMM.sUSD().transfer(address(parlayMarketsAMM), totalSUSDamount);
            }
        } else {
            uint finalPayout = parlayMarketsAMM.sUSD().balanceOf(address(this));
            for (uint i = 0; i < numOfSportMarkets; i++) {
                address _sportMarket = sportMarket[i].sportAddress;
                ISportPositionalMarket currentSportMarket = ISportPositionalMarket(_sportMarket);
                uint result = uint(currentSportMarket.result());
                if (result == 0) {
                    finalPayout = (finalPayout * sportMarket[i].odd) / ONE;
                }
            }
            parlayMarketsAMM.sUSD().transfer(address(parlayOwner), finalPayout);
            parlayMarketsAMM.sUSD().transfer(address(parlayMarketsAMM), parlayMarketsAMM.sUSD().balanceOf(address(this)));
        }

        _resolve(!isParlayLost());
    }

    //============================== INTERNAL FUNCTIONS ===================================

    function _resolve(bool _userWon) internal {
        parlayAlreadyLost = !_userWon;
        resolved = true;
        parlayMarketsAMM.triggerResolvedEvent(parlayOwner, _userWon);
        emit Resolved(_userWon);
    }

    function _isWinningPosition(address _sportMarket, uint _userPosition)
        internal
        view
        returns (bool isWinning, bool isResolved)
    {
        ISportPositionalMarket currentSportMarket = ISportPositionalMarket(_sportMarket);
        isResolved = currentSportMarket.resolved();
        if (
            isResolved &&
            (uint(currentSportMarket.result()) == (_userPosition + 1) ||
                currentSportMarket.result() == ISportPositionalMarket.Side.Cancelled)
        ) {
            isWinning = true;
        }
    }

    //============================== ON EXPIRY FUNCTIONS ===================================

    function withdrawCollateral(address recipient) external onlyAMM {
        parlayMarketsAMM.sUSD().transfer(recipient, parlayMarketsAMM.sUSD().balanceOf(address(this)));
    }

    function expire(address payable beneficiary) external onlyAMM {
        require(phase() == Phase.Expiry, "Ticket Expired");
        emit Expired(beneficiary);
        _selfDestruct(beneficiary);
    }

    function _selfDestruct(address payable beneficiary) internal {
        uint balance = parlayMarketsAMM.sUSD().balanceOf(address(this));
        if (balance != 0) {
            parlayMarketsAMM.sUSD().transfer(beneficiary, balance);
        }

        // Destroy the option tokens before destroying the market itself.
        // selfdestruct(beneficiary);
    }

    modifier onlyAMM() {
        require(msg.sender == address(parlayMarketsAMM), "only the AMM may perform these methods");
        _;
    }

    event Resolved(bool isUserTheWinner);
    event Expired(address beneficiary);
    event PauseUpdated(bool _paused);
}

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
    uint public numOfResolvedSportMarkets;
    uint public numOfAlreadyExercisedSportMarkets;

    bool public resolved;
    bool public paused;
    bool public parlayAlreadyLost;
    bool public initialized;
    bool public fundsIssued;

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

    function isAnySportMarketExercisable() external view returns (bool isExercisable, address[] memory exercisableMarkets) {
        exercisableMarkets = new address[](numOfSportMarkets);
        bool exercisable;
        for (uint i = 0; i < numOfSportMarkets; i++) {
            if (!sportMarket[i].exercised) {
                (exercisable, ) = _isWinningSportMarket(sportMarket[i].sportAddress, sportMarket[i].position);
                if (exercisable) {
                    isExercisable = true;
                    exercisableMarkets[i] = sportMarket[i].sportAddress;
                }
            }
        }
    }

    //===================== VIEWS ===========================

    function isAnySportMarketResolved() external view returns (bool isResolved, address[] memory resolvableMarkets) {
        resolvableMarkets = new address[](numOfSportMarkets);
        bool resolvable;
        for (uint i = 0; i < numOfSportMarkets; i++) {
            if (!sportMarket[i].resolved) {
                (, resolvable) = _isWinningSportMarket(sportMarket[i].sportAddress, sportMarket[i].position);
                if (resolvable) {
                    isResolved = true;
                    resolvableMarkets[i] = sportMarket[i].sportAddress;
                }
            }
        }
    }

    function isUserTheWinner() external view returns (bool finalResult) {
        if (resolved) {
            finalResult = !parlayAlreadyLost;
        } else {
            (finalResult, ) = isParlayExercisable();
        }
    }

    function getSportMarketBalances() external view returns (uint[] memory allBalances) {
        allBalances = new uint[](numOfSportMarkets);
        allBalances = _marketPositionsAndBalances();
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

    function isParlayExercisable() public view returns (bool isExercisable, bool[] memory exercisedOrExercisableMarkets) {
        exercisedOrExercisableMarkets = new bool[](numOfSportMarkets);
        bool alreadyFalse;
        for (uint i = 0; i < numOfSportMarkets; i++) {
            if (sportMarket[i].exercised) {
                exercisedOrExercisableMarkets[i] = true;
            } else if (!sportMarket[i].exercised || !sportMarket[i].resolved) {
                (exercisedOrExercisableMarkets[i], ) = _isWinningSportMarket(
                    sportMarket[i].sportAddress,
                    sportMarket[i].position
                );
            }
            if (exercisedOrExercisableMarkets[i] == false && !alreadyFalse) {
                alreadyFalse = true;
            }
        }
        isExercisable = !alreadyFalse;
    }

    function getNewResolvedAndWinningPositions()
        external
        view
        returns (bool[] memory newResolvedMarkets, bool[] memory newWinningMarkets)
    {
        newResolvedMarkets = new bool[](numOfSportMarkets);
        newWinningMarkets = new bool[](numOfSportMarkets);
        for (uint i = 0; i < numOfSportMarkets; i++) {
            if (!sportMarket[i].exercised || !sportMarket[i].resolved) {
                (bool exercisable, bool isResolved) = _isWinningSportMarket(
                    sportMarket[i].sportAddress,
                    sportMarket[i].position
                );
                if (isResolved) {
                    newResolvedMarkets[i] = true;
                }
                if (exercisable) {
                    newWinningMarkets[i] = true;
                }
            }
        }
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
        require(
            numOfAlreadyExercisedSportMarkets < numOfSportMarkets && numOfResolvedSportMarkets < numOfSportMarkets,
            "Already exercised all markets"
        );
        for (uint i = 0; i < numOfSportMarkets; i++) {
            _updateSportMarketParameters(sportMarket[i].sportAddress, i);
            if (sportMarket[i].resolved && !sportMarket[i].exercised) {
                _exerciseSpecificSportMarket(sportMarket[i].sportAddress, i);
            }
        }
        if (parlayAlreadyLost && !fundsIssued) {
            uint totalSUSDamount = parlayMarketsAMM.sUSD().balanceOf(address(this));
            if (totalSUSDamount > 0) {
                parlayMarketsAMM.sUSD().transfer(address(parlayMarketsAMM), totalSUSDamount);
            }
            if (numOfResolvedSportMarkets == numOfSportMarkets) {
                fundsIssued = true;
                parlayMarketsAMM.resolveParlay();
            }
        }
    }

    function exerciseSpecificSportMarket(address _sportMarket) external onlyAMM {
        require(_sportMarketIndex[_sportMarket] > 0, "Invalid market");
        require(!paused, "Market paused");
        uint idx = _sportMarketIndex[_sportMarket] - 1;
        _updateSportMarketParameters(_sportMarket, idx);
        if (sportMarket[idx].resolved && !sportMarket[idx].exercised) {
            _exerciseSpecificSportMarket(_sportMarket, idx);
        }
        if (parlayAlreadyLost && !fundsIssued) {
            uint totalSUSDamount = parlayMarketsAMM.sUSD().balanceOf(address(this));
            if (totalSUSDamount > 0) {
                parlayMarketsAMM.sUSD().transfer(address(parlayMarketsAMM), totalSUSDamount);
            }
            if (numOfResolvedSportMarkets == numOfSportMarkets) {
                fundsIssued = true;
                parlayMarketsAMM.resolveParlay();
            }
        }
    }

    //============================== INTERNAL FUNCTIONS ===================================

    function _exerciseSpecificSportMarket(address _sportMarket, uint _idx) internal {
        require(!sportMarket[_idx].exercised, "Exercised");
        require(sportMarket[_idx].resolved, "Unresolved");
        bool exercizable = sportMarket[_idx].resolved &&
            (sportMarket[_idx].hasWon || sportMarket[_idx].isCancelled) &&
            !sportMarket[_idx].exercised
            ? true
            : false;
        if (exercizable) {
            ISportPositionalMarket(_sportMarket).exerciseOptions();
            sportMarket[_idx].exercised = true;
            numOfAlreadyExercisedSportMarkets++;
            if (
                numOfResolvedSportMarkets == numOfSportMarkets &&
                numOfAlreadyExercisedSportMarkets == numOfSportMarkets &&
                !parlayAlreadyLost
            ) {
                uint totalSUSDamount = parlayMarketsAMM.sUSD().balanceOf(address(this));
                uint calculatedAmount = _recalculateAmount();
                _resolve(true);
                if (phase() != Phase.Expiry) {
                    if (calculatedAmount < totalSUSDamount) {
                        parlayMarketsAMM.sUSD().transfer(parlayOwner, calculatedAmount);
                        parlayMarketsAMM.sUSD().transfer(address(parlayMarketsAMM), (totalSUSDamount - calculatedAmount));
                    } else {
                        parlayMarketsAMM.sUSD().transfer(parlayOwner, totalSUSDamount);
                    }
                    fundsIssued = true;
                    parlayMarketsAMM.resolveParlay();
                }
            }
        } else {
            if (!parlayAlreadyLost) {
                _resolve(false);
            }
        }
    }

    function _updateSportMarketParameters(address _sportMarket, uint _idx) internal {
        if (!sportMarket[_idx].resolved) {
            ISportPositionalMarket currentSportMarket = ISportPositionalMarket(_sportMarket);
            uint result = uint(currentSportMarket.result());
            bool isResolved = currentSportMarket.resolved();
            if (isResolved) {
                numOfResolvedSportMarkets = numOfResolvedSportMarkets + 1;
                sportMarket[_idx].resolved = isResolved;
                sportMarket[_idx].result = result;
                sportMarket[_idx].hasWon = result == (sportMarket[_idx].position + 1);
                if (result == 0) {
                    totalResultQuote = ((totalResultQuote * ONE * ONE) / sportMarket[_idx].odd) / ONE;
                    sportMarket[_idx].isCancelled = true;
                }
            }
        }
    }

    function _marketPositionsAndBalances() internal view returns (uint[] memory balances) {
        uint[] memory allBalancesPerMarket = new uint[](3);
        balances = new uint[](numOfSportMarkets);
        for (uint i = 0; i < numOfSportMarkets; i++) {
            (allBalancesPerMarket[0], allBalancesPerMarket[1], allBalancesPerMarket[2]) = ISportPositionalMarket(
                sportMarket[i].sportAddress
            ).balancesOf(address(this));
            balances[i] = allBalancesPerMarket[sportMarket[i].position];
        }
    }

    function _recalculateAmount() internal view returns (uint recalculated) {
        recalculated = ((sUSDPaid * ONE * ONE) / totalResultQuote) / ONE;
    }

    function _resolve(bool _userWon) internal {
        parlayAlreadyLost = !_userWon;
        resolved = true;
        parlayMarketsAMM.triggerResolvedEvent(parlayOwner, _userWon);
        emit Resolved(_userWon);
    }

    function _isWinningSportMarket(address _sportMarket, uint _userPosition)
        internal
        view
        returns (bool isWinning, bool isResolved)
    {
        ISportPositionalMarket currentSportMarket = ISportPositionalMarket(_sportMarket);
        if (currentSportMarket.resolved()) {
            isResolved = true;
        }
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
        // Transfer the balance rather than the deposit value in case there are any synths left over
        // from direct transfers.
        for (uint i = 0; i < numOfSportMarkets; i++) {
            _updateSportMarketParameters(sportMarket[i].sportAddress, i);
            if (sportMarket[i].resolved && !sportMarket[i].exercised) {
                _exerciseSpecificSportMarket(sportMarket[i].sportAddress, i);
            }
        }
        uint balance = parlayMarketsAMM.sUSD().balanceOf(address(this));
        if (balance != 0) {
            parlayMarketsAMM.sUSD().transfer(beneficiary, balance);
            fundsIssued = true;
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

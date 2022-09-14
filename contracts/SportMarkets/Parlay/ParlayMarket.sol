// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../OwnedWithInit.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";

// Internal references
import "../../interfaces/IParlayMarketsAMM.sol";
import "../SportPositions/SportPosition.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/ISportPositionalMarketManager.sol";

// import "hardhat/console.sol";

contract ParlayMarket is OwnedWithInit {
    using SafeERC20 for IERC20;

    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant TWELVE_DECIMAL = 1e6;

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

    uint private _numOfAlreadyExercisedSportMarkets;
    uint public numOfSportMarkets;
    mapping(uint => SportMarkets) public sportMarket;
    mapping(address => uint) private _sportMarketIndex;

    uint public numOfResolvedSportMarkets;
    uint public amount;
    uint public sUSDPaid;
    uint public totalResultQuote;

    bool public resolved;
    bool public paused;
    bool public parlayAlreadyLost;
    bool public initialized;
    bool public fundsIssued;

    address public parlayOwner;

    IParlayMarketsAMM public parlayMarketsAMM;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address[] calldata _sportMarkets,
        uint[] calldata _positionPerMarket,
        uint _amount,
        uint _sUSDPaid,
        address _parlayMarketsAMM,
        address _parlayOwner
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
            _sportMarketIndex[_sportMarkets[i]] = i + 1;
        }
        // sportMarket = sportMarketTemp;
        amount = _amount;
        sUSDPaid = _sUSDPaid;
        parlayOwner = _parlayOwner;
        //add odds
    }

    function isAnySportMarketExercisable() external view returns (bool isExercisable) {
        for (uint i = 0; i < numOfSportMarkets; i++) {
            if (!sportMarket[i].exercised) {
                (isExercisable, ) = _isWinningSportMarket(sportMarket[i].sportAddress, sportMarket[i].position);
                if (isExercisable) {
                    break;
                }
            }
        }
    }

    function isAnySportMarketResolved() external view returns (bool isResolved) {
        for (uint i = 0; i < numOfSportMarkets; i++) {
            if (!sportMarket[i].resolved) {
                (, isResolved) = _isWinningSportMarket(sportMarket[i].sportAddress, sportMarket[i].position);
                if (isResolved) {
                    break;
                }
            }
        }
    }

    function isUserTheWinner() public view returns (bool finalResult) {
        if (resolved) {
            finalResult = !parlayAlreadyLost;
        }
    }

    function getSportMarketBalances() external view returns (uint[] memory allBalances) {
        allBalances = new uint[](numOfSportMarkets);
        allBalances = _marketPositionsAndBalances();
    }

    function updateQuotes(uint[] calldata _marketQuotes, uint _totalResultQuote) external onlyAMM {
        for (uint i = 0; i < numOfSportMarkets; i++) {
            sportMarket[i].odd = _marketQuotes[i];
        }
        totalResultQuote = _totalResultQuote;
    }

    function exerciseWiningSportMarkets() external {
        require(!paused, "Market paused");
        require(
            _numOfAlreadyExercisedSportMarkets < numOfSportMarkets && numOfResolvedSportMarkets < numOfSportMarkets,
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
            parlayMarketsAMM.sUSD().transfer(address(parlayMarketsAMM), totalSUSDamount);
            fundsIssued = true;
        }
    }

    function exerciseSpecificSportMarket(address _sportMarket) external onlyAMM {
        require(_sportMarketIndex[_sportMarket] > 0, "Invalid market");
        uint idx = _sportMarketIndex[_sportMarket] - 1;
        _updateSportMarketParameters(_sportMarket, idx);
        _exerciseSpecificSportMarket(_sportMarket, idx);
    }

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
            _numOfAlreadyExercisedSportMarkets++;
            // console.log("--> market exercised");
            if (_numOfAlreadyExercisedSportMarkets == numOfSportMarkets && !parlayAlreadyLost) {
                uint totalSUSDamount = parlayMarketsAMM.sUSD().balanceOf(address(this));
                uint calculatedAmount = _recalculateAmount();
                // console.log("\n--> totalSUSDamount: ", totalSUSDamount);
                // console.log("--> calculatedAmount: ", calculatedAmount);
                _resolve(true);
                if (calculatedAmount < totalSUSDamount) {
                    // console.log("-----> calculatedAmount < totalSUSDamount");
                    parlayMarketsAMM.sUSD().transfer(parlayOwner, calculatedAmount);
                    parlayMarketsAMM.sUSD().transfer(address(parlayMarketsAMM), (totalSUSDamount - calculatedAmount));
                    fundsIssued = true;
                } else if (calculatedAmount > totalSUSDamount) {
                    // console.log("-----> calculatedAmount > totalSUSDamount");
                    parlayMarketsAMM.sUSD().transfer(parlayOwner, totalSUSDamount);
                    if ((calculatedAmount - totalSUSDamount) >= TWELVE_DECIMAL) {
                        // console.log("-----> higher than twelve decimal");
                        parlayMarketsAMM.transferRestOfSUSDAmount(parlayOwner, (calculatedAmount - totalSUSDamount), true);
                    }
                    fundsIssued = true;
                } else {
                    // console.log("-----> equal");
                    parlayMarketsAMM.sUSD().transfer(parlayOwner, totalSUSDamount);
                    fundsIssued = true;
                }
            }
        } else {
            if (!parlayAlreadyLost) {
                _resolve(false);
            }
        }
    }

    function _updateSportMarketParameters(address _sportMarket, uint _idx) internal {
        ISportPositionalMarket currentSportMarket = ISportPositionalMarket(_sportMarket);
        uint result = uint(currentSportMarket.result());
        bool isResolved = currentSportMarket.resolved();
        sportMarket[_idx].resolved = isResolved;
        sportMarket[_idx].result = result;
        sportMarket[_idx].hasWon = result == (sportMarket[_idx].position + 1);
        numOfResolvedSportMarkets++;
        if (isResolved && result == 0) {
            // console.log("--> 1. totalResult: ", totalResultQuote);
            // console.log("--> 2. odd: ", sportMarket[_idx].odd);
            totalResultQuote = ((totalResultQuote * ONE * ONE) / sportMarket[_idx].odd) / ONE;
            sportMarket[_idx].isCancelled = true;
            // console.log("--> 3. totalResult: ", totalResultQuote);
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
        // apply AMM fees
        // recalculated = ((ONE - (ONE_PERCENT * parlayMarketsAMM.parlayAmmFee())) * recalculated) / ONE;
    }

    function _resolve(bool _userWon) internal {
        parlayAlreadyLost = !_userWon;
        resolved = true;
        parlayMarketsAMM.triggerResolvedEvent(parlayOwner, _userWon);
        emit Resolved(_userWon);
    }

    function getNewResolvedAndWinningPositions()
        external
        view
        returns (bool[] memory newResolvedMarkets, bool[] memory newWinningMarkets)
    {
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

    function withdrawCollateral(address recipient) external onlyAMM {
        parlayMarketsAMM.sUSD().transfer(recipient, parlayMarketsAMM.sUSD().balanceOf(address(this)));
    }

    modifier onlyAMM() {
        require(msg.sender == address(parlayMarketsAMM), "only the AMM may perform these methods");
        _;
    }

    event Resolved(bool isUserTheWinner);
}

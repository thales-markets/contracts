// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";

// Internal references
import "./ParlayPosition.sol";
import "../../interfaces/IParlayMarketsAMM.sol";
import "../SportPositions/SportPosition.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/ISportPositionalMarketManager.sol";
import "hardhat/console.sol";

contract ParlayMarket{
    using SafeERC20 for IERC20;

    uint private constant ONE = 1e18;

    struct SportMarkets {
        address sportAddress;
        uint position;
        uint odd;
        bool resolved;
        bool exercised;
        uint result;
    }

    uint private _numOfAlreadyExercisedSportMarkets;
    uint public numOfSportMarkets;
    mapping(uint => SportMarkets) public sportMarket;
    mapping(address => uint) private _sportMarketIndex;
    // SportMarkets[] public sportMarket;

    // mapping(address => bool) private _alreadyExercisedSportMarket;
    // address[] public sportMarket;
    // uint[] public sportPosition;
    // uint[] public proportionalAmounts;
    // uint[] public marketQuotes;
    
    uint public numOfResolvedSportMarkets;
    uint public amount;
    uint public sUSDPaid;
    uint public totalResultQuote;

    bool public resolved;
    bool public paused;
    bool public parlayAlreadyLost;
    bool public initialized;

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
        parlayMarketsAMM = IParlayMarketsAMM(_parlayMarketsAMM);
        require(_sportMarkets.length == _positionPerMarket.length 
                && parlayMarketsAMM.parlaySize() == _sportMarkets.length, 
                "Lengths not matching");
        numOfSportMarkets = _sportMarkets.length;
        for(uint i=0; i<numOfSportMarkets; i++) {
            sportMarket[i].sportAddress = _sportMarkets[i];
            sportMarket[i].position = _positionPerMarket[i];
            _sportMarketIndex[_sportMarkets[i]]=i+1;
        }
        // sportMarket = sportMarketTemp;
        amount = _amount;
        sUSDPaid = _sUSDPaid;
        parlayOwner = _parlayOwner;
        //add odds
    }

    function updateQuotes(uint[] calldata _marketQuotes, uint _totalResultQuote) external onlyAMM {
        for(uint i=0; i< numOfSportMarkets; i++) {
            sportMarket[i].odd = _marketQuotes[i];
        }
        totalResultQuote = _totalResultQuote;
    }

    function getSportMarketBalances() external view returns (uint[] memory allBalances) {
        allBalances = new uint[](numOfSportMarkets);
        allBalances = _marketPositionsAndBalances();
    }

    function _marketPositionsAndBalances() internal view returns(uint[] memory balances) {
        uint[] memory allBalancesPerMarket = new uint[](3);
        balances = new uint[](numOfSportMarkets);
        for(uint i=0; i < numOfSportMarkets; i++) {
            (allBalancesPerMarket[0], allBalancesPerMarket[1], allBalancesPerMarket[2]) = ISportPositionalMarket(sportMarket[i].sportAddress).balancesOf(address(this));
            balances[i] = allBalancesPerMarket[sportMarket[i].position];
        }
    }

    function exerciseWiningSportMarkets() external {
        require(!paused, "Market paused");
        require(_numOfAlreadyExercisedSportMarkets < numOfSportMarkets 
                && numOfResolvedSportMarkets < numOfSportMarkets, "Already exercised all markets");
        for(uint i=0; i<numOfSportMarkets; i++) {
            _updateSportMarketParameters(sportMarket[i].sportAddress, i);
            _exerciseSpecificSportMarket(sportMarket[i].sportAddress, i);
        }
        if(parlayAlreadyLost) {
            uint totalSUSDamount = parlayMarketsAMM.sUSD().balanceOf(address(this));
            parlayMarketsAMM.sUSD().transfer(address(parlayMarketsAMM), totalSUSDamount);
        }
    }

    function _updateSportMarketParameters(address _sportMarket, uint _idx) internal {
        uint result;
        bool isResolved;
       (
            isResolved, 
            result
        ) = _getResolvedAndResult(
                _sportMarket
            );
        sportMarket[_idx].resolved = isResolved;
        console.log("isResolved: ", isResolved);
        console.log("result: ", result);
        numOfResolvedSportMarkets++;
        sportMarket[_idx].result = result;
        if(isResolved && result == 0) {
            totalResultQuote = ((ONE*totalResultQuote)/sportMarket[_idx].odd)/ONE;
        }
    }

    function _isWiningPosition(uint index) internal view returns(bool isWinning) {
        if(sportMarket[index].result == (sportMarket[index].position+1)) {
            isWinning = true;
        }
    }
    
    function exerciseSpecificSportMarket(address _sportMarket) external onlyAMM {
        require(_sportMarketIndex[_sportMarket] > 0, "Invalid market");
        uint idx = _sportMarketIndex[_sportMarket]-1;
        _updateSportMarketParameters(_sportMarket, idx);
        _exerciseSpecificSportMarket(_sportMarket, idx);
    }
    
    function _exerciseSpecificSportMarket(address _sportMarket, uint _idx) internal {
        require(!sportMarket[_idx].exercised, "Invalid market");
        require(sportMarket[_idx].resolved, "Unresolved");
        bool exercizable = sportMarket[_idx].resolved && _isWiningPosition(_idx) && !sportMarket[_idx].exercised ? true : false;
        if(exercizable) {
            ISportPositionalMarket(_sportMarket).exerciseOptions();
            _numOfAlreadyExercisedSportMarkets++;
            console.log("--> market exercised");
            if(_numOfAlreadyExercisedSportMarkets == numOfSportMarkets && !parlayAlreadyLost) {
                uint totalSUSDamount = parlayMarketsAMM.sUSD().balanceOf(address(this));
                _resolve(true);
                require(totalSUSDamount == amount, "Low funds");
                parlayMarketsAMM.sUSD().transfer(parlayOwner, totalSUSDamount);
            }
        }
        else {
            if(!parlayAlreadyLost) {
                _resolve(false);
            }
        }
    }

    function _resolve(bool _userWon) internal {
        parlayAlreadyLost = !_userWon;
        resolved = true;
        parlayMarketsAMM.triggerResolvedEvent(parlayOwner, _userWon);
        emit Resolved(_userWon);
    }

    function isAnySportMarketExercisable() external view returns(bool) {
        ( , , uint numOfExercisable) = _getResolvedAndWinningPositions();
        return numOfExercisable > _numOfAlreadyExercisedSportMarkets;
    }
    
    function isAnySportMarketResolved() external view returns(bool) {
        (uint resolvedPositionsMap, , ) = _getResolvedAndWinningPositions();
        return resolvedPositionsMap > 0;
    }


    function _getResolvedAndWinningPositions() internal view returns (uint resolvedPositionsMap, uint winningPositionsMap, uint numOfExercisable) {
        for(uint i=0; i<numOfSportMarkets; i++) {
            (bool exercizable, bool resolvedPosition) = _isWinningSportMarket(sportMarket[i].sportAddress, sportMarket[i].position);
            resolvedPositionsMap = resolvedPosition ? ((resolvedPositionsMap << 1) + 1) : (resolvedPositionsMap << 1);
            winningPositionsMap = exercizable ? ((winningPositionsMap << 1) + 1) : (winningPositionsMap << 1);
            numOfExercisable = exercizable ? (numOfExercisable+1) : numOfExercisable;
        }
    }
   
    function _getResolvedAndResult(address _sportMarket) internal view returns(bool , uint) {
        ISportPositionalMarket currentSportMarket = ISportPositionalMarket(_sportMarket);
        return(currentSportMarket.resolved(),  uint(currentSportMarket.result()) );
    }

    function _isWinningSportMarket(address _sportMarket, uint _userPosition) internal view returns(bool isWinning, bool isResolved) {
        ISportPositionalMarket currentSportMarket = ISportPositionalMarket(_sportMarket);
        if(currentSportMarket.resolved()) {
            isResolved = true;
        } 
        if(isResolved && (uint(currentSportMarket.result()) == (_userPosition+1) 
        || currentSportMarket.result() == ISportPositionalMarket.Side.Cancelled)) {
            isWinning =  true;
        }
    }

    function isUserTheWinner() public view returns (bool finalResult) {
        if(resolved) {
            finalResult = !parlayAlreadyLost;
        }
    }

    function withdrawCollateral(address recipient) external onlyAMM {
        parlayMarketsAMM.sUSD().transfer(recipient, parlayMarketsAMM.sUSD().balanceOf(address(this)));
    }

    modifier onlyAMM {
        require(msg.sender == address(parlayMarketsAMM), "only the AMM may perform these methods");
        _;
    }

    event WinningSportMarketExercised(address _market, address );
    event Resolved(bool isUserTheWinner);
}

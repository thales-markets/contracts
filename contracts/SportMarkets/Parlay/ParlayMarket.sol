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

    address[] public sportMarket;
    mapping(address => uint) private _sportMarketIndex;
    mapping(address => bool) private _alreadyExercisedSportMarket;

    uint[] public sportPosition;
    uint[] public proportionalAmounts;
    uint[] public marketQuotes;
    
    uint private _numOfAlreadyExercisedSportMarkets;
    uint public amount;
    uint public sUSDPaid;
    uint public totalResultQuote;
    uint public numOfResolvedSportMarkets;

    IParlayMarketsAMM public parlayMarketsAMM;

    address public parlayOwner;

    bool public resolved;
    bool public paused;
    bool public parlayAlreadyLost;
    

    /* ========== CONSTRUCTOR ========== */

                     
    bool public initialized = false;

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
        sportMarket = _sportMarkets;
        sportPosition = _positionPerMarket;
        amount = _amount;
        sUSDPaid = _sUSDPaid;
        parlayOwner = _parlayOwner;
        for(uint i=0; i<sportMarket.length; i++){
            _sportMarketIndex[_sportMarkets[i]]=i+1;
        }
        //add odds
    }

    function updateQuotes(uint[] calldata _marketQuotes, uint _totalResultQuote) external onlyAMM {
        marketQuotes = _marketQuotes;
        totalResultQuote = _totalResultQuote;
    }

    function getSportMarketBalances() external view returns (uint[] memory allBalances) {
        allBalances = new uint[](sportMarket.length);
        ( , , allBalances, , ) = _marketPositionsAndBalances();
    }

    function _marketPositionsAndBalances() internal view returns(address[] memory sportMarkets, uint[] memory positions, uint[] memory balances, uint totalAmount, uint sUSDdeposited) {
        uint[] memory allBalancesPerMarket = new uint[](3);
        balances = new uint[](sportMarket.length);
        for(uint i=0; i < sportMarket.length; i++) {
            (allBalancesPerMarket[0], allBalancesPerMarket[1], allBalancesPerMarket[2]) = ISportPositionalMarket(sportMarket[i]).balancesOf(address(this));
            balances[i] = allBalancesPerMarket[sportPosition[i]];
            totalAmount = totalAmount + balances[i];
        }
        sportMarkets = sportMarket;
        positions = sportPosition;
        sUSDdeposited = sUSDPaid;
    }

    function exerciseWiningSportMarkets() external {
        require(!paused, "Market paused");
        (uint resolvedPositionsMap, uint winningPositionsMap, uint numOfExercisable) = _getResolvedAndWinningPositions(); 
        uint numOfSportMarkets = sportMarket.length;
        require(_numOfAlreadyExercisedSportMarkets < numOfSportMarkets 
                && numOfResolvedSportMarkets < numOfSportMarkets && numOfExercisable > 0, "Already exercised all markets");
        for(uint i=0; i<numOfSportMarkets; i++) {
            // console.log("resolvedMap: ", resolvedPositionsMap, "index", ((resolvedPositionsMap >> i)%2));
            if(!_alreadyExercisedSportMarket[sportMarket[i]] && ((resolvedPositionsMap >>((numOfSportMarkets-1)-i))%2 > 0)) {
                // console.log("winningPositionsMap: ", winningPositionsMap, " idx: ", i);
                if(((winningPositionsMap>>((numOfSportMarkets-1)-i))%2 > 0)) {
                    // exercise options
                    _exerciseSportMarket(sportMarket[i]);
                    if(_numOfAlreadyExercisedSportMarkets == numOfSportMarkets && !parlayAlreadyLost) {
                        uint totalSUSDamount = parlayMarketsAMM.sUSD().balanceOf(address(this));
                        _resolve(true);
                        require(totalSUSDamount == amount, "Low funds");
                        parlayMarketsAMM.sUSD().transfer(parlayOwner, totalSUSDamount);
                    }
                }
                else {
                    if(!parlayAlreadyLost && !resolved) {
                        _resolve(false);
                    }
                    numOfResolvedSportMarkets++;
                }
            }
        }
        if(parlayAlreadyLost) {
            uint totalSUSDamount = parlayMarketsAMM.sUSD().balanceOf(address(this));
            parlayMarketsAMM.sUSD().transfer(address(parlayMarketsAMM), totalSUSDamount);
        }
    }
    
    function exerciseSpecificSportMarket(address _sportMarket) external onlyAMM {
        require(!_alreadyExercisedSportMarket[_sportMarket] && _sportMarketIndex[_sportMarket] > 0, "Invalid market");
        (bool exercizable, bool resolvedPosition) = _isWinningSportMarket(_sportMarket, sportPosition[_sportMarketIndex[_sportMarket]-1]);
        require(resolvedPosition, "Not resolved");
        if(exercizable) {
            _exerciseSportMarket(_sportMarket);
            console.log("--> market exercised");
            if(_numOfAlreadyExercisedSportMarkets == sportMarket.length && !parlayAlreadyLost) {
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

    function _exerciseSportMarket(address _sportMarket) internal {
        ISportPositionalMarket(_sportMarket).exerciseOptions();
        _alreadyExercisedSportMarket[_sportMarket] = true;
        _numOfAlreadyExercisedSportMarkets++;
        numOfResolvedSportMarkets++;
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
        uint numOfSportMarkets = sportMarket.length;
        for(uint i=0; i<numOfSportMarkets; i++) {
            (bool exercizable, bool resolvedPosition) = _isWinningSportMarket(sportMarket[i], sportPosition[i]);
            resolvedPositionsMap = resolvedPosition ? ((resolvedPositionsMap << 1) + 1) : (resolvedPositionsMap << 1);
            winningPositionsMap = exercizable ? ((winningPositionsMap << 1) + 1) : (winningPositionsMap << 1);
            numOfExercisable = exercizable ? (numOfExercisable+1) : numOfExercisable;
        }
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

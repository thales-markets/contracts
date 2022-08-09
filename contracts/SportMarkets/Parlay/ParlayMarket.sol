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
        //add odds
    }


    function exerciseWiningSportMarkets() external {
        require(!paused, "Market paused");
        (uint resolvedPositionsMap, uint winningPositionsMap, uint numOfSportMarkets) = _getResolvedAndWinningPositions(); 
        require(_numOfAlreadyExercisedSportMarkets < numOfSportMarkets 
                && numOfResolvedSportMarkets < numOfSportMarkets && resolvedPositionsMap > 0, "Already exercised all markets");
        for(uint i=0; i<numOfSportMarkets; i++) {
            if(!_alreadyExercisedSportMarket[sportMarket[i]] && (resolvedPositionsMap%(10**i)) > 0) {
                if((winningPositionsMap%(10**i)) > 0) {
                    // exercise options
                    _exerciseSportMarket(sportMarket[i]);
                    if(_numOfAlreadyExercisedSportMarkets == numOfSportMarkets && !parlayAlreadyLost) {
                        _resolve(true);
                        uint totalSUSDamount = parlayMarketsAMM.sUSD().balanceOf(address(this));
                        if(totalSUSDamount < amount) {
                            parlayMarketsAMM.sUSD().transfer(parlayOwner, totalSUSDamount);
                            parlayMarketsAMM.transferRestOfSUSDAmount(parlayOwner, (amount-totalSUSDamount), true);
                        }
                        else {
                            parlayMarketsAMM.sUSD().transfer(parlayOwner, amount);
                        }
                    }
                    else if(parlayAlreadyLost) {
                        parlayMarketsAMM.sUSD().transfer(address(parlayMarketsAMM), proportionalAmounts[i]);
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
    }
    
    function manualExerciseSportMarket(address _sportMarket) external onlyAMM {
        require(ISportPositionalMarket(_sportMarket).resolved(), "Not resolved");
        uint exercisedAmount = proportionalAmounts[_sportMarketIndex[_sportMarket]];
        ISportPositionalMarket.Side sideResult = ISportPositionalMarket(_sportMarket).result();
        if(uint(sideResult) == sportPosition[_sportMarketIndex[_sportMarket]] || sideResult == ISportPositionalMarket.Side.Cancelled) {
            _exerciseSportMarket(_sportMarket);
            if(parlayAlreadyLost) { 
                parlayMarketsAMM.sUSD().transfer(address(parlayMarketsAMM), exercisedAmount);
            }
            else if(_numOfAlreadyExercisedSportMarkets == sportMarket.length) {
                _resolve(true);
                uint totalSUSDamount = parlayMarketsAMM.sUSD().balanceOf(address(this));
                if(totalSUSDamount < amount) {
                    parlayMarketsAMM.sUSD().transfer(parlayOwner, totalSUSDamount);
                    parlayMarketsAMM.transferRestOfSUSDAmount(parlayOwner, (amount-totalSUSDamount), true);
                }
                else {
                    parlayMarketsAMM.sUSD().transfer(parlayOwner, amount);
                }
            }
        }
        else {
            _resolve(false);
            numOfResolvedSportMarkets++;
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
        ( , uint winningPositionsMap, ) = _getResolvedAndWinningPositions();
        return winningPositionsMap > 0;
    }
    
    function isAnySportMarketResolved() external view returns(bool) {
        (uint resolvedPositionsMap, , ) = _getResolvedAndWinningPositions();
        return resolvedPositionsMap > 0;
    }


    function _getResolvedAndWinningPositions() internal view returns (uint resolvedPositionsMap, uint winningPositionsMap, uint numOfSportMarkets) {
        numOfSportMarkets = sportMarket.length;
        for(uint i=0; i<numOfSportMarkets; i++) {
            (bool exercizable, bool resolvedPosition) = _isWinningSportMarket(sportMarket[i], sportPosition[i]);
            if(resolvedPosition){
                resolvedPositionsMap = resolvedPositionsMap + 10**i;
            }
            if(exercizable){
                winningPositionsMap = winningPositionsMap + 10**i;
            }
        }
    }
   
    function _isWinningSportMarket(address _sportMarket, uint _position) internal view returns(bool isWinning, bool isResolved) {
        ISportPositionalMarket currentSportMarket = ISportPositionalMarket(_sportMarket);
        if(currentSportMarket.resolved()) {
            isResolved = true;
        } 
        if(isResolved && (uint(currentSportMarket.result()) == _position 
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

    event Resolved(bool isUserTheWinner);
}

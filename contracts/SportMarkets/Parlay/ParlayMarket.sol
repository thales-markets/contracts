// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";

// Internal references
import "./ParlayPosition.sol";
import "./ParlayMarketsAMM.sol";
import "../SportPositions/SportPosition.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/ISportPositionalMarketManager.sol";

contract ParlayMarket {
    using SafeERC20 for IERC20;

    enum Position {Home, Away, Draw}

    ISportPositionalMarket[] public sportMarket;

    SportPosition[] public sportPosition;

    ParlayPosition public parlayPositionToken;

    ParlayMarketsAMM public parlayMarketsAMM;

    bool public resolved;
    bool public paused;

    /* ========== CONSTRUCTOR ========== */

    bool public initialized = false;

    function initialize(
        ISportPositionalMarket[] calldata _sportMarkets,
        SportPosition[] calldata _positionPerMarket,
        address _parlayMarketsAMM
    ) external {
        require(!initialized, "Parlay Market already initialized");
        initialized = true;
        parlayMarketsAMM = ParlayMarketsAMM(_parlayMarketsAMM);
        require(_sportMarkets.length == _positionPerMarket.length 
                && parlayMarketsAMM.parlaySize() == _sportMarkets.length, 
                "Lengths not matching");
        sportMarket = _sportMarkets;
        sportPosition = _positionPerMarket;
        //add odds
    }

    function mint(
        uint value,
        address minter
    ) external onlyAMM {
        if (value == 0) {
            return;
        }
        _mint(minter, value);
    }

    function _mint(
        address minter,
        uint amount
    ) internal {
        emit Mint(minter, amount);
    }

    function burn(uint value, address claimant) external onlyAMM {
        // emit Burn(claimant, value, Position.In);
    }

    function canExercisePositions() external view returns (bool canBeExercised) {
        canBeExercised = true;
        for(uint i=0; i<sportMarket.length; i++) {
            if(!sportMarket[i].resolved() && !sportMarket[i].canResolve()) {
                canBeExercised = false;
            }
        }
        if(parlayPositionToken.balanceOf(msg.sender) == 0) {
            canBeExercised = false;
        }
    }

    function exercisePositions() external {
        if (!resolved) {
            resolveMarket();
        }
        require(!paused, "Market paused");

        // Each option only needs to be exercised if the account holds any of it.

        // emit Exercised(msg.sender, payout, curResult);
    }

    function canResolve() external view returns (bool canBeResolved) {
        // The markets must be resolved
        if(!paused){
            canBeResolved = true;
        }
        
    }

    function resolveMarket() public {
        if(!paused){
            resolved = true;
        }
        emit Resolved(result());
    }

    function result() public view returns (Position resultToReturn) {
    }

    function withdrawCollateral(address recipient) external onlyAMM {
        parlayMarketsAMM.sUSD().transfer(recipient, parlayMarketsAMM.sUSD().balanceOf(address(this)));
    }

    modifier onlyAMM {
        require(msg.sender == address(parlayMarketsAMM), "only the AMM may perform these methods");
        _;
    }

    event Mint(address minter, uint amount);
    event Burn(address burner, uint amount);
    event Exercised(address exerciser, uint amount);
    event Resolved(Position winningPosition);
}

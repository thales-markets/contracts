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

contract ParlayMarket{
    using SafeERC20 for IERC20;

    // string public name;
    // string public symbol;
    // uint8 public constant decimals = 18;

    // mapping(address => uint) public override balanceOf;
    // uint public override totalSupply;

    // // The argument order is allowance[owner][spender]
    // mapping(address => mapping(address => uint)) public override allowance;

    address[] public sportMarket;
    mapping(address => bool) private _alreadyExercisedSportMarket;

    uint[] public sportPosition;
    uint public amount;
    uint public sUSDPaid;
    uint[] public proportionalAmounts;
    uint[] public marketQuotes;

    ParlayMarketsAMM public parlayMarketsAMM;

    address public parlayOwner;

    bool public resolved;
    bool public paused;

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
        parlayMarketsAMM = ParlayMarketsAMM(_parlayMarketsAMM);
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
        uint numOfSportMarkets = sportMarket.length;
        for(uint i=0; i<numOfSportMarkets; i++) {
            if(!_alreadyExercisedSportMarket[sportMarket[i]] && _isWinningSportMarket(sportMarket[i], sportPosition[i])) {
                // exercise options
                ISportPositionalMarket(sportMarket[i]).exerciseOptions();
                _alreadyExercisedSportMarket[sportMarket[i]] = true;
            }
        }
    }

    function _isWinningSportMarket(address _sportMarket, uint _position) internal view returns(bool isWinning) {
        if(ISportPositionalMarket(_sportMarket).resolved() 
        && (uint(ISportPositionalMarket(_sportMarket).result()) == _position 
        || ISportPositionalMarket(_sportMarket).result() == ISportPositionalMarket.Side.Cancelled)) {
            isWinning =  true;
        }
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
        // canBeExercised = true;
        // for(uint i=0; i<sportMarket.length; i++) {
        //     if(!sportMarket[i].resolved() && !sportMarket[i].canResolve()) {
        //         canBeExercised = false;
        //     }
        // }
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

    function result() public view returns (uint resultToReturn) {
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
    event Resolved(uint winningPosition);
}

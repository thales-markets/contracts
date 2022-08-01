// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";

// Internal references
import "./ParlayPosition.sol";
import "./ParlayMarketsAMM.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/ISportPositionalMarketManager.sol";

contract ParlayMarket {
    using SafeERC20 for IERC20;

    enum Position {Home, Away, Draw}

    ISportPositionalMarket[] public sportMarket;

    ParlayPosition[] public parlayPosition;

    ParlayMarketsAMM public parlayMarketsAMM;

    bool public resolved = false;

    /* ========== CONSTRUCTOR ========== */

    bool public initialized = false;

    function initialize(
        address _parlayMarketsAMM
    ) external {
        require(!initialized, "Parlay Market already initialized");
        initialized = true;
        parlayMarketsAMM = ParlayMarketsAMM(_parlayMarketsAMM);
    }

    function mint(
        uint value,
        Position _position,
        address minter
    ) external onlyAMM {
        if (value == 0) {
            return;
        }
        _mint(minter, value, _position);
    }

    function _mint(
        address minter,
        uint amount,
        Position _position
    ) internal {
        emit Mint(minter, amount, _position);
    }

    function burn(uint value, address claimant) external onlyAMM {
        // emit Burn(claimant, value, Position.In);
    }

    function canExercisePositions() external view returns (bool canBeExercised) {
        
    }

    function exercisePositions() external {
        if (!resolved) {
            resolveMarket();
        }

        // Each option only needs to be exercised if the account holds any of it.

        // emit Exercised(msg.sender, payout, curResult);
    }

    function canResolve() external view returns (bool canBeResolved) {
        // The markets must be resolved
        
    }

    function resolveMarket() public {
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

    event Mint(address minter, uint amount, Position _position);
    event Burn(address burner, uint amount, Position _position);
    event Exercised(address exerciser, uint amount, Position _position);
    event Resolved(Position winningPosition);
}

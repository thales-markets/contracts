// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

// internal
import "../interfaces/IChainedSpeedMarketsAMM.sol";

import "./SpeedMarket.sol";

contract ChainedSpeedMarket {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct InitParams {
        address _chainedMarketsAMM;
        address _user;
        bytes32 _asset;
        uint64 _timeFrame;
        uint64 _initialStrikeTime;
        uint64 _strikeTime;
        int64 _initialStrikePrice;
        SpeedMarket.Direction[] _directions;
        uint _buyinAmount;
        uint _safeBoxImpact;
        uint _payoutMultiplier;
    }

    address public user;
    bytes32 public asset;
    uint64 public timeFrame;
    uint64 public initialStrikeTime;
    uint64 public strikeTime;
    int64 public initialStrikePrice;
    int64[] public strikePrices;
    SpeedMarket.Direction[] public directions;
    uint public buyinAmount;
    uint public safeBoxImpact;
    uint public payoutMultiplier;

    bool public resolved;
    int64[] public finalPrices;
    bool public isUserWinner;

    uint256 public createdAt;

    IChainedSpeedMarketsAMM public chainedMarketsAMM;

    /* ========== CONSTRUCTOR ========== */

    bool public initialized = false;

    function initialize(InitParams calldata params) external {
        require(!initialized, "Chained market already initialized");
        initialized = true;
        chainedMarketsAMM = IChainedSpeedMarketsAMM(params._chainedMarketsAMM);
        user = params._user;
        asset = params._asset;
        timeFrame = params._timeFrame;
        initialStrikeTime = params._initialStrikeTime;
        strikeTime = params._strikeTime;
        initialStrikePrice = params._initialStrikePrice;
        directions = params._directions;
        buyinAmount = params._buyinAmount;
        safeBoxImpact = params._safeBoxImpact;
        payoutMultiplier = params._payoutMultiplier;
        chainedMarketsAMM.sUSD().approve(params._chainedMarketsAMM, type(uint256).max);
        createdAt = block.timestamp;
    }

    function resolve(int64[] calldata _finalPrices, bool _isManually) external onlyAMM {
        require(!resolved, "already resolved");
        require(block.timestamp > initialStrikeTime + (timeFrame * (_finalPrices.length - 1)), "not ready to be resolved");
        require(_finalPrices.length <= directions.length, "more prices than directions");

        finalPrices = _finalPrices;

        for (uint i = 0; i < _finalPrices.length; i++) {
            strikePrices.push(i == 0 ? initialStrikePrice : _finalPrices[i - 1]); // previous final price is current strike price
            bool userWonDirection = (_finalPrices[i] < strikePrices[i] && directions[i] == SpeedMarket.Direction.Down) ||
                (_finalPrices[i] > strikePrices[i] && directions[i] == SpeedMarket.Direction.Up);

            // user lost stop checking rest of directions
            if (!userWonDirection) {
                resolved = true;
                break;
            }
            // when last final price for last direction user won
            if (i == directions.length - 1) {
                require(!_isManually, "Can not resolve manually");
                isUserWinner = true;
                resolved = true;
            }
        }

        if (resolved) {
            if (isUserWinner) {
                chainedMarketsAMM.sUSD().safeTransfer(user, chainedMarketsAMM.sUSD().balanceOf(address(this)));
            } else {
                chainedMarketsAMM.sUSD().safeTransfer(
                    address(chainedMarketsAMM),
                    chainedMarketsAMM.sUSD().balanceOf(address(this))
                );
            }

            emit Resolved(finalPrices, isUserWinner);
        }
    }

    /// @notice numOfDirections returns number of directions (speed markets in chain)
    /// @return uint
    function numOfDirections() external view returns (uint) {
        return directions.length;
    }

    /// @notice numOfPrices returns number of strike/finales
    /// @return uint
    function numOfPrices() external view returns (uint) {
        return finalPrices.length;
    }

    modifier onlyAMM() {
        require(msg.sender == address(chainedMarketsAMM), "only the AMM may perform these methods");
        _;
    }

    event Resolved(int64[] finalPrices, bool userIsWinner);
}

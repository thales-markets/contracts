pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

contract SwapRouterMock {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    address public defaultTokenIn;
    address public defaultTokenOut;

    uint public multiplier = 1;

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    /// @notice Swaps `amountIn` of one token for as much as possible of another token
    /// @param params The parameters necessary for the swap, encoded as `ExactInputSingleParams` in calldata
    /// @return amountOut The amount of the received token
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut) {
        IERC20Upgradeable(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        IERC20Upgradeable(params.tokenOut).safeTransfer(msg.sender, params.amountOutMinimum * multiplier);
        amountOut = params.amountOutMinimum * multiplier;
    }

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    /// @notice Swaps `amountIn` of one token for as much as possible of another along the specified path
    /// @param params The parameters necessary for the multi-hop swap, encoded as `ExactInputParams` in calldata
    /// @return amountOut The amount of the received token
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut) {
        IERC20Upgradeable(defaultTokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        IERC20Upgradeable(defaultTokenOut).safeTransfer(msg.sender, params.amountOutMinimum * multiplier);
        amountOut = params.amountOutMinimum * multiplier;
    }

    function setDefaults(address _defaultTokenIn, address _defaultTokenOut) external {
        defaultTokenIn = _defaultTokenIn;
        defaultTokenOut = _defaultTokenOut;
    }

    function setMultiplier(uint _multiplier) external {
        multiplier = _multiplier;
    }
}

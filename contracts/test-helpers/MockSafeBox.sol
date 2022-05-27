// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "../utils/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "../utils/libraries/UniswapMath.sol";

contract MockSafeBox is ProxyOwned, Initializable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable public sUSD;
    IERC20Upgradeable public thalesToken;
    address public WETH9;

    ISwapRouter public swapRouter;
    IUniswapV3Factory public uniswapFactory;

    uint256 public sUSDperTick;
    uint256 public tickLength;
    uint256 public lastBuyback;

    function initialize(address _owner, IERC20Upgradeable _sUSD) public initializer {
        setOwner(_owner);
        sUSD = _sUSD;
    }

    /// @notice executeBuyback buys THALES tokens for predefined amount of sUSD stored in sUSDperTick value
    /// @dev executeBuyback can be called if at least 1 tickLength has passed since last buyback, 
    /// it then calculates how many ticks passes and executes buyback via Uniswap V3 integrated contract.
    function executeBuyback() external {
        // check zero addresses

        uint ticksFromLastBuyBack = lastBuyback != 0 ? (block.timestamp - lastBuyback) / tickLength : 1;
        require(ticksFromLastBuyBack > 0, "Not enough ticks have passed since last buyback");

        // buy THALES via Uniswap
        uint256 amountThales = _swapExactInput(sUSDperTick * ticksFromLastBuyBack, address(sUSD), address(thalesToken), 3000);

        lastBuyback = block.timestamp;
        emit BuybackExecuted(sUSDperTick, amountThales);
    }

    /// @notice setTickRate sets sUSDperTick amount 
    /// @param _sUSDperTick New sUSDperTick value 
    function setTickRate(uint256 _sUSDperTick) external onlyOwner {
        sUSDperTick = _sUSDperTick;
        emit TickRateChanged(_sUSDperTick);
    }

    /// @notice setTickLength sets tickLength value needed to execute next buyback
    /// @param _tickLength New tickLength value measuered in seconds
    function setTickLength(uint256 _tickLength) external onlyOwner {
        tickLength = _tickLength;
        emit TickLengthChanged(_tickLength);
    }

    /// @notice setThalesToken sets address for THALES token
    /// @param _tokenAddress New address of the token
    function setThalesToken(address _tokenAddress) external onlyOwner {
        require(_tokenAddress != address(0), "Invalid address");
        thalesToken = IERC20Upgradeable(_tokenAddress);
        emit ThalesTokenAddressChanged(_tokenAddress);
    }

    /// @notice setWETHAddress sets address for WETH token
    /// @param _tokenAddress New address of the token
    function setWETHAddress(address _tokenAddress) external onlyOwner {
        require(_tokenAddress != address(0), "Invalid address");
        WETH9 = _tokenAddress;
        emit WETHTokenAddressChanged(_tokenAddress);
    }

    /// @notice setSwapRouter sets address for Uniswap V3 ISwapRouter
    /// @param _swapRouter New address of the router
    function setSwapRouter(address _swapRouter) external onlyOwner {
        require(_swapRouter != address(0), "Invalid address");
        swapRouter = ISwapRouter(_swapRouter);
        emit SwapRouterAddressChanged(_swapRouter);
    }

    /// @notice setUniswapV3Factory sets address for Uniswap V3 Factory
    /// @param _uniswapFactory New address of the factory
    function setUniswapV3Factory(address _uniswapFactory) external onlyOwner {
        require(_uniswapFactory != address(0), "Invalid address");
        uniswapFactory = IUniswapV3Factory(_uniswapFactory);
        emit UniswapV3FactoryAddressChanged(_uniswapFactory);
    }

    /// @notice swapExactInputSingle swaps a fixed amount of tokenIn for a maximum possible amount of tokenOut
    /// @param amountIn The exact amount of tokenIn that will be swapped for tokenOut.
    /// @param tokenIn Address of first token
    /// @param tokenOut Address of second token
    /// @param poolFee Fee value of tokenIn/tokenOut pool
    /// @return amountOut The amount of tokenOut received.
    function _swapExactInput(
        uint256 amountIn,
        address tokenIn,
        address tokenOut,
        uint24 poolFee
    ) internal returns (uint256 amountOut) {
        // Approve the router to spend tokenIn.
        TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);

        uint256 ratio = _getRatio(tokenIn, tokenOut, poolFee);

        // Multiple pool swaps are encoded through bytes called a `path`. A path is a sequence of token addresses and poolFees that define the pools used in the swaps.
        // The format for pool encoding is (tokenIn, fee, tokenOut/tokenIn, fee, tokenOut) where tokenIn/tokenOut parameter is the shared token across the pools.
         ISwapRouter.ExactInputParams memory params =
            ISwapRouter.ExactInputParams({
                path: abi.encodePacked(address(tokenIn), poolFee, WETH9, poolFee, address(tokenOut)),
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: amountIn * ratio * 99 / 100
            });


        // The call to `exactInput` executes the swap.
       //amountOut = swapRouter.exactInput(params);
    }

    function _getRatio(address tokenA, address tokenB, uint24 poolFee) internal view returns (uint256 ratio) {
        uint256 ratioA = _getWETHPoolRatio(tokenA, poolFee);
        uint256 ratioB = _getWETHPoolRatio(tokenB, poolFee);

        ratio = ratioA / ratioB;
    }

    function _getWETHPoolRatio(address token, uint24 poolFee) internal view returns (uint256 ratio) {
        address pool = IUniswapV3Factory(uniswapFactory).getPool(WETH9, token, poolFee);
        (uint160 sqrtPriceX96token, , , , , , ) = IUniswapV3Pool(pool).slot0();
        if(IUniswapV3Pool(pool).token0() == WETH9) {
            ratio = 1 / _getPriceFromSqrtPrice(sqrtPriceX96token);
        } else {
            ratio = _getPriceFromSqrtPrice(sqrtPriceX96token);
        }
    }
    function _getPriceFromSqrtPrice(uint160 sqrtPriceX96) internal pure returns (uint256 priceX96) {
        uint256 price = UniswapMath.mulDiv(sqrtPriceX96, sqrtPriceX96, UniswapMath.Q96);
        return UniswapMath.mulDiv(price, 10**18, UniswapMath.Q96);
    }

    event TickRateChanged(uint256 _sUSDperTick);
    event TickLengthChanged(uint256 _tickLength);
    event ThalesTokenAddressChanged(address _tokenAddress);
    event WETHTokenAddressChanged(address _tokenAddress);
    event SwapRouterAddressChanged(address _swapRouter);
    event UniswapV3FactoryAddressChanged(address _uniswapFactory);
    event BuybackExecuted(uint256 _amountIn, uint256 _amountOut);
}

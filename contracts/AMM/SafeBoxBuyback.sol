// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "../utils/libraries/UniswapMath.sol";

contract SafeBoxBuyback is ProxyOwned, Initializable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable public sUSD;
    IERC20Upgradeable public thalesToken;
    address public WETH9;

    ISwapRouter public swapRouter;
    IUniswapV3Factory public uniswapFactory;

    uint256 public sUSDperTick;
    uint256 public tickLength;
    uint256 public lastBuyback;

    bool public buybacksEnabled;

    uint256 public minAccepted;

    function initialize(address _owner, IERC20Upgradeable _sUSD) public initializer {
        setOwner(_owner);
        initNonReentrant();
        sUSD = _sUSD;
    }

    /// @notice executeBuyback buys THALES tokens for predefined amount of sUSD stored in sUSDperTick value
    /// @dev executeBuyback can be called if at least 1 tickLength has passed since last buyback,
    /// it then calculates how many ticks passes and executes buyback via Uniswap V3 integrated contract.
    function executeBuyback() external nonReentrant {
        require(buybacksEnabled, "Buybacks are not enabled");
        uint ticksFromLastBuyBack = lastBuyback != 0 ? (block.timestamp - lastBuyback) / tickLength : 1;
        require(ticksFromLastBuyBack > 0, "Not enough ticks have passed since last buyback");
        require(sUSD.balanceOf(address(this)) >= sUSDperTick * ticksFromLastBuyBack, "Not enough sUSD in contract.");

        // buy THALES via Uniswap
        uint256 amountThales =
            _swapExactInput(sUSDperTick * ticksFromLastBuyBack, address(sUSD), address(thalesToken), 3000);

        lastBuyback = block.timestamp;
        emit BuybackExecuted(sUSDperTick * ticksFromLastBuyBack, amountThales);
    }

    /// @notice _swapExactInput swaps a fixed amount of tokenIn for a maximum possible amount of tokenOut
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

        uint256 _minAccepted = minAccepted == 0 ? 95 : minAccepted;

        uint256 ratio = _getRatio(tokenIn, tokenOut, poolFee);

        // Multiple pool swaps are encoded through bytes called a `path`. A path is a sequence of token addresses and poolFees that define the pools used in the swaps.
        // The format for pool encoding is (tokenIn, fee, tokenOut/tokenIn, fee, tokenOut) where tokenIn/tokenOut parameter is the shared token across the pools.
        ISwapRouter.ExactInputParams memory params =
            ISwapRouter.ExactInputParams({
                path: abi.encodePacked(address(tokenIn), poolFee, WETH9, poolFee, address(tokenOut)),
                recipient: address(this),
                deadline: block.timestamp + 15,
                amountIn: amountIn,
                amountOutMinimum: (amountIn * ratio * _minAccepted) / (100 * 10**18)
            });

        // The call to `exactInput` executes the swap.
        amountOut = swapRouter.exactInput(params);
    }

    /// @notice _getRatio returns ratio between tokenA and tokenB based on prices fetched from
    /// UniswapV3Pool
    /// @param tokenA Address of first token
    /// @param tokenB Address of second token
    /// @param poolFee Fee value of tokenA/tokenB pool
    /// @return ratio tokenA/tokenB ratio
    function _getRatio(
        address tokenA,
        address tokenB,
        uint24 poolFee
    ) internal view returns (uint256 ratio) {
        uint256 ratioA = _getWETHPoolRatio(tokenA, poolFee);
        uint256 ratioB = _getWETHPoolRatio(tokenB, poolFee);

        ratio = (ratioA * 10**18) / ratioB;
    }

    /// @notice _getWETHPoolRatio returns ratio between tokenA and WETH based on prices fetched from
    /// UniswapV3Pool
    /// @dev Ratio is calculated differently if token0 in pool is WETH
    /// @param token Token address
    /// @param poolFee Fee value of token/WETH pool
    /// @return ratio token/WETH ratio
    function _getWETHPoolRatio(address token, uint24 poolFee) internal view returns (uint256 ratio) {
        address pool = IUniswapV3Factory(uniswapFactory).getPool(WETH9, token, poolFee);
        (uint160 sqrtPriceX96token, , , , , , ) = IUniswapV3Pool(pool).slot0();
        if (IUniswapV3Pool(pool).token0() == WETH9) {
            // ratio is 10^18/sqrtPrice - multiply again with 10^18 to convert to decimal
            ratio = UniswapMath.mulDiv(10**18, 10**18, _getPriceFromSqrtPrice(sqrtPriceX96token));
        } else {
            ratio = _getPriceFromSqrtPrice(sqrtPriceX96token);
        }
    }

    /// @notice _getPriceFromSqrtPrice calculate price from UniswapV3Pool via formula
    /// @param sqrtPriceX96 Price fetched from UniswapV3Pool
    /// @return Calculated price
    function _getPriceFromSqrtPrice(uint160 sqrtPriceX96) internal pure returns (uint256) {
        uint256 price = UniswapMath.mulDiv(sqrtPriceX96, sqrtPriceX96, UniswapMath.Q96);
        return UniswapMath.mulDiv(price, 10**18, UniswapMath.Q96);
    }

    function getTicksFromLastBuys() external view returns (uint) {
        uint ticksFromLastBuyBack = lastBuyback != 0 ? (block.timestamp - lastBuyback) / tickLength : 1;
        return ticksFromLastBuyBack;
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

    /// @notice setMinAccepted sets _minAccepted amount
    /// @param _minAccepted for buyback
    function setMinAccepted(uint256 _minAccepted) external onlyOwner {
        minAccepted = _minAccepted;
        emit MinAcceptedChanged(_minAccepted);
    }

    /// @notice setBuybacksEnabled enables/disables buybacks
    /// @param _buybacksEnabled enabled/disabled
    function setBuybacksEnabled(bool _buybacksEnabled) external onlyOwner {
        require(buybacksEnabled != _buybacksEnabled, "Already enabled/disabled");
        buybacksEnabled = _buybacksEnabled;
        emit SetBuybacksEnabled(_buybacksEnabled);
    }

    /// @notice retrieveSUSDAmount retrieves sUSD from this contract
    /// @param account where to send the tokens
    /// @param amount how much to retrieve
    function retrieveSUSDAmount(address payable account, uint amount) external onlyOwner {
        sUSD.transfer(account, amount);
    }

    /// @notice retrieveThalesAmount retrieves THALES from this contract
    /// @param account where to send the tokens
    /// @param amount how much to retrieve
    function retrieveThalesAmount(address payable account, uint amount) external onlyOwner {
        thalesToken.transfer(account, amount);
    }

    event TickRateChanged(uint256 _sUSDperTick);
    event MinAcceptedChanged(uint256 _minAccepted);
    event TickLengthChanged(uint256 _tickLength);
    event ThalesTokenAddressChanged(address _tokenAddress);
    event WETHTokenAddressChanged(address _tokenAddress);
    event SwapRouterAddressChanged(address _swapRouter);
    event UniswapV3FactoryAddressChanged(address _uniswapFactory);
    event SetBuybacksEnabled(bool _buybacksEnabled);
    event BuybackExecuted(uint256 _amountIn, uint256 _amountOut);
}

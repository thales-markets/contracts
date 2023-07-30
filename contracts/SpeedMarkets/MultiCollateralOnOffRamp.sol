// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

import "../utils/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "../utils/libraries/UniswapMath.sol";

// interfaces
import "../interfaces/ICurveSUSD.sol";
import "../interfaces/IPriceFeed.sol";

interface WethLike {
    function deposit() external payable;

    function withdraw(uint256) external;
}

/// @title MultiCollateralOnOffRamp to use different collateral than default
contract MultiCollateralOnOffRamp is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;

    IERC20Upgradeable public sUSD;

    mapping(address => bool) public collateralSupported;

    mapping(address => bool) public ammsSupported;

    ISwapRouter public swapRouter;
    IUniswapV3Factory public uniswapFactory;

    address public WETH9;

    IQuoter public quoter;

    IPriceFeed public priceFeed;

    address public usdc;
    address public usdt;
    address public dai;

    bool public curveOnrampEnabled;

    uint public maxAllowedPegSlippagePercentage;

    ICurveSUSD public curveSUSD;

    mapping(address => bytes) public pathPerCollateral;

    mapping(address => bytes32) public priceFeedKeyPerCollateral;

    function initialize(address _owner, IERC20Upgradeable _sUSD) public initializer {
        setOwner(_owner);
        initNonReentrant();
        sUSD = _sUSD;
    }

    function onramp(
        uint buyinAmount,
        address collateral,
        uint collateralAmount
    ) external nonReentrant notPaused returns (uint convertedAmount) {
        require(collateralSupported[collateral], "Unsupported collateral");
        require(ammsSupported[msg.sender], "Unsupported caller");

        IERC20Upgradeable(collateral).safeTransferFrom(msg.sender, address(this), collateralAmount);

        if (collateral == WETH9) {
            _swapExactSingle(collateralAmount, collateral, buyinAmount);
        } else if (collateral == usdc || collateral == dai || collateral == usdt) {
            _swapViaCurve(collateral, collateralAmount, buyinAmount);
        } else {
            _swapExactInput(collateralAmount, collateral, buyinAmount);
        }
        convertedAmount = sUSD.balanceOf(address(this));
        sUSD.safeTransfer(msg.sender, sUSD.balanceOf(address(this)));
    }

    function onrampWithEth(uint buyinAmount, uint collateralAmount)
        external
        payable
        nonReentrant
        notPaused
        returns (uint convertedAmount)
    {
        WethLike(WETH9).deposit{value: msg.value}();

        require(IERC20Upgradeable(WETH9).balanceOf(address(this)) == collateralAmount);

        _swapExactSingle(collateralAmount, WETH9, buyinAmount);

        convertedAmount = sUSD.balanceOf(address(this));
        sUSD.safeTransfer(msg.sender, sUSD.balanceOf(address(this)));
    }

    ///////////////////////Curve related code///////////////////
    function _swapViaCurve(
        address collateral,
        uint collateralQuote,
        uint susdQuote
    ) internal {
        int128 curveIndex = _mapCollateralToCurveIndex(collateral);
        require(curveIndex > 0 && curveOnrampEnabled, "unsupported collateral");

        uint transformedCollateralForPegCheck = collateral == usdc || collateral == usdt
            ? collateralQuote * (1e12)
            : collateralQuote;
        require(
            maxAllowedPegSlippagePercentage > 0 &&
                transformedCollateralForPegCheck >= (susdQuote * (ONE - (maxAllowedPegSlippagePercentage))) / ONE,
            "Amount below max allowed peg slippage"
        );

        IERC20Upgradeable collateralToken = IERC20Upgradeable(collateral);
        curveSUSD.exchange_underlying(curveIndex, 0, collateralQuote, susdQuote);
    }

    ///////////////////////UNISWAP related code///////////////////

    function _swapExactSingle(
        uint256 amountIn,
        address tokenIn,
        uint amountOutMin
    ) internal returns (uint256 amountOut) {
        uint currentCollateralPrice = priceFeed.rateForCurrency(priceFeedKeyPerCollateral[tokenIn]);
        uint expectedAmountOutMin = (amountIn * currentCollateralPrice) / ONE;

        require(
            amountOutMin >= (expectedAmountOutMin * (ONE - (maxAllowedPegSlippagePercentage))) / ONE,
            "Amount above max allowed peg slippage"
        );
        require(
            expectedAmountOutMin >= (amountOutMin * (ONE - (maxAllowedPegSlippagePercentage))) / ONE,
            "Amount below max allowed peg slippage"
        );

        // Approve the router to spend tokenIn.
        TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: address(sUSD),
            fee: 3000,
            recipient: address(this),
            deadline: block.timestamp + 15,
            amountIn: amountIn,
            amountOutMinimum: amountOutMin,
            sqrtPriceLimitX96: 0
        });

        // The call to `exactInputSingle` executes the swap.
        amountOut = swapRouter.exactInputSingle(params);
    }

    /// @notice _swapExactInput swaps a fixed amount of tokenIn for a maximum possible amount of tokenOut
    /// @param amountIn The exact amount of tokenIn that will be swapped for tokenOut.
    /// @param tokenIn Address of first token
    /// @return amountOut The amount of tokenOut received.
    function _swapExactInput(
        uint256 amountIn,
        address tokenIn,
        uint amountOutMin
    ) internal returns (uint256 amountOut) {
        uint currentCollateralPrice = priceFeed.rateForCurrency(priceFeedKeyPerCollateral[tokenIn]);
        uint expectedAmountOutMin = (amountIn * currentCollateralPrice) / ONE;

        require(
            amountOutMin >= (expectedAmountOutMin * (ONE - (maxAllowedPegSlippagePercentage))) / ONE,
            "Amount above max allowed peg slippage"
        );
        require(
            expectedAmountOutMin >= (amountOutMin * (ONE - (maxAllowedPegSlippagePercentage))) / ONE,
            "Amount below max allowed peg slippage"
        );

        // Approve the router to spend tokenIn.
        TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);

        bytes memory pathToUse = pathPerCollateral[tokenIn];
        if (pathToUse.length == 0) {
            uint fee = 3000;
            pathToUse = abi.encodePacked(address(tokenIn), fee, WETH9, fee, address(sUSD));
        }

        // Multiple pool swaps are encoded through bytes called a `path`. A path is a sequence of token addresses and poolFees that define the pools used in the swaps.
        ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
            path: pathToUse,
            recipient: address(this),
            deadline: block.timestamp + 15,
            amountIn: amountIn,
            amountOutMinimum: amountOutMin
        });

        // The call to `exactInput` executes the swap.
        amountOut = swapRouter.exactInput(params);
    }

    function _mapCollateralToCurveIndex(address collateral) internal view returns (int128) {
        if (collateral == dai) {
            return 1;
        }
        if (collateral == usdc) {
            return 2;
        }
        if (collateral == usdt) {
            return 3;
        }
        return 0;
    }

    function getMinimumReceived(address collateral, uint amount) external view returns (uint minReceived) {
        if (_mapCollateralToCurveIndex(collateral) > 0) {
            minReceived = (amount * (ONE - maxAllowedPegSlippagePercentage)) / ONE;
        } else {
            uint currentCollateralPrice = priceFeed.rateForCurrency(priceFeedKeyPerCollateral[collateral]);
            minReceived = (((amount * currentCollateralPrice) / ONE) * (ONE - maxAllowedPegSlippagePercentage)) / ONE;
        }
    }

    /// @notice setSupportedCollateral
    function setSupportedCollateral(address collateral, bool supported) external onlyOwner {
        collateralSupported[collateral] = supported;
    }

    /// @notice setSupportedAMM
    function setSupportedAMM(address amm, bool supported) external onlyOwner {
        ammsSupported[amm] = supported;
    }

    /// @notice setWETH
    function setWETH(address _weth) external onlyOwner {
        WETH9 = _weth;
    }

    /// @notice setUSD
    function setUSD(address _usd) external onlyOwner {
        sUSD = IERC20Upgradeable(_usd);
    }

    /// @notice setSwapRouter
    function setSwapRouter(address _router) external onlyOwner {
        swapRouter = ISwapRouter(_router);
    }

    /// @notice setUniswapFactory
    function setUniswapFactory(address _factory) external onlyOwner {
        uniswapFactory = IUniswapV3Factory(_factory);
    }

    /// @notice setUniswapFactory
    function setQuoter(address _quoter) external onlyOwner {
        quoter = IQuoter(_quoter);
    }

    /// @notice Updates contract parametars
    /// @param _curveSUSD curve sUSD pool exchanger contract
    /// @param _dai DAI address
    /// @param _usdc USDC address
    /// @param _usdt USDT addresss
    /// @param _curveOnrampEnabled whether AMM supports curve onramp
    /// @param _maxAllowedPegSlippagePercentage maximum discount AMM accepts for sUSD purchases
    function setCurveSUSD(
        address _curveSUSD,
        address _dai,
        address _usdc,
        address _usdt,
        bool _curveOnrampEnabled,
        uint _maxAllowedPegSlippagePercentage
    ) external onlyOwner {
        curveSUSD = ICurveSUSD(_curveSUSD);
        dai = _dai;
        usdc = _usdc;
        usdt = _usdt;
        IERC20Upgradeable(dai).approve(_curveSUSD, type(uint256).max);
        IERC20Upgradeable(usdc).approve(_curveSUSD, type(uint256).max);
        IERC20Upgradeable(usdt).approve(_curveSUSD, type(uint256).max);
        // not needed unless selling into different collateral is enabled
        //sUSD.approve(_curveSUSD, type(uint256).max);
        curveOnrampEnabled = _curveOnrampEnabled;
        maxAllowedPegSlippagePercentage = _maxAllowedPegSlippagePercentage;
    }
}

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

    IERC20Upgradeable public sUSD;

    mapping(address => bool) public collateralSupported;

    mapping(address => bool) public ammsSupported;

    ISwapRouter public swapRouter;

    IPriceFeed public priceFeed;

    address public WETH9;
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

    /// @notice use the collateral and collateralAmount to buy sUSD
    /// @return convertedAmount The amount of sUSD received.
    function onramp(address collateral, uint collateralAmount)
        external
        nonReentrant
        notPaused
        returns (uint convertedAmount)
    {
        require(collateralSupported[collateral], "Unsupported collateral");
        require(ammsSupported[msg.sender], "Unsupported caller");

        IERC20Upgradeable(collateral).safeTransferFrom(msg.sender, address(this), collateralAmount);

        // use direct path for WETH
        if (collateral == WETH9) {
            convertedAmount = _swapExactSingle(collateralAmount, collateral);
        } else if (curveOnrampEnabled && (collateral == usdc || collateral == dai || collateral == usdt)) {
            // for stable coins use Curve
            convertedAmount = _swapViaCurve(collateral, collateralAmount);
        } else {
            // use a path over WETH pools for other ammsSupported collaterals (OP, ARB)
            convertedAmount = _swapExactInput(collateralAmount, collateral);
        }
        sUSD.safeTransfer(msg.sender, convertedAmount);

        emit Onramped(collateral, collateralAmount);
    }

    /// @notice use native eth as a collateral to buy sUSD
    /// @return convertedAmount The amount of sUSD received.
    function onrampWithEth(uint amount) external payable nonReentrant notPaused returns (uint convertedAmount) {
        require(msg.value > 0, "Can not exchange 0 ETH");
        require(msg.value >= amount, "Amount ETH has to be larger than specified amount");

        WethLike(WETH9).deposit{value: amount}();

        require(IERC20Upgradeable(WETH9).balanceOf(address(this)) == amount);

        convertedAmount = _swapExactSingle(amount, WETH9);

        sUSD.safeTransfer(msg.sender, convertedAmount);

        emit OnrampedEth(amount);
    }

    ///////////////////////Curve related code///////////////////
    function _swapViaCurve(address collateral, uint collateralQuote) internal returns (uint256 amountOut) {
        int128 curveIndex = _mapCollateralToCurveIndex(collateral);
        require(curveIndex > 0 && curveOnrampEnabled, "unsupported collateral");

        amountOut = curveSUSD.exchange_underlying(
            curveIndex,
            0,
            collateralQuote,
            getMinimumReceived(collateral, collateralQuote) // the minimum received is predefined
        );

        uint transformedCollateralForPegCheck = collateral == usdc || collateral == usdt
            ? collateralQuote * (1e12)
            : collateralQuote;

        // ensure the amount received is withing allowed range per maxAllowedPegSlippagePercentage
        require(
            amountOut <= (transformedCollateralForPegCheck * (ONE + maxAllowedPegSlippagePercentage)) / ONE,
            "Amount above max allowed peg slippage"
        );
    }

    ///////////////////////UNISWAP related code///////////////////

    function _swapExactSingle(uint256 amountIn, address tokenIn) internal returns (uint256 amountOut) {
        // Approve the router to spend tokenIn.
        IERC20Upgradeable(tokenIn).approve(address(swapRouter), amountIn);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: address(sUSD),
            fee: 3000,
            recipient: address(this),
            deadline: block.timestamp + 15,
            amountIn: amountIn,
            amountOutMinimum: getMinimumReceived(tokenIn, amountIn),
            sqrtPriceLimitX96: 0
        });

        // The call to `exactInputSingle` executes the swap.
        amountOut = swapRouter.exactInputSingle(params);

        uint currentCollateralPrice = priceFeed.rateForCurrency(priceFeedKeyPerCollateral[tokenIn]);
        require(currentCollateralPrice > 0, "price of collateral unknown");
        uint expectedAmountOut = (amountIn * currentCollateralPrice) / ONE;

        // ensure the amount received is withing allowed range per maxAllowedPegSlippagePercentage
        require(
            amountOut <= (expectedAmountOut * (ONE + (maxAllowedPegSlippagePercentage))) / ONE,
            "Amount above max allowed peg slippage"
        );
    }

    /// @notice _swapExactInput swaps a fixed amount of tokenIn for a maximum possible amount of tokenOut
    /// @param amountIn The exact amount of tokenIn that will be swapped for tokenOut.
    /// @param tokenIn Address of first token
    /// @return amountOut The amount of tokenOut received.
    function _swapExactInput(uint256 amountIn, address tokenIn) internal returns (uint256 amountOut) {
        IERC20Upgradeable(tokenIn).approve(address(swapRouter), amountIn);

        bytes memory pathToUse = pathPerCollateral[tokenIn];
        if (pathToUse.length == 0) {
            uint24 fee = 3000;
            pathToUse = abi.encodePacked(address(tokenIn), fee, WETH9, fee, address(sUSD));
        }

        // Multiple pool swaps are encoded through bytes called a `path`. A path is a sequence of token addresses and poolFees that define the pools used in the swaps.
        ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
            path: pathToUse,
            recipient: address(this),
            deadline: block.timestamp + 15,
            amountIn: amountIn,
            amountOutMinimum: getMinimumReceived(tokenIn, amountIn)
        });

        // The call to `exactInput` executes the swap.
        amountOut = swapRouter.exactInput(params);

        uint currentCollateralPrice = priceFeed.rateForCurrency(priceFeedKeyPerCollateral[tokenIn]);
        require(currentCollateralPrice > 0, "price of collateral unknown");

        uint expectedAmountOut = (amountIn * currentCollateralPrice) / ONE;

        require(
            amountOut <= (expectedAmountOut * (ONE + (maxAllowedPegSlippagePercentage))) / ONE,
            "Amount above max allowed peg slippage"
        );
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

    /////////// read methods

    /// @notice return the guaranteed payout for the given collateral and amount
    function getMinimumReceived(address collateral, uint amount) public view returns (uint minReceived) {
        if (_mapCollateralToCurveIndex(collateral) > 0) {
            uint transformedCollateralForPegCheck = collateral == usdc || collateral == usdt ? amount * (1e12) : amount;
            minReceived = (transformedCollateralForPegCheck * (ONE - maxAllowedPegSlippagePercentage)) / ONE;
        } else {
            uint currentCollateralPrice = priceFeed.rateForCurrency(priceFeedKeyPerCollateral[collateral]);
            minReceived = (((amount * currentCollateralPrice) / ONE) * (ONE - maxAllowedPegSlippagePercentage)) / ONE;
        }
    }

    //////////////// setters

    /// @notice setSupportedCollateral which can be used for onramp
    function setSupportedCollateral(address collateral, bool supported) external onlyOwner {
        collateralSupported[collateral] = supported;
        emit SetSupportedCollateral(collateral, supported);
    }

    /// @notice setSupportedAMM which can call the onramp method
    function setSupportedAMM(address amm, bool supported) external onlyOwner {
        ammsSupported[amm] = supported;
        emit SetSupportedAMM(amm, supported);
    }

    /// @notice setWETH
    function setWETH(address _weth) external onlyOwner {
        WETH9 = _weth;
        emit SetWETH(_weth);
    }

    /// @notice setUSD
    function setSUSD(address _usd) external onlyOwner {
        sUSD = IERC20Upgradeable(_usd);
        emit SetSUSD(_usd);
    }

    /// @notice setSwapRouter
    function setSwapRouter(address _router) external onlyOwner {
        swapRouter = ISwapRouter(_router);
        emit SetSwapRouter(_router);
    }

    /// @notice setPriceFeed
    function setPriceFeed(address _priceFeed) external onlyOwner {
        priceFeed = IPriceFeed(_priceFeed);
        emit SetPriceFeed(_priceFeed);
    }

    function setPriceFeedKeyPerAsset(bytes32 key, address asset) external onlyOwner {
        priceFeedKeyPerCollateral[asset] = key;
        emit SetPriceFeedKeyPerAsset(key, asset);
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
        curveOnrampEnabled = _curveOnrampEnabled;
        maxAllowedPegSlippagePercentage = _maxAllowedPegSlippagePercentage;
        emit CurveSUSDSet(_curveSUSD, _dai, _usdc, _usdt, _curveOnrampEnabled, _maxAllowedPegSlippagePercentage);
    }

    ////////////////events
    event CurveSUSDSet(
        address _curveSUSD,
        address _dai,
        address _usdc,
        address _usdt,
        bool _curveOnrampEnabled,
        uint _maxAllowedPegSlippagePercentage
    );
    event SetPriceFeedKeyPerAsset(bytes32 key, address asset);
    event SetPriceFeed(address _priceFeed);
    event SetSwapRouter(address _router);
    event SetSUSD(address _usd);
    event SetWETH(address _weth);
    event SetSupportedAMM(address amm, bool supported);
    event SetSupportedCollateral(address collateral, bool supported);
    event Onramped(address collateral, uint amount);
    event OnrampedEth(uint amount);
}

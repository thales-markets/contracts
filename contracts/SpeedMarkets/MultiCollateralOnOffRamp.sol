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
import "../interfaces/IPositionalMarketManagerTruncated.sol";

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

    IPositionalMarketManagerTruncated public manager;

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
        //TODO: not needed as we can set path for a direct swap
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
        require(ammsSupported[msg.sender], "Unsupported caller");
        require(msg.value > 0 && amount > 0, "Can not exchange 0 ETH");
        require(msg.value >= amount, "Amount ETH has to be larger than specified amount");

        uint balanceBefore = IERC20Upgradeable(WETH9).balanceOf(address(this));
        WethLike(WETH9).deposit{value: amount}();

        uint balanceDiff = IERC20Upgradeable(WETH9).balanceOf(address(this)) - balanceBefore;
        require(balanceDiff == amount, "Not enough WETH received");

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

        // ensure the amount received is withing allowed range per maxAllowedPegSlippagePercentage
        require(amountOut <= getMaximumReceived(collateral, collateralQuote), "Amount above max allowed peg slippage");
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

        // ensure the amount received is withing allowed range per maxAllowedPegSlippagePercentage
        require(amountOut <= getMaximumReceived(tokenIn, amountIn), "Amount above max allowed peg slippage");
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

        // ensure the amount received is withing allowed range per maxAllowedPegSlippagePercentage
        require(amountOut <= getMaximumReceived(tokenIn, amountIn), "Amount above max allowed peg slippage");
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
        if (address(manager) != address(0)) {
            minReceived = manager.transformCollateral(minReceived);
        }
    }

    function getMinimumNeeded(address collateral, uint amount) public view returns (uint minNeeded) {
        //TODO return minimum amount of collateral needed to receive amount of target
        if (_mapCollateralToCurveIndex(collateral) > 0) {
            uint transformedCollateralForPegCheck = collateral == usdc || collateral == usdt ? amount * (1e12) : amount;
            minNeeded = (transformedCollateralForPegCheck * (ONE + maxAllowedPegSlippagePercentage)) / ONE;
        } else {
            uint currentCollateralPrice = priceFeed.rateForCurrency(priceFeedKeyPerCollateral[collateral]);
            minNeeded = (((amount * currentCollateralPrice) / ONE) * (ONE + maxAllowedPegSlippagePercentage)) / ONE;
        }
        if (address(manager) != address(0)) {
            minNeeded = manager.transformCollateral(minNeeded);
        }
    }

    /// @notice return the guaranteed largest payout for the given collateral and amount
    function getMaximumReceived(address collateral, uint amount) public view returns (uint maxReceived) {
        if (_mapCollateralToCurveIndex(collateral) > 0) {
            uint transformedCollateralForPegCheck = collateral == usdc || collateral == usdt ? amount * (1e12) : amount;
            maxReceived = (transformedCollateralForPegCheck * (ONE + maxAllowedPegSlippagePercentage)) / ONE;
        } else {
            uint currentCollateralPrice = priceFeed.rateForCurrency(priceFeedKeyPerCollateral[collateral]);
            maxReceived = (((amount * currentCollateralPrice) / ONE) * (ONE + maxAllowedPegSlippagePercentage)) / ONE;
        }
        if (address(manager) != address(0)) {
            maxReceived = manager.transformCollateral(maxReceived);
        }
    }

    /// @notice utility method to pack best path
    function getEncodedPacked(
        address inToken,
        uint24 feeIn,
        address proxy,
        uint24 feeOut,
        address target
    ) external view returns (bytes memory encoded) {
        if (proxy != address(0)) {
            encoded = abi.encodePacked(inToken, feeIn, proxy, feeOut, target);
        } else {
            encoded = abi.encodePacked(inToken, feeOut, target);
        }
    }

    //////////////// setters

    /// @notice setSupportedCollateral which can be used for onramp
    function setSupportedCollateral(address collateral, bool supported) external onlyOwner {
        require(collateral != address(0), "Can not set a zero address!");
        collateralSupported[collateral] = supported;
        emit SetSupportedCollateral(collateral, supported);
    }

    /// @notice setSupportedAMM which can call the onramp method
    function setSupportedAMM(address amm, bool supported) external onlyOwner {
        require(amm != address(0), "Can not set a zero address!");
        ammsSupported[amm] = supported;
        emit SetSupportedAMM(amm, supported);
    }

    /// @notice setWETH
    function setWETH(address _weth) external onlyOwner {
        require(_weth != address(0), "Can not set a zero address!");
        WETH9 = _weth;
        emit SetWETH(_weth);
    }

    /// @notice setUSD
    function setSUSD(address _usd) external onlyOwner {
        require(_usd != address(0), "Can not set a zero address!");
        sUSD = IERC20Upgradeable(_usd);
        emit SetSUSD(_usd);
    }

    /// @notice setSwapRouter
    function setSwapRouter(address _router) external onlyOwner {
        require(_router != address(0), "Can not set a zero address!");
        swapRouter = ISwapRouter(_router);
        emit SetSwapRouter(_router);
    }

    /// @notice setPriceFeed
    function setPriceFeed(address _priceFeed) external onlyOwner {
        require(_priceFeed != address(0), "Can not set a zero address!");
        priceFeed = IPriceFeed(_priceFeed);
        emit SetPriceFeed(_priceFeed);
    }

    /// @notice map a key to an asset for price feed
    function setPriceFeedKeyPerAsset(bytes32 key, address asset) external onlyOwner {
        require(asset != address(0), "Can not set a zero address!");
        priceFeedKeyPerCollateral[asset] = key;
        emit SetPriceFeedKeyPerAsset(key, asset);
    }

    /// @notice map a path for a given collateral
    function setPathPerCollateral(
        address asset,
        bytes calldata path,
        bool doReset
    ) external onlyOwner {
        require(asset != address(0), "Can not set a zero address!");
        if (doReset) {
            bytes memory resetVar;
            pathPerCollateral[asset] = resetVar;
        } else {
            pathPerCollateral[asset] = path;
        }
        emit SetPathPerCollateral(asset, path, doReset);
    }

    /// @notice set manager to use collateral transformations as needed
    function setManager(address _manager) external onlyOwner {
        require(_manager != address(0), "Can not set a zero address!");
        manager = IPositionalMarketManagerTruncated(_manager);
        emit ManagerChanged(_manager);
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
        require(_curveSUSD != address(0), "Can not set a zero address!");
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
    event ManagerChanged(address manager);
    event SetPathPerCollateral(address asset, bytes path, bool doReset);
}

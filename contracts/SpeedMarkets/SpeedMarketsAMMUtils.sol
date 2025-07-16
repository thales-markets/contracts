// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "../interfaces/IAddressManager.sol";
import "../interfaces/IPriceFeed.sol";
import "../interfaces/ISpeedMarketsAMM.sol";

interface IERC20Decimals {
    function decimals() external view returns (uint);
}

/// @title An AMM utils for Thales speed markets
contract SpeedMarketsAMMUtils is Initializable, ProxyOwned, ProxyPausable {
    error UnauthorizedCollateralKeySetter();
    error CollateralNotSupportedOnPriceFeed();
    error InvalidCollateralDecimals();

    uint private constant SECONDS_PER_MINUTE = 60;
    uint private constant ONE = 1e18;

    IAddressManager private addressManager;

    /// @notice Mapping from collateral address to collateral key
    mapping(address => bytes32) public collateralKey;

    function initialize(address _owner, IAddressManager _addressManager) external initializer {
        setOwner(_owner);
        addressManager = _addressManager;
    }

    /// @notice get dynamic fee based on defined time thresholds for a given delta time
    /// @param _deltaTimeSec to search for appropriate time range (in seconds)
    /// @param _timeThresholds array of time thresholds for each fee (in minutes)
    /// @param _fees array of fees for every time range
    /// @param _defaultFee if _deltaTime doesn't have appropriate time range return this value
    /// @return fee defined for specific time range to which _deltaTime belongs to
    function getFeeByTimeThreshold(
        uint64 _deltaTimeSec,
        uint[] calldata _timeThresholds,
        uint[] calldata _fees,
        uint _defaultFee
    ) external pure returns (uint fee) {
        fee = _defaultFee;
        uint _deltaTime = _deltaTimeSec / SECONDS_PER_MINUTE;
        for (uint i = _timeThresholds.length; i > 0; i--) {
            if (_deltaTime >= _timeThresholds[i - 1]) {
                fee = _fees[i - 1];
                break;
            }
        }
    }

    /// @notice Set collateral key for a given collateral address
    /// @param _collateral The collateral address
    /// @param _key The collateral key
    function setCollateralKey(address _collateral, bytes32 _key) external {
        if (msg.sender != addressManager.getAddress("SpeedMarketsAMM") && msg.sender != owner)
            revert UnauthorizedCollateralKeySetter();
        uint price = _getCollateralPriceInUSD(_collateral);
        if (price == 0) revert CollateralNotSupportedOnPriceFeed();
        if (IERC20Decimals(_collateral).decimals() == 0) revert InvalidCollateralDecimals();
        collateralKey[_collateral] = _key;
        emit CollateralKeySet(_collateral, _key);
    }

    /// @notice return the price of the pool collateral
    function getCollateralPriceInUSD(address _collateral) external view returns (uint) {
        return _getCollateralPriceInUSD(_collateral);
    }

    /// @notice return the price of the pool collateral
    function _getCollateralPriceInUSD(address _collateral) internal view returns (uint) {
        return IPriceFeed(addressManager.getAddress("PriceFeed")).rateForCurrency(collateralKey[_collateral]);
    }

    function transformCollateralToUSD(
        address _collateral,
        address defaultCollateral,
        uint _amount
    ) external view returns (uint) {
        uint price = _getCollateralPriceInUSD(_collateral);
        uint defaultCollateralDecimals = IERC20Decimals(defaultCollateral).decimals();
        if (price == 0) revert CollateralNotSupportedOnPriceFeed();
        if (IERC20Decimals(_collateral).decimals() == 0) revert InvalidCollateralDecimals();
        return _transformToUSD(_amount, price, IERC20Decimals(_collateral).decimals(), defaultCollateralDecimals);
    }

    function _transformToUSD(
        uint _amountInCollateral,
        uint _collateralPriceInUSD,
        uint _collateralDecimals,
        uint _defaultCollateralDecimals
    ) internal pure returns (uint amountInUSD) {
        amountInUSD = _mulWithDecimals(_amountInCollateral, _collateralPriceInUSD);
        if (_collateralDecimals < _defaultCollateralDecimals) {
            amountInUSD = amountInUSD * 10**(_defaultCollateralDecimals - _collateralDecimals);
        } else if (_collateralDecimals > _defaultCollateralDecimals) {
            amountInUSD = amountInUSD / 10**(_collateralDecimals - _defaultCollateralDecimals);
        }
    }

    function _mulWithDecimals(uint _firstMul, uint _secondMul) internal pure returns (uint) {
        return (_firstMul * _secondMul) / ONE;
    }

    event CollateralKeySet(address indexed collateral, bytes32 key);
}

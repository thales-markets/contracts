// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

import "../interfaces/IAddressManager.sol";
import "../interfaces/ISpeedMarketsAMM.sol";
import "../interfaces/IMultiCollateralOnOffRamp.sol";
import "../interfaces/IChainedSpeedMarketsAMM.sol";
import "../interfaces/IFreeBetsHolder.sol";
import "../interfaces/IChainlinkVerifierProxy.sol";
import "../interfaces/IChainlinkFeeManager.sol";
import "../interfaces/IWeth.sol";

import "./SpeedMarket.sol";
import "./ChainedSpeedMarket.sol";
import "./ChainlinkStructs.sol";

/// @title An AMM for Overtime Speed Markets
contract SpeedMarketsAMMResolver is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint private constant ONE = 1e18;
    int192 private constant PRICE_DIVISOR = 1e10;
    uint private constant MAX_APPROVAL = type(uint256).max;

    /// ========== Custom Errors ==========
    error InvalidWhitelistAddress();
    error OnlyMarketOwner();
    error EtherTransferFailed();
    error MismatchedLengths();
    error CollateralNotSupported();
    error InvalidOffRampCollateral();
    error CanNotResolve();
    error InvalidPrice();
    error InvalidPriceTime();
    error InvalidPriceFeedId();
    error MulticollateralOnrampDisabled();

    /// @return The address of the address manager contract
    IAddressManager public addressManager;
    ISpeedMarketsAMM public speedMarketsAMM;
    IChainedSpeedMarketsAMM public chainedSpeedMarketsAMM;

    receive() external payable {}

    function initialize(
        address _owner,
        address _speedMarketsAMM,
        address _addressManager
    ) external initializer {
        setOwner(_owner);
        speedMarketsAMM = ISpeedMarketsAMM(_speedMarketsAMM);
        addressManager = IAddressManager(_addressManager);
        chainedSpeedMarketsAMM = IChainedSpeedMarketsAMM(addressManager.getAddress("ChainedSpeedMarketsAMM"));
        address multiCollateralAddress = addressManager.multiCollateralOnOffRamp();
        if (multiCollateralAddress != address(0)) {
            speedMarketsAMM.sUSD().approve(multiCollateralAddress, MAX_APPROVAL);
            chainedSpeedMarketsAMM.sUSD().approve(multiCollateralAddress, MAX_APPROVAL);
        }
        initNonReentrant();
    }

    /// ========== EXTERNAL FUNCTIONS ==========

    /// @notice resolveMarket resolves an active market
    /// @param market address of the market
    /// @param priceUpdateData price update data
    /// @dev priceUpdateData is an array of bytes, each element is a price update data for a market
    function resolveMarket(address market, bytes[] calldata priceUpdateData) external payable nonReentrant notPaused {
        _resolveMarket(market, priceUpdateData);
    }

    /// @notice resolveMarket resolves an active market with offramp
    /// @param market address of the market
    /// @param priceUpdateData price update data
    /// @param collateral collateral address
    /// @param toEth whether to offramp to ETH
    /// @dev priceUpdateData is an array of bytes, each element is a price update data for a market
    function resolveMarketWithOfframp(
        address market,
        bytes[] calldata priceUpdateData,
        address collateral,
        bool toEth
    ) external payable nonReentrant notPaused {
        if (!speedMarketsAMM.multicollateralEnabled()) revert MulticollateralOnrampDisabled();
        _resolveMarketWithOfframp(market, priceUpdateData, collateral, toEth);
    }

    /// @notice resolveMarkets in a batch
    /// @param markets array of market addresses
    /// @param priceUpdateData array of price update data
    /// @dev priceUpdateData is an array of bytes, each element is a price update data for a market
    function resolveMarketsBatch(address[] calldata markets, bytes[] calldata priceUpdateData)
        external
        payable
        nonReentrant
        notPaused
    {
        for (uint i; i < markets.length; ++i) {
            if (speedMarketsAMM.canResolveMarket(markets[i])) {
                bytes[] memory subarray = new bytes[](1);
                subarray[0] = priceUpdateData[i];
                _resolveMarket(markets[i], subarray);
            }
        }
    }

    /// @notice resolveMarkets in a batch
    /// @param markets array of market addresses
    /// @param priceUpdateData array of price update data
    /// @param collateral collateral address
    /// @param toEth whether to offramp to ETH
    /// @dev priceUpdateData is an array of bytes, each element is a price update data for a market
    function resolveMarketsBatchOffRamp(
        address[] calldata markets,
        bytes[] calldata priceUpdateData,
        address collateral,
        bool toEth
    ) external payable nonReentrant notPaused {
        if (!speedMarketsAMM.multicollateralEnabled()) revert MulticollateralOnrampDisabled();
        for (uint i; i < markets.length; ++i) {
            if (speedMarketsAMM.canResolveMarket(markets[i])) {
                bytes[] memory subarray = new bytes[](1);
                subarray[0] = priceUpdateData[i];
                _resolveMarketWithOfframp(markets[i], subarray, collateral, toEth);
            }
        }
    }

    /// @notice admin resolve market for a given market address with finalPrice
    /// @param _market market address
    /// @param _finalPrice final price
    function resolveMarketManually(address _market, int64 _finalPrice) external {
        if (!speedMarketsAMM.whitelistedAddresses(msg.sender)) revert InvalidWhitelistAddress();
        _resolveMarketManually(_market, _finalPrice);
    }

    /// @notice admin resolve for a given markets with finalPrices
    /// @param markets array of market addresses
    /// @param finalPrices array of final prices
    function resolveMarketManuallyBatch(address[] calldata markets, int64[] calldata finalPrices) external {
        if (!speedMarketsAMM.whitelistedAddresses(msg.sender)) revert InvalidWhitelistAddress();
        uint len = markets.length;
        for (uint i; i < len; ++i) {
            address market = markets[i];
            if (speedMarketsAMM.canResolveMarket(market)) {
                _resolveMarketManually(market, finalPrices[i]);
            }
        }
    }

    /**
     * @notice Withdraw all balance of an ERC-20 token held by this contract.
     * @param _destination Address that receives the tokens.
     * @param _collateral  ERC-20 token address.
     * @param _amount      ERC-20 token amount.
     */
    function transferAmount(
        address _destination,
        address _collateral,
        uint256 _amount
    ) external onlyOwner {
        IERC20Upgradeable(_collateral).safeTransfer(_destination, _amount);
        emit AmountTransfered(_collateral, _destination, _amount);
    }

    /// ========== INTERNAL FUNCTIONS ==========

    function _verifyChainlinkReport(bytes memory unverifiedReport)
        internal
        returns (ChainlinkStructs.ReportV3 memory verifiedReport)
    {
        IChainlinkVerifierProxy iChainlinkVerifier = IChainlinkVerifierProxy(
            address(addressManager.getAddress("ChainlinkVerifier"))
        );

        IChainlinkFeeManager iChainlinkFeeManager = IChainlinkFeeManager(address(iChainlinkVerifier.s_feeManager()));

        bytes memory parameterPayload;
        if (address(iChainlinkFeeManager) != address(0)) {
            // FeeManager exists — always quote & approve
            address feeToken = iChainlinkFeeManager.i_nativeAddress();

            (, bytes memory reportData) = abi.decode(unverifiedReport, (bytes32[3], bytes));

            (Common.Asset memory fee, , ) = iChainlinkFeeManager.getFeeAndReward(address(this), reportData, feeToken);

            if (fee.amount > 0) {
                IWeth(feeToken).deposit{value: fee.amount}();
                IERC20Upgradeable(feeToken).approve(address(iChainlinkFeeManager), fee.amount);
            }
            parameterPayload = abi.encode(feeToken);
        } else {
            // No FeeManager deployed on this chain
            parameterPayload = bytes("");
        }

        bytes memory verified = iChainlinkVerifier.verify(unverifiedReport, parameterPayload);
        verifiedReport = abi.decode(verified, (ChainlinkStructs.ReportV3));
    }

    function _getOraclePrice(
        bytes32 _asset,
        uint64 _strikeTime,
        ISpeedMarketsAMM.OracleSource _oracleSource,
        bytes[] memory _priceUpdateData
    ) internal returns (int64 price) {
        uint64 maximumPriceDelayForResolving = speedMarketsAMM.maximumPriceDelayForResolving();

        if (_oracleSource == ISpeedMarketsAMM.OracleSource.Chainlink) {
            ChainlinkStructs.ReportV3 memory verifiedReport = _verifyChainlinkReport(_priceUpdateData[0]);

            bytes32 requiredFeedId = speedMarketsAMM.assetToChainlinkId(_asset);
            if (verifiedReport.feedId != requiredFeedId) {
                revert InvalidPriceFeedId();
            }
            uint64 observationsTimestamp = uint64(verifiedReport.observationsTimestamp);
            if (observationsTimestamp < _strikeTime || observationsTimestamp > _strikeTime + maximumPriceDelayForResolving) {
                revert InvalidPriceTime();
            }
            price = int64(verifiedReport.price / PRICE_DIVISOR); // safe only for assets on 18 decimals (max decimal price: 92,233,720.36854775)
        } else {
            IPyth iPyth = IPyth(addressManager.pyth());
            bytes32[] memory priceIds = new bytes32[](1);
            priceIds[0] = speedMarketsAMM.assetToPythId(_asset);

            PythStructs.PriceFeed[] memory prices = iPyth.parsePriceFeedUpdates{value: iPyth.getUpdateFee(_priceUpdateData)}(
                _priceUpdateData,
                priceIds,
                _strikeTime,
                _strikeTime + maximumPriceDelayForResolving
            );

            PythStructs.Price memory pythPrice = prices[0].price;
            price = pythPrice.price;
        }
    }

    function _resolveMarket(address market, bytes[] memory priceUpdateData) internal {
        if (!speedMarketsAMM.canResolveMarket(market)) revert CanNotResolve();
        SpeedMarket sm = SpeedMarket(market);

        ISpeedMarketsAMM.OracleSource oracleSource;
        try sm.oracleSource() returns (ISpeedMarketsAMM.OracleSource _oracleSource) {
            oracleSource = _oracleSource;
        } catch {
            // Default to Pyth for legacy contracts
            oracleSource = ISpeedMarketsAMM.OracleSource.Pyth;
        }

        int64 price = _getOraclePrice(sm.asset(), sm.strikeTime(), oracleSource, priceUpdateData);
        if (price <= 0) revert InvalidPrice();

        speedMarketsAMM.resolveMarketWithPrice(market, price);
        IFreeBetsHolder iFreeBetsHolder = IFreeBetsHolder(addressManager.getAddress("FreeBetsHolder"));
        if (address(sm.user()) == address(iFreeBetsHolder)) {
            uint buyAmount = sm.buyinAmount();
            if (speedMarketsAMM.supportedNativeCollateral(sm.collateral())) {
                buyAmount = (buyAmount * (ONE + sm.safeBoxImpact() + sm.lpFee())) / ONE;
            }
            iFreeBetsHolder.confirmSpeedMarketResolved(market, sm.payout(), buyAmount, sm.collateral(), false);
        }
    }

    function _resolveMarketWithOfframp(
        address market,
        bytes[] memory priceUpdateData,
        address collateral,
        bool toEth
    ) internal {
        address user = SpeedMarket(market).user();
        if (msg.sender != user) revert OnlyMarketOwner();
        address defaultCollateral = SpeedMarket(market).collateral();
        if (defaultCollateral != address(speedMarketsAMM.sUSD())) revert InvalidOffRampCollateral();
        uint amountBefore = speedMarketsAMM.sUSD().balanceOf(user);
        _resolveMarket(market, priceUpdateData);
        uint amountDiff = speedMarketsAMM.sUSD().balanceOf(user) - amountBefore;
        speedMarketsAMM.offrampHelper(user, amountDiff);
        if (amountDiff > 0) {
            IMultiCollateralOnOffRamp iMultiCollateralOnOffRamp = IMultiCollateralOnOffRamp(
                addressManager.multiCollateralOnOffRamp()
            );
            if (toEth) {
                uint offramped = iMultiCollateralOnOffRamp.offrampIntoEth(amountDiff);
                address payable _to = payable(user);
                bool sent = _to.send(offramped);
                if (!sent) revert EtherTransferFailed();
            } else {
                uint offramped = iMultiCollateralOnOffRamp.offramp(collateral, amountDiff);
                IERC20Upgradeable(collateral).safeTransfer(user, offramped);
            }
        }
    }

    function _resolveMarketManually(address _market, int64 _finalPrice) internal {
        SpeedMarket sm = SpeedMarket(_market);
        SpeedMarket.Direction direction = sm.direction();
        int64 strikePrice = sm.strikePrice();
        bool isUserWinner = (_finalPrice < strikePrice && direction == SpeedMarket.Direction.Down) ||
            (_finalPrice > strikePrice && direction == SpeedMarket.Direction.Up);
        if (!speedMarketsAMM.canResolveMarket(_market) || isUserWinner) revert CanNotResolve();

        speedMarketsAMM.resolveMarketWithPrice(_market, _finalPrice);
        IFreeBetsHolder iFreeBetsHolder = IFreeBetsHolder(addressManager.getAddress("FreeBetsHolder"));
        if (address(sm.user()) == address(iFreeBetsHolder)) {
            uint buyAmount = sm.buyinAmount();
            if (speedMarketsAMM.supportedNativeCollateral(sm.collateral())) {
                buyAmount = (buyAmount * (ONE + sm.safeBoxImpact() + sm.lpFee())) / ONE;
            }
            iFreeBetsHolder.confirmSpeedMarketResolved(_market, sm.payout(), buyAmount, sm.collateral(), false);
        }
    }

    /// ========== CHAINED MARKETS FUNCTIONS ==========

    /// @notice resolveChainedMarket resolves an active chained market
    /// @param market address of the market
    /// @param priceUpdateData price update data for each direction
    /// @dev priceUpdateData is a 2D array where each element contains price update data for a direction
    function resolveChainedMarket(address market, bytes[][] calldata priceUpdateData)
        external
        payable
        nonReentrant
        notPaused
    {
        _resolveChainedMarket(market, priceUpdateData);
    }

    /// @notice resolveChainedMarket resolves an active chained market with offramp
    /// @param market address of the market
    /// @param priceUpdateData price update data for each direction
    /// @param collateral collateral address
    /// @param toEth whether to offramp to ETH
    function resolveChainedMarketWithOfframp(
        address market,
        bytes[][] calldata priceUpdateData,
        address collateral,
        bool toEth
    ) external payable nonReentrant notPaused {
        if (!chainedSpeedMarketsAMM.multicollateralEnabled()) revert MulticollateralOnrampDisabled();
        _resolveChainedMarketWithOfframp(market, priceUpdateData, collateral, toEth);
    }

    /// @notice resolveChainedMarkets in a batch
    /// @param markets array of market addresses
    /// @param priceUpdateData array of price update data for each market
    function resolveChainedMarketsBatch(address[] calldata markets, bytes[][][] calldata priceUpdateData)
        external
        payable
        nonReentrant
        notPaused
    {
        for (uint i; i < markets.length; ++i) {
            if (chainedSpeedMarketsAMM.canResolveMarket(markets[i])) {
                _resolveChainedMarket(markets[i], priceUpdateData[i]);
            }
        }
    }

    /// @notice resolveChainedMarkets in a batch with offramp
    /// @param markets array of market addresses
    /// @param priceUpdateData array of price update data
    /// @param collateral collateral address
    /// @param toEth whether to offramp to ETH
    function resolveChainedMarketsBatchOffRamp(
        address[] calldata markets,
        bytes[][][] calldata priceUpdateData,
        address collateral,
        bool toEth
    ) external payable nonReentrant notPaused {
        if (!chainedSpeedMarketsAMM.multicollateralEnabled()) revert MulticollateralOnrampDisabled();
        for (uint i; i < markets.length; ++i) {
            if (chainedSpeedMarketsAMM.canResolveMarket(markets[i])) {
                _resolveChainedMarketWithOfframp(markets[i], priceUpdateData[i], collateral, toEth);
            }
        }
    }

    /// @notice admin resolve chained market for a given market address with finalPrices
    /// @param _market market address
    /// @param _finalPrices array of final prices for each direction
    function resolveChainedMarketManually(address _market, int64[] calldata _finalPrices) external {
        if (!speedMarketsAMM.whitelistedAddresses(msg.sender)) revert InvalidWhitelistAddress();
        _resolveChainedMarketManually(_market, _finalPrices);
    }

    /// @notice admin resolve for a given chained markets with finalPrices
    /// @param markets array of market addresses
    /// @param finalPrices array of final prices for each market
    function resolveChainedMarketManuallyBatch(address[] calldata markets, int64[][] calldata finalPrices) external {
        if (!speedMarketsAMM.whitelistedAddresses(msg.sender)) revert InvalidWhitelistAddress();
        uint len = markets.length;
        for (uint i; i < len; ++i) {
            address market = markets[i];
            if (chainedSpeedMarketsAMM.canResolveMarket(market)) {
                _resolveChainedMarketManually(market, finalPrices[i]);
            }
        }
    }

    /// ========== INTERNAL CHAINED MARKETS FUNCTIONS ==========

    function _resolveChainedMarket(address market, bytes[][] memory priceUpdateData) internal {
        if (!chainedSpeedMarketsAMM.canResolveMarket(market)) revert CanNotResolve();

        ChainedSpeedMarket cs = ChainedSpeedMarket(market);

        ISpeedMarketsAMM.OracleSource oracleSource;
        try cs.oracleSource() returns (ISpeedMarketsAMM.OracleSource _oracleSource) {
            oracleSource = _oracleSource;
        } catch {
            // Default to Pyth for legacy contracts
            oracleSource = ISpeedMarketsAMM.OracleSource.Pyth;
        }

        int64[] memory prices = new int64[](priceUpdateData.length);
        uint64 strikeTimePerDirection;
        for (uint i; i < priceUpdateData.length; ++i) {
            strikeTimePerDirection = cs.initialStrikeTime() + uint64(i * cs.timeFrame());

            int64 price = _getOraclePrice(cs.asset(), strikeTimePerDirection, oracleSource, priceUpdateData[i]);
            if (price <= 0) revert InvalidPrice();
            prices[i] = price;
        }

        chainedSpeedMarketsAMM.resolveMarketWithPrices(market, prices, false);

        IFreeBetsHolder iFreeBetsHolder = IFreeBetsHolder(addressManager.getAddress("FreeBetsHolder"));
        if (cs.user() == address(iFreeBetsHolder)) {
            uint buyAmount = cs.buyinAmount();
            address collateral = cs.collateral();
            if (speedMarketsAMM.supportedNativeCollateral(collateral)) {
                buyAmount = (buyAmount * (ONE + cs.safeBoxImpact())) / ONE;
            }
            iFreeBetsHolder.confirmSpeedMarketResolved(market, cs.payout(), buyAmount, collateral, true);
        }
    }

    function _resolveChainedMarketWithOfframp(
        address market,
        bytes[][] memory priceUpdateData,
        address collateral,
        bool toEth
    ) internal {
        address user = ChainedSpeedMarket(market).user();
        if (msg.sender != user) revert OnlyMarketOwner();
        IERC20Upgradeable defaultCollateral = IERC20Upgradeable(ChainedSpeedMarket(market).collateral());
        if (address(defaultCollateral) != address(chainedSpeedMarketsAMM.sUSD())) revert InvalidOffRampCollateral();
        uint amountBefore = chainedSpeedMarketsAMM.sUSD().balanceOf(user);
        _resolveChainedMarket(market, priceUpdateData);
        uint amountDiff = chainedSpeedMarketsAMM.sUSD().balanceOf(user) - amountBefore;
        chainedSpeedMarketsAMM.offrampHelper(user, amountDiff);
        if (amountDiff > 0) {
            IMultiCollateralOnOffRamp iMultiCollateralOnOffRamp = IMultiCollateralOnOffRamp(
                addressManager.multiCollateralOnOffRamp()
            );
            if (toEth) {
                uint offramped = iMultiCollateralOnOffRamp.offrampIntoEth(amountDiff);
                address payable _to = payable(user);
                bool sent = _to.send(offramped);
                if (!sent) revert EtherTransferFailed();
            } else {
                uint offramped = iMultiCollateralOnOffRamp.offramp(collateral, amountDiff);
                IERC20Upgradeable(collateral).safeTransfer(user, offramped);
            }
        }
    }

    function _resolveChainedMarketManually(address _market, int64[] calldata _finalPrices) internal {
        // For chained markets, we need to check each direction
        // Manual resolution is only allowed if the user would lose
        ChainedSpeedMarket chainedMarket = ChainedSpeedMarket(_market);
        int64 currentPrice = chainedMarket.initialStrikePrice();
        SpeedMarket.Direction[] memory directions = new SpeedMarket.Direction[](chainedMarket.numOfDirections());

        for (uint i = 0; i < _finalPrices.length; i++) {
            directions[i] = chainedMarket.directions(i);
            bool userLostDirection = (_finalPrices[i] >= currentPrice && directions[i] == SpeedMarket.Direction.Down) ||
                (_finalPrices[i] <= currentPrice && directions[i] == SpeedMarket.Direction.Up);

            if (userLostDirection) {
                // User lost, manual resolution is allowed
                chainedSpeedMarketsAMM.resolveMarketWithPrices(_market, _finalPrices, true);
                IFreeBetsHolder iFreeBetsHolder = IFreeBetsHolder(addressManager.getAddress("FreeBetsHolder"));
                if (address(chainedMarket.user()) == address(iFreeBetsHolder)) {
                    uint buyAmount = chainedMarket.buyinAmount();
                    if (speedMarketsAMM.supportedNativeCollateral(chainedMarket.collateral())) {
                        buyAmount = (buyAmount * (ONE + chainedMarket.safeBoxImpact())) / ONE;
                    }
                    iFreeBetsHolder.confirmSpeedMarketResolved(
                        _market,
                        chainedMarket.payout(),
                        buyAmount,
                        chainedMarket.collateral(),
                        true
                    );
                }
                return;
            }
            currentPrice = _finalPrices[i];
        }

        // If we reach here, user would win - manual resolution not allowed
        revert CanNotResolve();
    }

    /// ========== SETUP FUNCTIONS ==========

    /// @notice Setup approval for multiCollateralOnOffRamp
    /// @param amount The amount to approve (use type(uint256).max for unlimited)
    function setupMultiCollateralApproval(uint amount) external onlyOwner {
        address multiCollateralAddress = addressManager.multiCollateralOnOffRamp();
        if (multiCollateralAddress != address(0)) {
            speedMarketsAMM.sUSD().approve(multiCollateralAddress, amount);
            chainedSpeedMarketsAMM.sUSD().approve(multiCollateralAddress, amount);
        }
        emit SetMulticollateralApproval(amount);
    }

    /// @notice Set chained speed markets AMM address
    /// @param _chainedSpeedMarketsAMM The address of the chained speed markets AMM
    function setChainedSpeedMarketsAMM(address _chainedSpeedMarketsAMM) external onlyOwner {
        chainedSpeedMarketsAMM = IChainedSpeedMarketsAMM(_chainedSpeedMarketsAMM);
        emit ChainedSpeedMarketsAMMSet(_chainedSpeedMarketsAMM);
    }

    event ChainedSpeedMarketsAMMSet(address indexed _chainedSpeedMarketsAMM);
    event SetMulticollateralApproval(uint amount);
    event AmountTransfered(address _destination, address _collateral, uint256 _amount);
}

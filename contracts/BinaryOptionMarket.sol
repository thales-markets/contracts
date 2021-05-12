pragma solidity ^0.5.16;

// Inheritance
import "synthetix-2.43.1/contracts/MinimalProxyFactory.sol";
import "./OwnedWithInit.sol";
import "./interfaces/IBinaryOptionMarket.sol";

// Libraries
import "synthetix-2.43.1/contracts/SafeDecimalMath.sol";

// Internal references
import "./BinaryOptionMarketManager.sol";
import "./BinaryOption.sol";
import "synthetix-2.43.1/contracts/interfaces/IExchangeRates.sol";
import "synthetix-2.43.1/contracts/interfaces/IERC20.sol";
import "synthetix-2.43.1/contracts/interfaces/IFeePool.sol";
import "synthetix-2.43.1/contracts/interfaces/IAddressResolver.sol";

// https://docs.synthetix.io/contracts/source/contracts/binaryoptionmarket
contract BinaryOptionMarket is MinimalProxyFactory, OwnedWithInit, IBinaryOptionMarket {
    /* ========== LIBRARIES ========== */

    using SafeMath for uint;
    using SafeDecimalMath for uint;

    /* ========== TYPES ========== */

    struct Options {
        BinaryOption long;
        BinaryOption short;
    }

    struct Times {
        uint maturity;
        uint expiry;
    }

    struct OracleDetails {
        bytes32 key;
        uint strikePrice;
        uint finalPrice;
    }

    /* ========== STATE VARIABLES ========== */

    Options public options;
    Times public times;
    OracleDetails public oracleDetails;
    BinaryOptionMarketManager.Fees public fees;
    BinaryOptionMarketManager.CreatorLimits public creatorLimits;
    IAddressResolver public resolver;

    // `deposited` tracks the sum of all deposits minus the withheld fees.
    // This must explicitly be kept, in case tokens are transferred to the contract directly.
    uint public deposited;
    uint public initialMint;
    address public creator;
    bool public resolved;

    uint internal _feeMultiplier;

    /* ---------- Address Resolver Configuration ---------- */

    bytes32 internal constant CONTRACT_EXRATES = "ExchangeRates";
    bytes32 internal constant CONTRACT_SYNTHSUSD = "SynthsUSD";
    bytes32 internal constant CONTRACT_FEEPOOL = "FeePool";

    /* ========== CONSTRUCTOR ========== */

    bool public initialized = false;

    function initialize(
        address _owner,
        IAddressResolver _resolver,
        address _creator,
        uint memory _creatorLimits, // [capitalRequirement]
        bytes32 _oracleKey,
        uint _strikePrice,
        uint[2] memory _times, // [maturity, expiry]
        uint memory _deposit, // sUSD deposit
        uint[2] memory _fees // [poolFee, creatorFee]
    ) public {
        require(!initialized, "Binary Option Market already initialized");
        initialized = true;
        initOwner(_owner);
        resolver = _resolver;
        creator = _creator;
        creatorLimits = BinaryOptionMarketManager.CreatorLimits(_creatorLimits[0], _creatorLimits[1]);

        oracleDetails = OracleDetails(_oracleKey, _strikePrice, 0);
        times = Times(_times[0], _times[1]);

        _checkCreatorLimits(_deposit);
        emit Bid(Side.Long, _creator, _deposit);
        emit Bid(Side.Short, _creator, _deposit);

        deposited = _deposit;
        initialMint = _deposit;

        (uint poolFee, uint creatorFee) = (_fees[0], _fees[1]);
        fees = BinaryOptionMarketManager.Fees(poolFee, creatorFee);
        _feeMultiplier = SafeDecimalMath.unit().sub(poolFee.add(creatorFee));

        // Instantiate the options themselves
        options.long = BinaryOption(
            _cloneAsMinimalProxy(_manager().binaryOptionMastercopy(), "Could not create a Binary Option")
        );
        options.short = BinaryOption(
            _cloneAsMinimalProxy(_manager().binaryOptionMastercopy(), "Could not create a Binary Option")
        );
        options.long.initialize(_creator, _deposit, "Binary Option Short", "sLONG");
        options.short.initialize(_creator, _deposit, "Binary Option Long", "sSHORT");

        emit Bid(Side.Long, creator, initialMint);
        emit Bid(Side.Short, creator, initialMint);

        // Note: the ERC20 base contract does not have a constructor, so we do not have to worry
        // about initializing its state separately
    }

    /* ---------- External Contracts ---------- */

    function _exchangeRates() internal view returns (IExchangeRates) {
        return IExchangeRates(resolver.requireAndGetAddress(CONTRACT_EXRATES, "ExchangeRates contract not found"));
    }

    function _sUSD() internal view returns (IERC20) {
        return IERC20(resolver.requireAndGetAddress(CONTRACT_SYNTHSUSD, "SynthsUSD contract not found"));
    }

    function _feePool() internal view returns (IFeePool) {
        return IFeePool(resolver.requireAndGetAddress(CONTRACT_FEEPOOL, "FeePool contract not found"));
    }

    function _manager() internal view returns (BinaryOptionMarketManager) {
        return BinaryOptionMarketManager(owner);
    }

    /* ---------- Phases ---------- */

    function _matured() internal view returns (bool) {
        return times.maturity < now;
    }

    function _expired() internal view returns (bool) {
        return resolved && (times.expiry < now || deposited == 0);
    }

    function phase() external view returns (Phase) {
        if (!_matured()) {
            return Phase.Trading;
        }
        if (!_expired()) {
            return Phase.Maturity;
        }
        return Phase.Expiry;
    }

    /* ---------- Market Resolution ---------- */

    function _oraclePriceAndTimestamp() internal view returns (uint price, uint updatedAt) {
        return _exchangeRates().rateAndUpdatedTime(oracleDetails.key);
    }

    function oraclePriceAndTimestamp() external view returns (uint price, uint updatedAt) {
        return _oraclePriceAndTimestamp();
    }

    function _isFreshPriceUpdateTime(uint timestamp) internal view returns (bool) {
        (uint maxOraclePriceAge, , ) = _manager().durations();
        return (times.maturity.sub(maxOraclePriceAge)) <= timestamp;
    }

    function canResolve() external view returns (bool) {
        (, uint updatedAt) = _oraclePriceAndTimestamp();
        return !resolved && _matured() && _isFreshPriceUpdateTime(updatedAt);
    }

    function _result() internal view returns (Side) {
        uint price;
        if (resolved) {
            price = oracleDetails.finalPrice;
        } else {
            (price, ) = _oraclePriceAndTimestamp();
        }

        return oracleDetails.strikePrice <= price ? Side.Long : Side.Short;
    }

    function result() external view returns (Side) {
        return _result();
    }

    /* ---------- Option Balances and Bids ---------- */

    function _balancesOf(address account) internal view returns (uint long, uint short) {
        return (options.long.balanceOf(account), options.short.balanceOf(account));
    }

    function balancesOf(address account) external view returns (uint long, uint short) {
        return _balancesOf(account);
    }

    function totalSupplies() external view returns (uint long, uint short) {
        return (options.long.totalSupply(), options.short.totalSupply());
    }

    /* ---------- Utilities ---------- */

    function _chooseSide(
        Side side,
        uint longValue,
        uint shortValue
    ) internal pure returns (uint) {
        if (side == Side.Long) {
            return longValue;
        }
        return shortValue;
    }

    function _option(Side side) internal view returns (BinaryOption) {
        if (side == Side.Long) {
            return options.long;
        }
        return options.short;
    }

    // Returns zero if the result would be negative.
    function _subToZero(uint a, uint b) internal pure returns (uint) {
        return a < b ? 0 : a.sub(b);
    }

    function _checkCreatorLimits(uint deposit) internal view {
        require(creatorLimits.capitalRequirement <= deposit, "Insufficient capital");
    }

    function _incrementDeposited(uint value) internal returns (uint _deposited) {
        _deposited = deposited.add(value);
        deposited = _deposited;
        _manager().incrementTotalDeposited(value);
    }

    function _decrementDeposited(uint value) internal returns (uint _deposited) {
        _deposited = deposited.sub(value);
        deposited = _deposited;
        _manager().decrementTotalDeposited(value);
    }

    function _requireManagerNotPaused() internal view {
        require(!_manager().paused(), "This action cannot be performed while the contract is paused");
    }

    function requireUnpaused() external view {
        _requireManagerNotPaused();
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /* ---------- Minting ---------- */

    function mint(uint value) external duringMinting {
        if (value == 0) {
            return;
        }

        uint valueAfterFees = value.multiplyDecimalRound(_feeMultiplier);

        options.long.mint(msg.sender, valueAfterFees);
        options.short.mint(msg.sender, valueAfterFees);
        emit Bid(Side.Long, msg.sender, value);
        emit Bid(Side.Short, msg.sender, value);

        uint _deposited = _incrementDeposited(value);
        _sUSD().transferFrom(msg.sender, address(this), value);
    }

    /* ---------- Market Resolution ---------- */

    function resolve() external onlyOwner afterMaturity managerNotPaused {
        require(!resolved, "Market already resolved");

        // We don't need to perform stale price checks, so long as the price was
        // last updated recently enough before the maturity date.
        (uint price, uint updatedAt) = _oraclePriceAndTimestamp();
        require(_isFreshPriceUpdateTime(updatedAt), "Price is stale");

        oracleDetails.finalPrice = price;
        resolved = true;

        // Now remit any collected fees.
        // Since the constructor enforces that creatorFee + poolFee < 1, the balance
        // in the contract will be sufficient to cover these transfers.
        IERC20 sUSD = _sUSD();

        uint _deposited = deposited;
        uint poolFees = _deposited.sub(initialMint).multiplyDecimalRound(fees.poolFee);
        uint creatorFees = _deposited.sub(initialMint).multiplyDecimalRound(fees.creatorFee);
        _decrementDeposited(creatorFees.add(poolFees));
        sUSD.transfer(_feePool().FEE_ADDRESS(), poolFees);
        sUSD.transfer(creator, creatorFees);

        emit MarketResolved(_result(), price, updatedAt, deposited, poolFees, creatorFees);
    }

    /* ---------- Claiming and Exercising Options ---------- */

    function exerciseOptions() external returns (uint) {
        // The market must be resolved if it has not been.
        if (!resolved) {
            _manager().resolveMarket(address(this));
        }

        // If the account holds no options, revert.
        (uint longBalance, uint shortBalance) = _balancesOf(msg.sender);
        require(longBalance != 0 || shortBalance != 0, "Nothing to exercise");

        // Each option only needs to be exercised if the account holds any of it.
        if (longBalance != 0) {
            options.long.exercise(msg.sender);
        }
        if (shortBalance != 0) {
            options.short.exercise(msg.sender);
        }

        // Only pay out the side that won.
        uint payout = _chooseSide(_result(), longBalance, shortBalance);
        emit OptionsExercised(msg.sender, payout);
        if (payout != 0) {
            _decrementDeposited(payout);
            _sUSD().transfer(msg.sender, payout);
        }
        return payout;
    }

    /* ---------- Market Expiry ---------- */

    function _selfDestruct(address payable beneficiary) internal {
        uint _deposited = deposited;
        if (_deposited != 0) {
            _decrementDeposited(_deposited);
        }

        // Transfer the balance rather than the deposit value in case there are any synths left over
        // from direct transfers.
        IERC20 sUSD = _sUSD();
        uint balance = sUSD.balanceOf(address(this));
        if (balance != 0) {
            sUSD.transfer(beneficiary, balance);
        }

        // Destroy the option tokens before destroying the market itself.
        options.long.expire(beneficiary);
        options.short.expire(beneficiary);
        selfdestruct(beneficiary);
    }

    function expire(address payable beneficiary) external onlyOwner {
        require(_expired(), "Unexpired options remaining");
        _selfDestruct(beneficiary);
    }

    /* ========== MODIFIERS ========== */

    modifier duringMinting() {
        require(!_matured(), "Minting inactive");
        _;
    }

    modifier afterMaturity() {
        require(_matured(), "Not yet mature");
        _;
    }

    modifier managerNotPaused() {
        _requireManagerNotPaused();
        _;
    }

    /* ========== EVENTS ========== */

    event Bid(Side side, address indexed account, uint value);
    event MarketResolved(
        Side result,
        uint oraclePrice,
        uint oracleTimestamp,
        uint deposited,
        uint poolFees,
        uint creatorFees
    );
    event OptionsExercised(address indexed account, uint value);
}

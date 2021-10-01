pragma solidity ^0.5.16;

// Inheritance
import "synthetix-2.43.1/contracts/MinimalProxyFactory.sol";
import "../OwnedWithInit.sol";
import "../interfaces/IBinaryOptionMarket.sol";
import "../interfaces/IOracleInstance.sol";

// Libraries
import "synthetix-2.43.1/contracts/SafeDecimalMath.sol";

// Internal references
import "./BinaryOptionMarketManager.sol";
import "./BinaryOption.sol";
import "synthetix-2.43.1/contracts/interfaces/IExchangeRates.sol";
import "synthetix-2.43.1/contracts/interfaces/IERC20.sol";
import "synthetix-2.43.1/contracts/interfaces/IAddressResolver.sol";

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
        bool customMarket;
        address iOracleInstanceAddress;
    }

    /* ========== STATE VARIABLES ========== */

    Options public options;
    Times public times;
    OracleDetails public oracleDetails;
    BinaryOptionMarketManager.Fees public fees;
    IAddressResolver public resolver;
    IExchangeRates public exchangeRates;

    IOracleInstance public iOracleInstance;
    bool public customMarket;

    // `deposited` tracks the sum of all deposits minus the withheld fees.
    // This must explicitly be kept, in case tokens are transferred to the contract directly.
    uint public deposited;
    uint public accumulatedFees;
    uint public initialMint;
    address public creator;
    bool public resolved;

    uint internal _feeMultiplier;

    /* ---------- Address Resolver Configuration ---------- */

    bytes32 internal constant CONTRACT_EXRATES = "ExchangeRates";
    bytes32 internal constant CONTRACT_SYNTHSUSD = "SynthsUSD";

    /* ========== CONSTRUCTOR ========== */

    bool public initialized = false;

    function initialize(
        address _owner,
        address _binaryOptionMastercopy,
        IAddressResolver _resolver,
        IExchangeRates _exchangeRates,
        address _creator,
        bytes32 _oracleKey,
        uint _strikePrice,
        uint[2] calldata _times, // [maturity, expiry]
        uint _deposit, // sUSD deposit
        uint[2] calldata _fees, // [poolFee, creatorFee]
        bool _customMarket,
        address _iOracleInstanceAddress
    ) external {
        require(!initialized, "Binary Option Market already initialized");
        initialized = true;
        initOwner(_owner);
        resolver = _resolver;
        exchangeRates = _exchangeRates;
        creator = _creator;

        oracleDetails = OracleDetails(_oracleKey, _strikePrice, 0, _customMarket, _iOracleInstanceAddress);
        customMarket = _customMarket;
        iOracleInstance = IOracleInstance(_iOracleInstanceAddress);

        times = Times(_times[0], _times[1]);

        deposited = _deposit;
        initialMint = _deposit;

        (uint poolFee, uint creatorFee) = (_fees[0], _fees[1]);
        fees = BinaryOptionMarketManager.Fees(poolFee, creatorFee);
        _feeMultiplier = SafeDecimalMath.unit().sub(poolFee.add(creatorFee));

        // Instantiate the options themselves
        options.long = BinaryOption(_cloneAsMinimalProxy(_binaryOptionMastercopy, "Could not create a Binary Option"));
        options.short = BinaryOption(_cloneAsMinimalProxy(_binaryOptionMastercopy, "Could not create a Binary Option"));
        // abi.encodePacked("sLONG: ", _oracleKey)
        // consider naming the option: sLongBTC>50@2021.12.31
        options.long.initialize("Binary Option Long", "sLONG");
        options.short.initialize("Binary Option Short", "sSHORT");
        _mint(creator, initialMint);

        // Note: the ERC20 base contract does not have a constructor, so we do not have to worry
        // about initializing its state separately
    }

    /* ---------- External Contracts ---------- */

    function _exchangeRates() internal view returns (IExchangeRates) {
        return exchangeRates;
    }

    function _sUSD() internal view returns (IERC20) {
        return IERC20(resolver.requireAndGetAddress(CONTRACT_SYNTHSUSD, "SynthsUSD contract not found"));
    }

    function _manager() internal view returns (BinaryOptionMarketManager) {
        return BinaryOptionMarketManager(owner);
    }

    /* ---------- Phases ---------- */

    function _matured() internal view returns (bool) {
        return times.maturity < block.timestamp;
    }

    function _expired() internal view returns (bool) {
        return resolved && (times.expiry < block.timestamp || deposited == 0);
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

    function canResolve() public view returns (bool) {
        if (customMarket) {
            return !resolved && _matured() && iOracleInstance.resolvable();
        } else {
            (, uint updatedAt) = _oraclePriceAndTimestamp();
            return !resolved && _matured() && _isFreshPriceUpdateTime(updatedAt);
        }
    }

    function _result() internal view returns (Side) {
        if (customMarket) {
            return iOracleInstance.getOutcome() ? Side.Long : Side.Short;
        } else {
            uint price;
            if (resolved) {
                price = oracleDetails.finalPrice;
            } else {
                (price, ) = _oraclePriceAndTimestamp();
            }

            return oracleDetails.strikePrice <= price ? Side.Long : Side.Short;
        }
    }

    function result() external view returns (Side) {
        return _result();
    }

    /* ---------- Option Balances and Mints ---------- */

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
        uint deductedFees = value.sub(valueAfterFees);
        accumulatedFees = accumulatedFees.add(deductedFees);

        _mint(msg.sender, valueAfterFees);

        _incrementDeposited(value);
        _manager().transferSusdTo(msg.sender, address(this), value);
    }

    function _mint(address minter, uint amount) internal {
        options.long.mint(minter, amount);
        options.short.mint(minter, amount);

        emit Mint(Side.Long, minter, amount);
        emit Mint(Side.Short, minter, amount);
    }

    /* ---------- Custom oracle configuration ---------- */
    function setIOracleInstance(address _address) external onlyOwner {
        iOracleInstance = IOracleInstance(_address);
    }

    /* ---------- Market Resolution ---------- */

    function resolve() external onlyOwner afterMaturity managerNotPaused {
        require(canResolve(), "Can not resolve market");

        (uint price, uint updatedAt) = _oraclePriceAndTimestamp();
        if (!customMarket) {
            oracleDetails.finalPrice = price;
        }
        resolved = true;

        // Now remit any collected fees.
        // Since the constructor enforces that creatorFee + poolFee < 1, the balance
        // in the contract will be sufficient to cover these transfers.
        IERC20 sUSD = _sUSD();

        uint totalFeesRatio = fees.poolFee.add(fees.creatorFee);
        uint poolFeesRatio = fees.poolFee.divideDecimalRound(totalFeesRatio);
        uint poolFees = poolFeesRatio.multiplyDecimalRound(accumulatedFees);
        uint creatorFees = accumulatedFees.sub(poolFees);
        _decrementDeposited(creatorFees.add(poolFees));
        sUSD.transfer(_manager().feeAddress(), poolFees);
        sUSD.transfer(creator, creatorFees);

        emit MarketResolved(_result(), price, updatedAt, deposited, poolFees, creatorFees);
    }

    /* ---------- Claiming and Exercising Options ---------- */

    function exerciseOptions() external afterMaturity returns (uint) {
        // The market must be resolved if it has not been.
        // the first one to exercise pays the gas fees. Might be worth splitting it up.
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
        uint payout = (_result() == Side.Long) ? longBalance : shortBalance;
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

    event Mint(Side side, address indexed account, uint value);
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

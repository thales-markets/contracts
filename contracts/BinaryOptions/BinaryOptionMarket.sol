pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

// Inheritance
import "../OwnedWithInit.sol";
import "../interfaces/IBinaryOptionMarket.sol";
import "../interfaces/IOracleInstance.sol";

// Libraries
import "synthetix-2.50.4-ovm/contracts/SafeDecimalMath.sol";

// Internal references
import "./BinaryOptionMarketManager.sol";
import "./BinaryOption.sol";
import "synthetix-2.50.4-ovm/contracts/interfaces/IERC20.sol";

contract BinaryOptionMarket is OwnedWithInit, IBinaryOptionMarket {
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

    struct BinaryOptionMarketParameters {
        address owner;
        IERC20 sUSD;
        IPriceFeed priceFeed;
        address creator;
        bytes32 oracleKey;
        uint strikePrice;
        uint[2] times; // [maturity, expiry]
        uint deposit; // sUSD deposit
        bool customMarket;
        address iOracleInstanceAddress;
        address long;
        address short;
        address limitOrderProvider;
        address thalesAMM;
    }

    /* ========== STATE VARIABLES ========== */

    Options public options;
    Times public times;
    OracleDetails public oracleDetails;
    BinaryOptionMarketManager.Fees public fees;
    IPriceFeed public priceFeed;
    IERC20 public sUSD;

    IOracleInstance public iOracleInstance;
    bool public customMarket;

    // `deposited` tracks the sum of all deposits.
    // This must explicitly be kept, in case tokens are transferred to the contract directly.
    uint public deposited;
    uint public initialMint;
    address public creator;
    bool public resolved;

    /* ========== CONSTRUCTOR ========== */

    bool public initialized = false;

    function initialize(BinaryOptionMarketParameters calldata _parameters) external {
        require(!initialized, "Binary Option Market already initialized");
        initialized = true;
        initOwner(_parameters.owner);
        sUSD = _parameters.sUSD;
        priceFeed = _parameters.priceFeed;
        creator = _parameters.creator;

        oracleDetails = OracleDetails(
            _parameters.oracleKey,
            _parameters.strikePrice,
            0,
            _parameters.customMarket,
            _parameters.iOracleInstanceAddress
        );
        customMarket = _parameters.customMarket;
        iOracleInstance = IOracleInstance(_parameters.iOracleInstanceAddress);

        times = Times(_parameters.times[0], _parameters.times[1]);

        deposited = _parameters.deposit;
        initialMint = _parameters.deposit;

        // Instantiate the options themselves
        options.long = BinaryOption(_parameters.long);
        options.short = BinaryOption(_parameters.short);
        // abi.encodePacked("sLONG: ", _oracleKey)
        // consider naming the option: sLongBTC>50@2021.12.31
        options.long.initialize("Binary Option Long", "sLONG", _parameters.limitOrderProvider, _parameters.thalesAMM);
        options.short.initialize("Binary Option Short", "sSHORT", _parameters.limitOrderProvider, _parameters.thalesAMM);
        _mint(creator, initialMint);

        // Note: the ERC20 base contract does not have a constructor, so we do not have to worry
        // about initializing its state separately
    }

    /* ---------- External Contracts ---------- */

    function _priceFeed() internal view returns (IPriceFeed) {
        return priceFeed;
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

    function _oraclePrice() internal view returns (uint price) {
        return _priceFeed().rateForCurrency(oracleDetails.key);
    }

    function _oraclePriceAndTimestamp() internal view returns (uint price, uint updatedAt) {
        return _priceFeed().rateAndUpdatedTime(oracleDetails.key);
    }

    function oraclePriceAndTimestamp() external view returns (uint price, uint updatedAt) {
        return _oraclePriceAndTimestamp();
    }

    function oraclePrice() external view returns (uint price) {
        return _oraclePrice();
    }

    function canResolve() public view returns (bool) {
        if (customMarket) {
            return !resolved && _matured() && iOracleInstance.resolvable();
        } else {
            return !resolved && _matured();
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
                price = _oraclePrice();
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

    function getMaximumBurnable(address account) external view returns (uint amount) {
        return _getMaximumBurnable(account);
    }

    function _getMaximumBurnable(address account) internal view returns (uint amount) {
        (uint longBalance, uint shortBalance) = _balancesOf(account);
        return (longBalance > shortBalance) ? shortBalance : longBalance;
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

        _mint(msg.sender, value);

        _incrementDeposited(value);
        _manager().transferSusdTo(msg.sender, address(this), value);
    }

    function _mint(address minter, uint amount) internal {
        options.long.mint(minter, amount);
        options.short.mint(minter, amount);

        emit Mint(Side.Long, minter, amount);
        emit Mint(Side.Short, minter, amount);
    }

    function burnOptionsMaximum() external {
        _burnOptions(msg.sender, _getMaximumBurnable(msg.sender));
    }

    function burnOptions(uint amount) external {
        _burnOptions(msg.sender, amount);
    }

    function _burnOptions(address account, uint amount) internal {
        require(amount > 0, "Can not burn zero amount!");
        require(_getMaximumBurnable(account) >= amount, "There is not enough options!");

        // decrease deposit
        _decrementDeposited(amount);

        // decrease long and short options
        options.long.exerciseWithAmount(account, amount);
        options.short.exerciseWithAmount(account, amount);

        // transfer balance
        sUSD.transfer(account, amount);

        // emit events
        emit OptionsBurned(account, amount);
    }

    /* ---------- Custom oracle configuration ---------- */
    function setIOracleInstance(address _address) external onlyOwner {
        iOracleInstance = IOracleInstance(_address);
        emit SetIOracleInstance(_address);
    }

    function setPriceFeed(address _address) external onlyOwner {
        priceFeed = IPriceFeed(_address);
        emit SetPriceFeed(_address);
    }

    function setsUSD(address _address) external onlyOwner {
        sUSD = IERC20(_address);
        emit SetsUSD(_address);
    }

    /* ---------- Market Resolution ---------- */

    function resolve() external onlyOwner afterMaturity managerNotPaused {
        require(canResolve(), "Can not resolve market");
        uint price;
        uint updatedAt;
        if (!customMarket) {
            (price, updatedAt) = _oraclePriceAndTimestamp();
            oracleDetails.finalPrice = price;
        }
        resolved = true;

        emit MarketResolved(_result(), price, updatedAt, deposited, 0, 0);
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
            sUSD.transfer(msg.sender, payout);
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
        emit Expired(beneficiary);
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
    event OptionsBurned(address indexed account, uint value);
    event SetZeroExAddress(address _zeroExAddress);
    event SetZeroExAddressAtInit(address _zeroExAddress);
    event SetsUSD(address _address);
    event SetPriceFeed(address _address);
    event SetIOracleInstance(address _address);
    event Expired(address beneficiary);
}

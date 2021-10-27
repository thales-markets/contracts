pragma solidity ^0.5.16;

// Inheritance
import "../interfaces/IBinaryOptionMarketManager.sol";
import "synthetix-2.50.4-ovm/contracts/Owned.sol";
import "synthetix-2.50.4-ovm/contracts/Pausable.sol";

// Libraries
import "synthetix-2.50.4-ovm/contracts/AddressSetLib.sol";
import "synthetix-2.50.4-ovm/contracts/SafeDecimalMath.sol";

// Internal references
import "./BinaryOptionMarketFactory.sol";
import "./BinaryOptionMarket.sol";
import "./BinaryOption.sol";
import "../interfaces/IBinaryOptionMarket.sol";
import "../interfaces/IPriceFeed.sol";
import "synthetix-2.50.4-ovm/contracts/interfaces/IERC20.sol";
import "synthetix-2.50.4-ovm/contracts/interfaces/IAddressResolver.sol";

contract BinaryOptionMarketManager is Owned, Pausable, IBinaryOptionMarketManager {
    /* ========== LIBRARIES ========== */

    using SafeMath for uint;
    using AddressSetLib for AddressSetLib.AddressSet;

    /* ========== TYPES ========== */

    struct Fees {
        uint poolFee;
        uint creatorFee;
    }

    struct Durations {
        uint expiryDuration;
        uint maxTimeToMaturity;
    }

    /* ========== STATE VARIABLES ========== */

    address public feeAddress;
    address public zeroExAddress;

    Fees public fees;
    Durations public durations;
    uint public capitalRequirement;

    bool public marketCreationEnabled = true;
    bool public customMarketCreationEnabled = false;
    uint public totalDeposited;

    AddressSetLib.AddressSet internal _activeMarkets;
    AddressSetLib.AddressSet internal _maturedMarkets;

    BinaryOptionMarketManager internal _migratingManager;

    IAddressResolver public resolver;
    IPriceFeed public priceFeed;

    address public binaryOptionMarketFactory;

    /* ---------- Address Resolver Configuration ---------- */

    bytes32 internal constant CONTRACT_SYNTHSUSD = "SynthsUSD";

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _owner,
        IAddressResolver _resolver,
        IPriceFeed _priceFeed,
        uint _expiryDuration,
        uint _maxTimeToMaturity,
        uint _creatorCapitalRequirement,
        uint _poolFee,
        uint _creatorFee,
        address _feeAddress
    ) public Owned(_owner) Pausable() {
        resolver = _resolver;
        priceFeed = _priceFeed;

        // Temporarily change the owner so that the setters don't revert.
        owner = msg.sender;

        setFeeAddress(_feeAddress);
        setExpiryDuration(_expiryDuration);
        setMaxTimeToMaturity(_maxTimeToMaturity);
        setCreatorCapitalRequirement(_creatorCapitalRequirement);
        setPoolFee(_poolFee);
        setCreatorFee(_creatorFee);
        owner = _owner;
    }

    /* ========== SETTERS ========== */
    function setBinaryOptionsMarketFactory(address _binaryOptionMarketFactory) external onlyOwner {
        binaryOptionMarketFactory = _binaryOptionMarketFactory;
    }

    function setFeeAddress(address _feeAddress) public onlyOwner {
        feeAddress = _feeAddress;
    }
    
    function setZeroExAddress(address _zeroExAddress) public onlyOwner {
        require(_zeroExAddress != address(0), "Invalid address");
        zeroExAddress = _zeroExAddress;
        BinaryOptionMarketFactory(binaryOptionMarketFactory).setZeroExAddress(_zeroExAddress);
    }

    /* ========== VIEWS ========== */

    /* ---------- Related Contracts ---------- */

    function _sUSD() internal view returns (IERC20) {
        return IERC20(resolver.requireAndGetAddress(CONTRACT_SYNTHSUSD, "Synth sUSD contract not found"));
    }

    function _priceFeed() internal view returns (IPriceFeed) {
        return priceFeed;
    }

    /* ---------- Market Information ---------- */

    function _isKnownMarket(address candidate) internal view returns (bool) {
        return _activeMarkets.contains(candidate) || _maturedMarkets.contains(candidate);
    }

    function numActiveMarkets() external view returns (uint) {
        return _activeMarkets.elements.length;
    }

    function activeMarkets(uint index, uint pageSize) external view returns (address[] memory) {
        return _activeMarkets.getPage(index, pageSize);
    }

    function numMaturedMarkets() external view returns (uint) {
        return _maturedMarkets.elements.length;
    }

    function maturedMarkets(uint index, uint pageSize) external view returns (address[] memory) {
        return _maturedMarkets.getPage(index, pageSize);
    }

    function _isValidKey(bytes32 oracleKey) internal view returns (bool) {

        // If it has a rate, then it's possibly a valid key
        if (priceFeed.rateForCurrency(oracleKey) != 0) {
            // But not sUSD
            if (oracleKey == "sUSD") {
                return false;
            }

            return true;
        }

        return false;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /* ---------- Setters ---------- */

    function setExpiryDuration(uint _expiryDuration) public onlyOwner {
        durations.expiryDuration = _expiryDuration;
        emit ExpiryDurationUpdated(_expiryDuration);
    }

    function setMaxTimeToMaturity(uint _maxTimeToMaturity) public onlyOwner {
        durations.maxTimeToMaturity = _maxTimeToMaturity;
        emit MaxTimeToMaturityUpdated(_maxTimeToMaturity);
    }

    function setPoolFee(uint _poolFee) public onlyOwner {
        uint totalFee = _poolFee + fees.creatorFee;
        require(totalFee < SafeDecimalMath.unit(), "Total fee must be less than 100%.");
        require(0 < totalFee, "Total fee must be nonzero.");
        fees.poolFee = _poolFee;
        emit PoolFeeUpdated(_poolFee);
    }

    function setCreatorFee(uint _creatorFee) public onlyOwner {
        uint totalFee = _creatorFee + fees.poolFee;
        require(totalFee < SafeDecimalMath.unit(), "Total fee must be less than 100%.");
        require(0 < totalFee, "Total fee must be nonzero.");
        fees.creatorFee = _creatorFee;
        emit CreatorFeeUpdated(_creatorFee);
    }

    function setCreatorCapitalRequirement(uint _creatorCapitalRequirement) public onlyOwner {
        capitalRequirement = _creatorCapitalRequirement;
        emit CreatorCapitalRequirementUpdated(_creatorCapitalRequirement);
    }

    function setPriceFeed(address _address) external onlyOwner {
        priceFeed = IPriceFeed(_address);
    }

    /* ---------- Deposit Management ---------- */

    function incrementTotalDeposited(uint delta) external onlyActiveMarkets notPaused {
        totalDeposited = totalDeposited.add(delta);
    }

    function decrementTotalDeposited(uint delta) external onlyKnownMarkets notPaused {
        // NOTE: As individual market debt is not tracked here, the underlying markets
        //       need to be careful never to subtract more debt than they added.
        //       This can't be enforced without additional state/communication overhead.
        totalDeposited = totalDeposited.sub(delta);
    }

    /* ---------- Market Lifecycle ---------- */

    function createMarket(
        bytes32 oracleKey,
        uint strikePrice,
        uint maturity,
        uint initialMint, // initial sUSD to mint options for,
        bool customMarket,
        address customOracle
    )
        external
        notPaused
        returns (
            IBinaryOptionMarket // no support for returning BinaryOptionMarket polymorphically given the interface
        )
    {
        require(marketCreationEnabled, "Market creation is disabled");
        if (!customMarket) {
            require(_isValidKey(oracleKey), "Invalid key");
        } else {
            if (!customMarketCreationEnabled) {
                require(owner == msg.sender, "Only owner can create custom markets");
            }
            require(address(0) != customOracle, "Invalid custom oracle");
        }

        require(maturity <= block.timestamp + durations.maxTimeToMaturity, "Maturity too far in the future");
        uint expiry = maturity.add(durations.expiryDuration);

        require(block.timestamp < maturity, "Maturity has to be in the future");
        // We also require maturity < expiry. But there is no need to check this.
        // Fees being in range are checked in the setters.
        // The market itself validates the capital and skew requirements.

        require(capitalRequirement <= initialMint, "Insufficient capital");

        BinaryOptionMarket market =
            BinaryOptionMarketFactory(binaryOptionMarketFactory).createMarket(
                msg.sender,
                resolver,
                priceFeed,
                oracleKey,
                strikePrice,
                [maturity, expiry],
                initialMint,
                [fees.poolFee, fees.creatorFee],
                customMarket,
                customOracle
            );

        _activeMarkets.add(address(market));

        // The debt can't be incremented in the new market's constructor because until construction is complete,
        // the manager doesn't know its address in order to grant it permission.
        totalDeposited = totalDeposited.add(initialMint);
        _sUSD().transferFrom(msg.sender, address(market), initialMint);

        (BinaryOption long, BinaryOption short) = market.options();

        emit MarketCreated(
            address(market),
            msg.sender,
            oracleKey,
            strikePrice,
            maturity,
            expiry,
            address(long),
            address(short),
            customMarket,
            customOracle, 
            zeroExAddress
        );
        return market;
    }

    function transferSusdTo(
        address sender,
        address receiver,
        uint amount
    ) external {
        //only to be called by markets themselves
        require(_isKnownMarket(address(msg.sender)), "Market unknown.");
        _sUSD().transferFrom(sender, receiver, amount);
    }

    function resolveMarket(address market) external {
        require(_activeMarkets.contains(market), "Not an active market");
        BinaryOptionMarket(market).resolve();
        _activeMarkets.remove(market);
        _maturedMarkets.add(market);
    }

    function expireMarkets(address[] calldata markets) external notPaused onlyOwner {
        for (uint i = 0; i < markets.length; i++) {
            address market = markets[i];

            require(_isKnownMarket(address(market)), "Market unknown.");

            // The market itself handles decrementing the total deposits.
            BinaryOptionMarket(market).expire(msg.sender);

            // Note that we required that the market is known, which guarantees
            // its index is defined and that the list of markets is not empty.
            _maturedMarkets.remove(market);

            emit MarketExpired(market);
        }
    }

    function setMarketCreationEnabled(bool enabled) public onlyOwner {
        if (enabled != marketCreationEnabled) {
            marketCreationEnabled = enabled;
            emit MarketCreationEnabledUpdated(enabled);
        }
    }

    function setCustomMarketCreationEnabled(bool enabled) public onlyOwner {
        customMarketCreationEnabled = enabled;
    }

    function setMigratingManager(BinaryOptionMarketManager manager) public onlyOwner {
        _migratingManager = manager;
    }

    function migrateMarkets(
        BinaryOptionMarketManager receivingManager,
        bool active,
        BinaryOptionMarket[] calldata marketsToMigrate
    ) external onlyOwner {
        require(address(receivingManager) != address(this), "Can't migrate to self");

        uint _numMarkets = marketsToMigrate.length;
        if (_numMarkets == 0) {
            return;
        }
        AddressSetLib.AddressSet storage markets = active ? _activeMarkets : _maturedMarkets;

        uint runningDepositTotal;
        for (uint i; i < _numMarkets; i++) {
            BinaryOptionMarket market = marketsToMigrate[i];
            require(_isKnownMarket(address(market)), "Market unknown.");

            // Remove it from our list and deposit total.
            markets.remove(address(market));
            runningDepositTotal = runningDepositTotal.add(market.deposited());

            // Prepare to transfer ownership to the new manager.
            market.nominateNewOwner(address(receivingManager));
        }
        // Deduct the total deposits of the migrated markets.
        totalDeposited = totalDeposited.sub(runningDepositTotal);
        emit MarketsMigrated(receivingManager, marketsToMigrate);

        // Now actually transfer the markets over to the new manager.
        receivingManager.receiveMarkets(active, marketsToMigrate);
    }

    function receiveMarkets(bool active, BinaryOptionMarket[] calldata marketsToReceive) external {
        require(msg.sender == address(_migratingManager), "Only permitted for migrating manager.");

        uint _numMarkets = marketsToReceive.length;
        if (_numMarkets == 0) {
            return;
        }
        AddressSetLib.AddressSet storage markets = active ? _activeMarkets : _maturedMarkets;

        uint runningDepositTotal;
        for (uint i; i < _numMarkets; i++) {
            BinaryOptionMarket market = marketsToReceive[i];
            require(!_isKnownMarket(address(market)), "Market already known.");

            market.acceptOwnership();
            markets.add(address(market));
            // Update the market with the new manager address,
            runningDepositTotal = runningDepositTotal.add(market.deposited());
        }
        totalDeposited = totalDeposited.add(runningDepositTotal);
        emit MarketsReceived(_migratingManager, marketsToReceive);
    }

    /* ========== MODIFIERS ========== */

    modifier onlyActiveMarkets() {
        require(_activeMarkets.contains(msg.sender), "Permitted only for active markets.");
        _;
    }

    modifier onlyKnownMarkets() {
        require(_isKnownMarket(msg.sender), "Permitted only for known markets.");
        _;
    }

    /* ========== EVENTS ========== */

    event MarketCreated(
        address market,
        address indexed creator,
        bytes32 indexed oracleKey,
        uint strikePrice,
        uint maturityDate,
        uint expiryDate,
        address long,
        address short,
        bool customMarket,
        address customOracle,
        address zeroExAddress
    );
    event MarketExpired(address market);
    event MarketsMigrated(BinaryOptionMarketManager receivingManager, BinaryOptionMarket[] markets);
    event MarketsReceived(BinaryOptionMarketManager migratingManager, BinaryOptionMarket[] markets);
    event MarketCreationEnabledUpdated(bool enabled);
    event ExpiryDurationUpdated(uint duration);
    event MaxTimeToMaturityUpdated(uint duration);
    event CreatorCapitalRequirementUpdated(uint value);
    event PoolFeeUpdated(uint fee);
    event CreatorFeeUpdated(uint fee);
}

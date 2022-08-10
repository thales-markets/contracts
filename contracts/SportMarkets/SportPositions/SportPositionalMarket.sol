// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "../../OwnedWithInit.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/ITherundownConsumer.sol";

// Libraries
import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";

// Internal references
import "./SportPositionalMarketManager.sol";
import "./SportPosition.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";

contract SportPositionalMarket is OwnedWithInit, ISportPositionalMarket {
    /* ========== LIBRARIES ========== */

    using SafeMath for uint;

    /* ========== TYPES ========== */

    struct Options {
        SportPosition home;
        SportPosition away;
        SportPosition draw;
    }

    struct Times {
        uint maturity;
        uint expiry;
    }

    struct GameDetails {
        bytes32 gameId;
        string gameLabel;
    }

    struct SportPositionalMarketParameters {
        address owner;
        IERC20 sUSD;
        address creator;
        bytes32 gameId;
        string gameLabel;
        uint[2] times; // [maturity, expiry]
        uint deposit; // sUSD deposit
        address theRundownConsumer;
        address sportsAMM;
        uint positionCount;
        address[] positions;
        uint[] tags;
    }

    /* ========== STATE VARIABLES ========== */

    Options public options;
    uint public override optionsCount;
    Times public override times;
    GameDetails public gameDetails;
    ITherundownConsumer public theRundownConsumer;
    IERC20 public sUSD;
    address public sportsAMM;
    uint[] public tags;
    uint public finalResult;

    // `deposited` tracks the sum of all deposits.
    // This must explicitly be kept, in case tokens are transferred to the contract directly.
    uint public override deposited;
    uint public initialMint;
    address public override creator;
    bool public override resolved;
    bool public override cancelled;
    uint public homeOddsOnCancellation;
    uint public awayOddsOnCancellation;
    uint public drawOddsOnCancellation;

    bool public invalidOdds;
    bool public initialized = false;
    bool public override paused;

    /* ========== CONSTRUCTOR ========== */
    function initialize(SportPositionalMarketParameters calldata _parameters) external {
        require(!initialized, "Positional Market already initialized");
        initialized = true;
        initOwner(_parameters.owner);
        sUSD = _parameters.sUSD;
        creator = _parameters.creator;
        theRundownConsumer = ITherundownConsumer(_parameters.theRundownConsumer);

        gameDetails = GameDetails(_parameters.gameId, _parameters.gameLabel);

        tags = _parameters.tags;
        times = Times(_parameters.times[0], _parameters.times[1]);

        deposited = _parameters.deposit;
        initialMint = _parameters.deposit;
        optionsCount = _parameters.positionCount;
        sportsAMM = _parameters.sportsAMM;
        require(optionsCount == _parameters.positions.length, "Position count mismatch");
        // Instantiate the options themselves
        options.home = SportPosition(_parameters.positions[0]);
        options.away = SportPosition(_parameters.positions[1]);
        // abi.encodePacked("sUP: ", _oracleKey)
        // consider naming the option: sUpBTC>50@2021.12.31
        options.home.initialize(gameDetails.gameLabel, "HOME", _parameters.sportsAMM);
        options.away.initialize(gameDetails.gameLabel, "AWAY", _parameters.sportsAMM);

        if (optionsCount > 2) {
            options.draw = SportPosition(_parameters.positions[2]);
            options.draw.initialize(gameDetails.gameLabel, "DRAW", _parameters.sportsAMM);
        }
        if (initialMint > 0) {
            _mint(creator, initialMint);
        }

        // Note: the ERC20 base contract does not have a constructor, so we do not have to worry
        // about initializing its state separately
    }

    /* ---------- External Contracts ---------- */

    function _manager() internal view returns (SportPositionalMarketManager) {
        return SportPositionalMarketManager(owner);
    }

    /* ---------- Phases ---------- */

    function _matured() internal view returns (bool) {
        return times.maturity < block.timestamp;
    }

    function _expired() internal view returns (bool) {
        return resolved && (times.expiry < block.timestamp || deposited == 0);
    }

    function phase() external view override returns (Phase) {
        if (!_matured()) {
            return Phase.Trading;
        }
        if (!_expired()) {
            return Phase.Maturity;
        }
        return Phase.Expiry;
    }

    function setPaused(bool _paused) external override onlyOwner managerNotPaused {

        require(paused != _paused, "State not changed");
        paused = _paused;
        emit PauseUpdated(_paused);
    }

    /* ---------- Market Resolution ---------- */

    function canResolve() public view override returns (bool) {
        return !resolved && _matured() && !paused;
    }

    function getGameDetails() external view override returns (bytes32 gameId, string memory gameLabel) {
        return (gameDetails.gameId, gameDetails.gameLabel);
    }

    function _result() internal view returns (Side) {
        if (!resolved || cancelled) {
            return Side.Cancelled;
        } else if (finalResult == 3 && optionsCount > 2) {
            return Side.Draw;
        } else {
            return finalResult == 1 ? Side.Home : Side.Away;
        }
    }

    function result() external view override returns (Side) {
        return _result();
    }

    /* ---------- Option Balances and Mints ---------- */
    function getGameId() external view override returns (bytes32) {
        return gameDetails.gameId;
    }

    function getStampedOdds()
        external
        view
        override
        returns (
            uint,
            uint,
            uint
        )
    {
        if (cancelled) {
            return (homeOddsOnCancellation, awayOddsOnCancellation, drawOddsOnCancellation);
        } else {
            return (0, 0, 0);
        }
    }

    function _balancesOf(address account)
        internal
        view
        returns (
            uint home,
            uint away,
            uint draw
        )
    {
        if (optionsCount > 2) {
            return (
                options.home.getBalanceOf(account),
                options.away.getBalanceOf(account),
                options.draw.getBalanceOf(account)
            );
        }
        return (options.home.getBalanceOf(account), options.away.getBalanceOf(account), 0);
    }

    function balancesOf(address account)
        external
        view
        override
        returns (
            uint home,
            uint away,
            uint draw
        )
    {
        return _balancesOf(account);
    }

    function totalSupplies()
        external
        view
        override
        returns (
            uint home,
            uint away,
            uint draw
        )
    {
        if (optionsCount > 2) {
            return (options.home.totalSupply(), options.away.totalSupply(), options.draw.totalSupply());
        }
        return (options.home.totalSupply(), options.away.totalSupply(), 0);
    }

    function getMaximumBurnable(address account) external view override returns (uint amount) {
        return _getMaximumBurnable(account);
    }

    function getOptions()
        external
        view
        override
        returns (
            IPosition home,
            IPosition away,
            IPosition draw
        )
    {
        home = options.home;
        away = options.away;
        draw = options.draw;
    }

    function _getMaximumBurnable(address account) internal view returns (uint amount) {
        (uint homeBalance, uint awayBalance, uint drawBalance) = _balancesOf(account);
        uint min = homeBalance;
        if (min > awayBalance) {
            min = awayBalance;
            if (optionsCount > 2 && drawBalance < min) {
                min = drawBalance;
            }
        } else {
            if (optionsCount > 2 && drawBalance < min) {
                min = drawBalance;
            }
        }
        return min;
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

    function mint(uint value) external override {
        require(!_matured() && !paused, "Minting inactive");
        require(msg.sender == sportsAMM, "Invalid minter");
        if (value == 0) {
            return;
        }

        _mint(msg.sender, value);

        _incrementDeposited(value);
        _manager().transferSusdTo(msg.sender, address(this), value);
    }

    function _mint(address minter, uint amount) internal {
        options.home.mint(minter, amount);
        options.away.mint(minter, amount);
        emit Mint(Side.Home, minter, amount);
        emit Mint(Side.Away, minter, amount);
        if (optionsCount > 2) {
            options.draw.mint(minter, amount);
            emit Mint(Side.Draw, minter, amount);
        }
    }

    function burnOptionsMaximum() external override {
        _burnOptions(msg.sender, _getMaximumBurnable(msg.sender));
    }

    function burnOptions(uint amount) external override {
        _burnOptions(msg.sender, amount);
    }

    function _burnOptions(address account, uint amount) internal {
        require(amount > 0, "Can not burn zero amount!");
        require(!paused, "Market paused");
        require(_getMaximumBurnable(account) >= amount, "There is not enough options!");

        // decrease deposit
        _decrementDeposited(amount);

        // decrease home and away options
        options.home.exerciseWithAmount(account, amount);
        options.away.exerciseWithAmount(account, amount);
        if (optionsCount > 2) {
            options.draw.exerciseWithAmount(account, amount);
        }

        // transfer balance
        sUSD.transfer(account, amount);

        // emit events
        emit OptionsBurned(account, amount);
    }

    /* ---------- Custom oracle configuration ---------- */
    function setTherundownConsumer(address _theRundownConsumer) external onlyOwner {
        theRundownConsumer = ITherundownConsumer(_theRundownConsumer);
        emit SetTherundownConsumer(_theRundownConsumer);
    }

    function setsUSD(address _address) external onlyOwner {
        sUSD = IERC20(_address);
        emit SetsUSD(_address);
    }

    /* ---------- Market Resolution ---------- */

    function resolve(uint _outcome) external onlyOwner managerNotPaused {
        require(_outcome <= optionsCount, "Invalid outcome");
        if (_outcome == 0) {
            cancelled = true;
            stampOdds();
        } else {
            require(canResolve(), "Can not resolve market");
        }
        finalResult = _outcome;
        resolved = true;
        emit MarketResolved(_result(), deposited, 0, 0);
    }

    function stampOdds() internal {
        uint[] memory odds = new uint[](optionsCount);
        odds = ITherundownConsumer(theRundownConsumer).getNormalizedOdds(gameDetails.gameId);
        if (odds[0] == 0 || odds[1] == 0) {
            invalidOdds = true;
        }
        homeOddsOnCancellation = odds[0];
        awayOddsOnCancellation = odds[1];
        drawOddsOnCancellation = optionsCount > 2 ? odds[2] : 0;
        emit StoredOddsOnCancellation(homeOddsOnCancellation, awayOddsOnCancellation, drawOddsOnCancellation);
    }

    /* ---------- Claiming and Exercising Options ---------- */

    function exerciseOptions() external override {
        // The market must be resolved if it has not been.
        require(resolved, "Unresolved");
        require(!paused, "Paused");
        // If the account holds no options, revert.
        (uint homeBalance, uint awayBalance, uint drawBalance) = _balancesOf(msg.sender);
        require(homeBalance != 0 || awayBalance != 0 || drawBalance != 0, "Nothing to exercise");

        // Each option only needs to be exercised if the account holds any of it.
        if (homeBalance != 0) {
            options.home.exercise(msg.sender);
        }
        if (awayBalance != 0) {
            options.away.exercise(msg.sender);
        }
        if (optionsCount > 2 && drawBalance != 0) {
            options.draw.exercise(msg.sender);
        }
        uint result = uint(_result());
        // Only pay out the side that won.
        uint payout = (_result() == Side.Home) ? homeBalance : awayBalance;

        if (optionsCount > 2 && _result() != Side.Home) {
            payout = _result() == Side.Away ? awayBalance : drawBalance;
        }
        if (cancelled) {
            require(!invalidOdds, "Invalid stamped odds");
            payout = calculatePayoutOnCancellation(homeBalance, awayBalance, drawBalance);
        }
        emit OptionsExercised(msg.sender, payout);
        if (payout != 0) {
            _decrementDeposited(payout);
            sUSD.transfer(msg.sender, payout);
        }
    }

    function restoreInvalidOdds(
        uint _homeOdds,
        uint _awayOdds,
        uint _drawOdds
    ) external override onlyOwner {
        require(_homeOdds > 0 && _awayOdds > 0, "Invalid odd");
        homeOddsOnCancellation = _homeOdds;
        awayOddsOnCancellation = _awayOdds;
        drawOddsOnCancellation = optionsCount > 2 ? _drawOdds : 0;
        invalidOdds = false;
        emit StoredOddsOnCancellation(homeOddsOnCancellation, awayOddsOnCancellation, drawOddsOnCancellation);
    }

    function calculatePayoutOnCancellation(
        uint _homeBalance,
        uint _awayBalance,
        uint _drawBalance
    ) public view returns (uint) {
        if (!cancelled) {
            return 0;
        } else {
            uint payout = _homeBalance.mul(homeOddsOnCancellation).div(1e18);
            payout = payout.add(_awayBalance.mul(awayOddsOnCancellation).div(1e18));
            payout = payout.add(_drawBalance.mul(drawOddsOnCancellation).div(1e18));
            return payout;
        }
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
        options.home.expire(beneficiary);
        options.away.expire(beneficiary);
        selfdestruct(beneficiary);
    }

    function expire(address payable beneficiary) external onlyOwner {
        require(_expired(), "Unexpired options remaining");
        emit Expired(beneficiary);
        _selfDestruct(beneficiary);
    }

    /* ========== MODIFIERS ========== */

    modifier managerNotPaused() {
        _requireManagerNotPaused();
        _;
    }

    /* ========== EVENTS ========== */

    event Mint(Side side, address indexed account, uint value);
    event MarketResolved(Side result, uint deposited, uint poolFees, uint creatorFees);

    event OptionsExercised(address indexed account, uint value);
    event OptionsBurned(address indexed account, uint value);
    event SetsUSD(address _address);
    event SetTherundownConsumer(address _address);
    event Expired(address beneficiary);
    event StoredOddsOnCancellation(uint homeOdds, uint awayOdds, uint drawOdds);
    event PauseUpdated(bool _paused);
}

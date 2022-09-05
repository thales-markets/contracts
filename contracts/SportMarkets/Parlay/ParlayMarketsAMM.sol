// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-4.4.1/proxy/Clones.sol";

// interfaces
import "../../interfaces/ISportsAMM.sol";

// internal
import "../../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "../../utils/libraries/AddressSetLib.sol";

import "./ParlayMarket.sol";
import "../../interfaces/IParlayMarketData.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/IStakingThales.sol";
import "../../interfaces/IReferrals.sol";
import "../../interfaces/ICurveSUSD.sol";

// import "hardhat/console.sol";

contract ParlayMarketsAMM is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using SafeMathUpgradeable for uint;
    using AddressSetLib for AddressSetLib.AddressSet;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant DEFAULT_PARLAY_SIZE = 4;

    ISportsAMM public sportsAmm;

    uint public parlayAmmFee;
    uint public parlaySize;

    mapping(address => mapping(address => address)) public createdParlayMarkets;
    AddressSetLib.AddressSet internal _knownMarkets;

    mapping(address => bool) public losingParlay;
    mapping(address => bool) public resolvedParlay;

    address public parlayMarketMastercopy;

    IERC20Upgradeable public sUSD;

    address public parlayMarketData;

    // IMPORTANT: AMM risks only half or the payout effectively, but it risks the whole amount on price movements
    uint public maxSupportedAmount;
    uint public maxSupportedOdds;

    address public safeBox;
    uint public safeBoxImpact;

    IStakingThales public stakingThales;

    address public referrals;
    uint public referrerFee;

    ICurveSUSD public curveSUSD;

    address public usdc;
    address public usdt;
    address public dai;

    bool public curveOnrampEnabled;

    function initialize(
        address _owner,
        ISportsAMM _sportsAmm,
        uint _parlayAmmFee,
        uint _maxSupportedAmount,
        uint _maxSupportedOdds,
        IERC20Upgradeable _sUSD,
        address _safeBox,
        uint _safeBoxImpact
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        sportsAmm = _sportsAmm;
        maxSupportedAmount = _maxSupportedAmount;
        maxSupportedOdds = _maxSupportedOdds;
        parlayAmmFee = _parlayAmmFee;
        sUSD = _sUSD;
        safeBox = _safeBox;
        safeBoxImpact = _safeBoxImpact;
        parlaySize = DEFAULT_PARLAY_SIZE;
        sUSD.approve(address(sportsAmm), type(uint256).max);
    }

    function isActiveParlay(address _parlayMarket) external view returns (bool isActiveParlayMarket) {
        isActiveParlayMarket = _knownMarkets.contains(_parlayMarket);
    }

    function activeParlayMarkets(uint index, uint pageSize) external view returns (address[] memory) {
        return _knownMarkets.getPage(index, pageSize);
    }

    function canAddToParlay(
        address _sportMarket,
        uint _position,
        uint _gamesCount,
        uint _totalQuote,
        uint _previousTotalAmount,
        uint _totalSUSDToPay
    )
        external
        view
        returns (
            uint totalResultQuote,
            uint totalAmount,
            uint oddForPosition,
            uint availableToBuy
        )
    {
        (totalResultQuote, totalAmount, oddForPosition, availableToBuy) = _addGameToParlay(
            _sportMarket,
            _position,
            _gamesCount,
            _totalQuote,
            _previousTotalAmount,
            _totalSUSDToPay
        );
    }

    function canCreateParlayMarket(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint sUSDToPay
    ) external view returns (bool canBeCreated) {
        (uint totalQuote, uint totalAmount, , ) = _canCreateParlayMarket(_sportMarkets, _positions, sUSDToPay);
        canBeCreated = totalQuote > maxSupportedOdds && totalAmount <= maxSupportedAmount;
    }

    function buyParlay(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDPaid,
        uint _additionalSlippage
    ) external nonReentrant notPaused {
        _buyParlay(_sportMarkets, _positions, _sUSDPaid, _additionalSlippage, true);
    }

    function buyParlayWithDifferentCollateralAndReferrer(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDPaid,
        uint _additionalSlippage,
        address collateral,
        address _referrer
    ) external nonReentrant notPaused {
        if (_referrer != address(0)) {
            IReferrals(referrals).setReferrer(_referrer, msg.sender);
        }
        int128 curveIndex = _mapCollateralToCurveIndex(collateral);
        require(curveIndex > 0 && curveOnrampEnabled, "unsupported collateral");

        //cant get a quote on how much collateral is needed from curve for sUSD,
        //so rather get how much of collateral you get for the sUSD quote and add 0.2% to that
        uint collateralQuote = curveSUSD.get_dy_underlying(0, curveIndex, _sUSDPaid).mul(ONE.add(ONE_PERCENT.div(5))).div(
            ONE
        );
        require(collateralQuote.mul(ONE).div(_sUSDPaid) <= ONE.add(_additionalSlippage), "Slippage too high!");

        IERC20Upgradeable collateralToken = IERC20Upgradeable(collateral);
        collateralToken.safeTransferFrom(msg.sender, address(this), collateralQuote);
        curveSUSD.exchange_underlying(curveIndex, 0, collateralQuote, _sUSDPaid);

        _buyParlay(_sportMarkets, _positions, _sUSDPaid, _additionalSlippage, false);
    }

    function _buyParlay(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _sUSDPaid,
        uint _additionalSlippage,
        bool _sendSUSD
    ) internal {
        uint totalResultQuote;
        uint totalAmount;
        uint[] memory amountsToBuy = new uint[](_sportMarkets.length);
        uint[] memory marketQuotes = new uint[](_sportMarkets.length);
        uint sUSDAfterFees = _sUSDPaid.mul(ONE.sub(safeBoxImpact.mul(ONE_PERCENT))).div(ONE);
        (totalResultQuote, totalAmount, amountsToBuy, marketQuotes) = _canCreateParlayMarket(
            _sportMarkets,
            _positions,
            sUSDAfterFees
        );
        // apply all checks
        require(totalResultQuote > maxSupportedOdds, "Can't create this parlay market!");
        require(totalAmount <= maxSupportedAmount, "Amount exceeds MaxSupportedAmount");
        // checks for creation missing

        if (_sendSUSD) {
            sUSD.safeTransferFrom(msg.sender, address(this), sUSDAfterFees);
            sUSD.safeTransferFrom(msg.sender, safeBox, _sUSDPaid.sub(sUSDAfterFees));
        } else {
            sUSD.safeTransfer(safeBox, _sUSDPaid.sub(sUSDAfterFees));
        }

        // mint the stateful token  (ERC-20)
        // clone a parlay market
        ParlayMarket parlayMarket = ParlayMarket(Clones.clone(parlayMarketMastercopy));

        parlayMarket.initialize(_sportMarkets, _positions, totalAmount, sUSDAfterFees, address(this), msg.sender);

        emit NewParlayMarket(address(parlayMarket), _sportMarkets, _positions, totalAmount, sUSDAfterFees);

        _knownMarkets.add(address(parlayMarket));
        parlayMarket.updateQuotes(marketQuotes, totalResultQuote);

        // buy the positions
        _buyPositionsFromSportAMM(_sportMarkets, _positions, amountsToBuy, _additionalSlippage, address(parlayMarket));
        emit ParlayMarketCreated(address(parlayMarket), msg.sender, totalAmount, _sUSDPaid, sUSDAfterFees);
    }

    function exerciseParlay(address _parlayMarket) external nonReentrant notPaused {
        require(_knownMarkets.contains(_parlayMarket), "Unknown/Expired parlay");
        ParlayMarket parlayMarket = ParlayMarket(_parlayMarket);
        parlayMarket.exerciseWiningSportMarkets();
        if (parlayMarket.numOfResolvedSportMarkets() == parlayMarket.numOfSportMarkets()) {
            resolvedParlay[_parlayMarket] = true;
            _knownMarkets.remove(_parlayMarket);
        }
    }

    function exerciseSportMarketInParlay(address _parlayMarket, address _sportMarket) external nonReentrant notPaused {
        require(_knownMarkets.contains(_parlayMarket), "Unknown/Expired parlay");
        ParlayMarket parlayMarket = ParlayMarket(_parlayMarket);
        parlayMarket.exerciseSpecificSportMarket(_sportMarket);
        if (parlayMarket.numOfResolvedSportMarkets() == parlayMarket.numOfSportMarkets()) {
            resolvedParlay[_parlayMarket] = true;
            _knownMarkets.remove(_parlayMarket);
        }
    }

    function getParlayBalances(address _parlayMarket) external view returns (uint[] memory balances) {
        if (_knownMarkets.contains(_parlayMarket)) {
            balances = ParlayMarket(_parlayMarket).getSportMarketBalances();
        }
    }

    function canExerciseAnySportPositionOnParlay(address _parlayMarket) external view returns (bool isExercisable) {
        if (_knownMarkets.contains(_parlayMarket)) {
            isExercisable = ParlayMarket(_parlayMarket).isAnySportMarketExercisable();
        }
    }

    function isAnySportPositionResolvedOnParlay(address _parlayMarket) external view returns (bool isAnyResolvable) {
        if (_knownMarkets.contains(_parlayMarket)) {
            isAnyResolvable = ParlayMarket(_parlayMarket).isAnySportMarketResolved();
        }
    }

    function triggerResolvedEvent(address _account, bool _userWon) external {
        require(_knownMarkets.contains(msg.sender), "Not valid Parlay");
        emit ParlayResolved(_account, _userWon);
    }

    function transferRestOfSUSDAmount(
        address receiver,
        uint amount,
        bool dueToCancellation
    ) external {
        require(_knownMarkets.contains(msg.sender), "Not a known parlay market");
        if (dueToCancellation) {
            emit ExtraAmountTransferredDueToCancellation(receiver, amount);
        }
        sUSD.safeTransfer(receiver, amount);
    }

    function transferSusdTo(address receiver, uint amount) external {
        require(_knownMarkets.contains(msg.sender), "Not a known parlay market");
        sUSD.safeTransfer(receiver, amount);
    }

    function retrieveSUSDAmount(address payable account, uint amount) external onlyOwner {
        sUSD.safeTransfer(account, amount);
    }

    // INTERNAL FUNCTIONS

    function _checkPositionAvailability(uint[] memory _amounts, uint[] memory _availableAmounts)
        internal
        pure
        returns (uint[] memory)
    {
        bool amountsExceeded;
        for (uint i = 0; i < _amounts.length; i++) {
            if (_amounts[i] > _availableAmounts[i]) {
                amountsExceeded = true;
                break;
            }
        }
        if (amountsExceeded) {
            uint[] memory newAmounts = new uint[](_amounts.length);
            return newAmounts;
        } else {
            return _amounts;
        }
    }

    function _canCreateParlayMarket(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint _totalSUSDToPay
    )
        internal
        view
        returns (
            uint totalResultQuote,
            uint totalAmount,
            uint[] memory amountsToBuy,
            uint[] memory quoteAmounts
        )
    {
        uint numOfMarkets = _sportMarkets.length;
        uint numOfPositions = _positions.length;
        uint previousAmount;
        amountsToBuy = new uint[](numOfMarkets);
        quoteAmounts = new uint[](numOfMarkets);
        if (_totalSUSDToPay == 0) {
            _totalSUSDToPay = 1;
        }
        if (numOfMarkets == numOfPositions) {
            for (uint i = 0; i < numOfMarkets; i++) {
                if (_positions[i] > 2) {
                    totalResultQuote = 0;
                    break;
                }
                (totalResultQuote, totalAmount, quoteAmounts[i], ) = _addGameToParlay(
                    _sportMarkets[i],
                    _positions[i],
                    i,
                    totalResultQuote,
                    previousAmount,
                    _totalSUSDToPay
                );
                // not ideal if the first amount is the lowest quote
                amountsToBuy[i] = totalAmount.sub(previousAmount);
                previousAmount = totalAmount;
                if (totalResultQuote == 0) {
                    totalResultQuote = 0;
                    break;
                }
                // two markets can't be equal:
                for (uint j = 0; j < i; j++) {
                    if (_sportMarkets[i] == _sportMarkets[j]) {
                        totalResultQuote = 0;
                        break;
                    }
                }
                if (totalResultQuote == 0) {
                    break;
                }
            }
        }
    }

    function _addGameToParlay(
        address _sportMarket,
        uint _position,
        uint _gamesCount,
        uint _totalQuote,
        uint _previousTotalAmount,
        uint _totalSUSDToPay
    )
        internal
        view
        returns (
            uint totalResultQuote,
            uint totalAmount,
            uint oddForPosition,
            uint availableToBuy
        )
    {
        if ((_gamesCount == 0 || _totalQuote >= maxSupportedOdds) && _gamesCount < parlaySize) {
            uint[] memory marketOdds = sportsAmm.getMarketDefaultOdds(_sportMarket, false);
            oddForPosition = marketOdds[_position];
            totalResultQuote = _totalQuote == 0 ? oddForPosition : _totalQuote.mul(oddForPosition).div(ONE);
            totalAmount = ONE.mul(ONE).mul(_totalSUSDToPay).div(totalResultQuote).div(ONE);
            availableToBuy = sportsAmm.availableToBuyFromAMM(_sportMarket, _obtainSportsAMMPosition(_position));
            if (availableToBuy < totalAmount.sub(_previousTotalAmount)) {
                totalResultQuote = 0;
                totalAmount = 0;
            }
        }
    }

    function _buyPositionsFromSportAMM(
        address[] calldata _sportMarkets,
        uint[] calldata _positions,
        uint[] memory _proportionalAmounts,
        uint _additionalSlippage,
        address _parlayMarket
    ) internal {
        uint numOfMarkets = _sportMarkets.length;
        uint buyAMMQuote;

        for (uint i = 0; i < numOfMarkets; i++) {
            buyAMMQuote = sportsAmm.buyFromAmmQuoteForParlayAMM(
                _sportMarkets[i],
                _obtainSportsAMMPosition(_positions[i]),
                _proportionalAmounts[i]
            );

            sportsAmm.buyFromAMM(
                _sportMarkets[i],
                _obtainSportsAMMPosition(_positions[i]),
                _proportionalAmounts[i],
                buyAMMQuote,
                _additionalSlippage
            );
            _sendPositionsToMarket(_sportMarkets[i], _positions[i], _parlayMarket, _proportionalAmounts[i]);
            _updateMarketData(_sportMarkets[i], _positions[i], _parlayMarket);
        }
    }

    function _updateMarketData(
        address _market,
        uint _position,
        address _parlayMarket
    ) internal {
        IParlayMarketData(parlayMarketData).addParlayForGamePosition(_market, _position, _parlayMarket);
    }

    function _sendPositionsToMarket(
        address _sportMarket,
        uint _position,
        address _parlayMarket,
        uint _amount
    ) internal {
        if (_position == 0) {
            (IPosition homePosition, , ) = ISportPositionalMarket(_sportMarket).getOptions();
            IERC20Upgradeable(address(homePosition)).safeTransfer(address(_parlayMarket), _amount);
        } else if (_position == 1) {
            (, IPosition awayPosition, ) = ISportPositionalMarket(_sportMarket).getOptions();
            IERC20Upgradeable(address(awayPosition)).safeTransfer(address(_parlayMarket), _amount);
        } else {
            (, , IPosition drawPosition) = ISportPositionalMarket(_sportMarket).getOptions();
            IERC20Upgradeable(address(drawPosition)).safeTransfer(address(_parlayMarket), _amount);
        }
    }

    function _obtainSportsAMMPosition(uint _position) internal pure returns (ISportsAMM.Position position) {
        if (_position == 0) {
            position = ISportsAMM.Position.Home;
        } else {
            position = _position == 1 ? ISportsAMM.Position.Away : ISportsAMM.Position.Draw;
        }
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

    // SETTERS

    function setParlayMarketMastercopies(address _parlayMarketMastercopy) external onlyOwner {
        parlayMarketMastercopy = _parlayMarketMastercopy;
    }

    function setAmounts(
        uint _maxSupportedAmount,
        uint _maxSupportedOdds,
        uint _parlayAMMFee,
        uint _safeBoxImpact,
        uint _referrerFee
    ) public onlyOwner {
        maxSupportedAmount = _maxSupportedAmount;
        maxSupportedOdds = _maxSupportedOdds;
        parlayAmmFee = _parlayAMMFee;
        safeBoxImpact = _safeBoxImpact;
        referrerFee = _referrerFee;
        emit SetAmounts(_maxSupportedAmount, maxSupportedOdds, _parlayAMMFee, _safeBoxImpact, _referrerFee);
    }

    function setAddresses(
        address _sportsAMM,
        IStakingThales _stakingThales,
        address _safeBox,
        address _referrals,
        address _parlayMarketData
    ) external onlyOwner {
        sportsAmm = ISportsAMM(_sportsAMM);
        sUSD.approve(address(sportsAmm), type(uint256).max);
        stakingThales = _stakingThales;
        safeBox = _safeBox;
        referrals = _referrals;
        parlayMarketData = _parlayMarketData;
        emit AddressesSet(_sportsAMM, address(_stakingThales), _safeBox, _referrals, _parlayMarketData);
    }

    function setCurveSUSD(
        address _curveSUSD,
        address _dai,
        address _usdc,
        address _usdt,
        bool _curveOnrampEnabled
    ) external onlyOwner {
        curveSUSD = ICurveSUSD(_curveSUSD);
        dai = _dai;
        usdc = _usdc;
        usdt = _usdt;
        IERC20(dai).approve(_curveSUSD, type(uint256).max);
        IERC20(usdc).approve(_curveSUSD, type(uint256).max);
        IERC20(usdt).approve(_curveSUSD, type(uint256).max);
        // not needed unless selling into different collateral is enabled
        //sUSD.approve(_curveSUSD, type(uint256).max);
        curveOnrampEnabled = _curveOnrampEnabled;
    }

    // MODIFIERS

    modifier knownParlayMarket(address market) {
        _knownParlayMarket(market);
        _;
    }

    function _knownParlayMarket(address _market) internal view {
        require(_knownMarkets.contains(_market), "Not a known parlay market");
    }

    event SetSUSD(address sUSD);
    event NewParlayMarket(address market, address[] markets, uint[] positions, uint amount, uint sUSDpaid);
    event ParlayMarketCreated(address market, address account, uint amount, uint sUSDPaid, uint sUSDAfterFees);
    event SetAmounts(uint max_amount, uint max_odds, uint _parlayAMMFee, uint _safeBoxImpact, uint _referrerFee);
    event AddressesSet(
        address _thalesAMM,
        address _stakingThales,
        address _safeBox,
        address _referrals,
        address _parlayMarketData
    );
    event ReferrerPaid(address refferer, address trader, uint amount, uint volume);
    event ExtraAmountTransferredDueToCancellation(address receiver, uint amount);
    event ParlayResolved(address _parlayOwner, bool _userWon);
}

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

import "./ParlayPosition.sol";
import "./ParlayMarket.sol";
import "../../interfaces/IParlayMarketData.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../interfaces/IStakingThales.sol";
import "../../interfaces/IReferrals.sol";
import "../../interfaces/ICurveSUSD.sol";

contract ParlayMarketsAMM is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using SafeMathUpgradeable for uint;
    using AddressSetLib for AddressSetLib.AddressSet;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant DEFAULT_PARLAY_SIZE = 4;

    ISportsAMM public sportsAmm;

    uint public parlayAmmFee;
    uint public parlaySize = DEFAULT_PARLAY_SIZE;

    mapping(address => mapping(address => address)) public createdParlayMarkets;
    AddressSetLib.AddressSet internal _knownMarkets;

    mapping(address => bool) public losingParlay;
    mapping(address => bool) public resolvedParlay;

    address public parlayMarketMastercopy;
    address public parlayPositionMastercopy;

    IERC20Upgradeable public sUSD;

    mapping(address => uint) public spentOnMarket;

    address public parlayMarketData;

    // IMPORTANT: AMM risks only half or the payout effectively, but it risks the whole amount on price movements
    uint public capPerMarket;
    uint public minSupportedPrice;
    uint public maxSupportedPrice;

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
        uint _capPerMarket,
        IERC20Upgradeable _sUSD,
        address _safeBox,
        uint _safeBoxImpact
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        sportsAmm = _sportsAmm;
        capPerMarket = _capPerMarket;
        parlayAmmFee = _parlayAmmFee;
        sUSD = _sUSD;
        safeBox = _safeBox;
        safeBoxImpact = _safeBoxImpact;

        sUSD.approve(address(sportsAmm), type(uint256).max);
    }
    
    function canCreateParlayMarket(address[] calldata _sportMarkets, uint[] calldata _positions) public view returns (bool canBeCreated) {
        uint numOfMarkets = _sportMarkets.length;
        uint numOfPositions = _positions.length;
        if(numOfMarkets == numOfPositions) {
            canBeCreated = true;
            for(uint i = 0; i< numOfMarkets; i++) {
                if(_positions[i] == 0 || _positions[i] > 2) {
                    canBeCreated = false;
                    break;
                }
                uint[] memory marketOdds = sportsAmm.getMarketDefaultOdds(_sportMarkets[i], false);
                if(marketOdds.length <= 1 && _positions[i] > marketOdds.length && marketOdds[_positions[i]] == 0){
                    canBeCreated = false;
                    break;
                }
            }
        }
    }
    
    function buyQuoteParlay(
        address[] calldata _sportMarkets, 
        uint[] calldata _positions,
        uint _amount
    ) public view returns(
        uint[] memory marketQuotes, 
        uint[] memory proportionalAmounts
        )
        {
            if(canCreateParlayMarket(_sportMarkets, _positions)) {
                uint numOfMarkets = _sportMarkets.length;
                marketQuotes = new uint[](numOfMarkets);
                proportionalAmounts = new uint[](numOfMarkets);
                (marketQuotes, proportionalAmounts) = _getQuotesAndAmounts(_sportMarkets, _positions, _amount);
            }
    }

    function buyParlay(
        address[] calldata _sportMarkets, 
        uint[] calldata _positions,
        uint _amount,
        uint[] calldata _marketQuotes, 
        uint[] calldata _proportionalAmounts, 
        uint _sUSDPaid,
        uint _additionalSlippage,
        bool _sendSUSD
        ) 
        external nonReentrant notPaused {
        // apply all checks
        require(canCreateParlayMarket(_sportMarkets, _positions), "Can't create this parlay market!");
        
        // checks for cretion missing

        if (_sendSUSD) {
            sUSD.safeTransferFrom(msg.sender, address(this), _sUSDPaid);
        }

        // mint the stateful token  (ERC-20)
        // clone a parlay market
        ParlayMarket parlayMarket = ParlayMarket(Clones.clone(parlayMarketMastercopy));
        parlayMarket.initialize(
                    _sportMarkets,
                    _positions, 
                    _amount, 
                    _sUSDPaid, 
                    address(this), 
                    msg.sender
                    );
        _knownMarkets.add(address(parlayMarket));

        // buy the positions
        _buyPositionsFromSportAMM(
            _sportMarkets,
            _positions,
            _proportionalAmounts,
            _marketQuotes, 
            _additionalSlippage,
            address(parlayMarket)
        );
        emit ParlayMarketCreated(address(parlayMarket), msg.sender, _amount, _sUSDPaid);
    }
    
    function exerciseParlay(address _parlayMarket) external nonReentrant notPaused {
        require(_knownMarkets.contains(_parlayMarket), "Unknown/Expired parlay");
        if(_isLosingParlay(_parlayMarket)) {
            if(!losingParlay[_parlayMarket]) {
                losingParlay[_parlayMarket] = true;
            }
            _exerciseResovedWinningSportMarkets(_parlayMarket);
        }
        else {
            ParlayMarket parlayMarket = ParlayMarket(_parlayMarket);
            require(parlayMarket.parlayOwner() == msg.sender, "Not ParlayOwner");
            require(parlayMarket.resolved(), "Not resolved");
            _exerciseResovedWinningSportMarkets(_parlayMarket);
            // do additional checks
            sUSD.safeTransfer(msg.sender, ParlayMarket(_parlayMarket).amount());
        }
    }

    function canExerciseAnySportPositionOnParlay(address _parlayMarket) external view returns(bool canExercise) {
        if(_knownMarkets.contains(_parlayMarket)) {
            canExercise = ParlayMarket(_parlayMarket).isAnySportMarketExercisable();
        }
    }

    function _isLosingParlay(address _parlayMarket) internal view returns(bool isLosing) {
        isLosing = ParlayMarket(_parlayMarket).parlayAlreadyLost();
    }

    function _exerciseResovedWinningSportMarkets(address _parlayMarket) internal {
        if(_knownMarkets.contains(_parlayMarket)) {
            ParlayMarket(_parlayMarket).exerciseWiningSportMarkets();
            if(ParlayMarket(_parlayMarket).resolved()) {
                resolvedParlay[_parlayMarket] = true;
                _knownMarkets.remove(_parlayMarket);
            }
        }
    }

    function _buyPositionsFromSportAMM(
        address[] calldata _sportMarkets, 
        uint[] calldata _positions,
        uint[] calldata _marketQuotes, 
        uint[] calldata _proportionalAmounts,
        uint _additionalSlippage, 
        address _parlayMarket
    ) internal {
        uint numOfMarkets = _sportMarkets.length;
        for(uint i=0; i < numOfMarkets; i++) {
           sportsAmm.buyFromAMM(
                _sportMarkets[i],
                _obtainSportsAMMPosition(_positions[i]),
                _proportionalAmounts[i],
                _marketQuotes[i], 
                _additionalSlippage
            ); 
            _sendPositionsToMarket(_sportMarkets[i], _positions[i], _parlayMarket, _proportionalAmounts[i]);
            _updateMarketData(_sportMarkets[i], _positions[i], _parlayMarket);
        }
    }

    function _updateMarketData(address _market, uint _position, address _parlayMarket) internal {
        IParlayMarketData(parlayMarketData).addParlayForGamePosition(_market, _position, _parlayMarket);
    }

    function _sendPositionsToMarket(address _sportMarket, uint _position, address _parlayMarket, uint _amount) internal {
        if(_position == 0) {
            (IPosition homePosition, , ) = ISportPositionalMarket(_sportMarket).getOptions();
            IERC20Upgradeable(address(homePosition)).safeTransfer(address(_parlayMarket), _amount);
        }
        else if(_position == 1) {
            ( , IPosition awayPosition, ) = ISportPositionalMarket(_sportMarket).getOptions();
            IERC20Upgradeable(address(awayPosition)).safeTransfer(address(_parlayMarket), _amount);
        }
        else {
            ( , , IPosition drawPosition) = ISportPositionalMarket(_sportMarket).getOptions();
            IERC20Upgradeable(address(drawPosition)).safeTransfer(address(_parlayMarket), _amount);
        }
    }

    function _obtainSportsAMMPosition(uint _position) internal pure returns(ISportsAMM.Position position) {
        if(_position == 0) {
            position = ISportsAMM.Position.Home;
        }
        else{
            position = _position == 1 ? ISportsAMM.Position.Away : ISportsAMM.Position.Draw;
        }
    }

    function _getQuotesAndAmounts(
        address[] calldata _sportMarkets, 
        uint[] calldata _positions, 
        uint _amount) 
        internal view returns(
            uint[] memory marketQuotes, 
            uint[] memory proportionalAmounts
            ) 
        {
            uint numOfMarkets = _sportMarkets.length;
            uint[] memory quotes = new uint[](numOfMarkets);
            quotes = _getQuotes(_sportMarkets, _positions);
            quotes = _reverseAndNormalize(quotes);
            for(uint i=0; i < numOfMarkets; i++) {
                proportionalAmounts[i] = quotes[i].mul(_amount);

                marketQuotes[i] = sportsAmm.buyFromAmmQuote(
                    _sportMarkets[i],
                    _obtainSportsAMMPosition(_positions[i]),
                    proportionalAmounts[i]
                );
                
            }
    }

    function _getQuotes(address[] calldata _sportMarkets, uint[] calldata _positions) internal view returns(uint[] memory quotes) {
        uint length = _sportMarkets.length;
        quotes = new uint[](length);
        uint[] memory odds;
        for(uint i=0; i < length; i++) {
            odds = sportsAmm.getMarketDefaultOdds(_sportMarkets[i], false);
            quotes[i] = odds[_positions[i]];
        }
    }

    function _reverseAndNormalize(uint[] memory _quotes) internal pure returns(uint[] memory) {
        uint length = _quotes.length;
        uint sum;
        for(uint i=0; i < length; i++) {
            _quotes[i] = ONE.sub(_quotes[i]);
            sum = sum.add(_quotes[i]);
        }
        for(uint i=0; i < length; i++) {
            _quotes[i] = _quotes[i].mul(ONE).div(sum).div(ONE);
        }
        return _quotes;
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

    
    function transferRestOfSUSDAmount(address receiver, uint amount, bool dueToCancellation) external {
        require(_knownMarkets.contains(msg.sender), "Not a known parlay market");
        if(dueToCancellation) {
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

    function setParlayMarketMastercopies(address _parlayMarketMastercopy, address _parlayPositionMastercopy)
        external
        onlyOwner
    {
        parlayMarketMastercopy = _parlayMarketMastercopy;
        parlayPositionMastercopy = _parlayPositionMastercopy;
    }

    function setMinMaxSupportedPrice(
        uint _minSupportedPrice,
        uint _maxSupportedPrice
    ) public onlyOwner {
        minSupportedPrice = _minSupportedPrice;
        maxSupportedPrice = _maxSupportedPrice;
        emit SetMinMaxSupportedPrice(minSupportedPrice, maxSupportedPrice);
    }

    function setSafeBoxData(address _safeBox, uint _safeBoxImpact) external onlyOwner {
        safeBoxImpact = _safeBoxImpact;
        safeBox = _safeBox;
        emit SetSafeBoxImpact(_safeBoxImpact);
        emit SetSafeBox(_safeBox);
    }

    function setCapPerMarketAndParlayAMMFee(uint _capPerMarket, uint _parlayAMMFee) external onlyOwner {
        capPerMarket = _capPerMarket;
        parlayAmmFee = _parlayAMMFee;
        emit SetCapPerMarket(capPerMarket);
        emit SetParlayAmmFee(parlayAmmFee);
    }

    function setThalesAMMStakingThalesAndReferrals(
        address _thalesAMM,
        IStakingThales _stakingThales,
        address _referrals,
        uint _referrerFee,
        address _parlayMarketData
    ) external onlyOwner {
        sportsAmm = ISportsAMM(_thalesAMM);
        sUSD.approve(address(sportsAmm), type(uint256).max);
        stakingThales = _stakingThales;
        referrals = _referrals;
        referrerFee = _referrerFee;
        parlayMarketData = _parlayMarketData;
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

    modifier knownParlayMarket(address market) {
        _knownParlayMarket(market);
        _;
    }

    function _knownParlayMarket(address _market) internal {
        require(_knownMarkets.contains(_market), "Not a known parlay market");
    }


    event SetSUSD(address sUSD);
    event ParlayMarketCreated(address market, address account, uint amount, uint sUSDPaid);
    event SetSafeBoxImpact(uint _safeBoxImpact);
    event SetSafeBox(address _safeBox);
    event SetMinMaxSupportedPrice(uint min_spread, uint max_spread);
    event SetCapPerMarket(uint capPerMarket);
    event SetParlayAmmFee(uint parlayAmmFee);
    event SetStakingThales(address _stakingThales);
    event ReferrerPaid(address refferer, address trader, uint amount, uint volume);
    event ExtraAmountTransferredDueToCancellation(address receiver, uint amount);

}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "../../interfaces/IParlayMarketsAMM.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../../utils/libraries/AddressSetLib.sol";
import "./ParlayMarket.sol";

contract ParlayMarketData is Initializable, ProxyOwned, ProxyPausable {
    using AddressSetLib for AddressSetLib.AddressSet;
    AddressSetLib.AddressSet internal _knownMarkets;
    struct ParlayDetails {
        uint amount;
        uint sUSDPaid;
    }

    mapping(address => mapping(uint => AddressSetLib.AddressSet)) internal _parlaysInGamePosition;

    mapping(address => mapping(uint => mapping(uint => address))) public gameAddressPositionParlay;
    mapping(address => mapping(uint => uint)) public numOfParlaysInGamePosition;

    mapping(address => ParlayDetails) public parlayDetails;
    mapping(address => mapping(uint => address)) public userParlays;
    mapping(address => address) public parlayOwner;
    mapping(address => uint) public userNumOfParlays;
    address public parlayMarketsAMM;

    function initialize(address _owner, address _parlayMarketsAMM) external initializer {
        setOwner(_owner);
        parlayMarketsAMM = _parlayMarketsAMM;
    }

    function getParlayOutcomeDetails(address _parlayMarket)
        external
        view
        returns (
            bool resolved,
            bool parlayPaused,
            bool alreadyLost,
            bool fundsIssued
        )
    {
        ParlayMarket parlay = ParlayMarket(_parlayMarket);
        if (parlay.initialized()) {
            resolved = parlay.resolved();
            parlayPaused = parlay.paused();
            alreadyLost = parlay.parlayAlreadyLost();
            fundsIssued = parlay.fundsIssued();
        }
    }

    function getParlayDetails(address _parlayMarket)
        external
        view
        returns (
            uint numOfSportMarkets,
            uint amount,
            uint sUSDPaid,
            uint totalResultQuote,
            bool resolved,
            bool parlayPaused,
            bool alreadyLost,
            bool fundsIssued,
            address[] memory markets,
            uint[] memory positions,
            uint[] memory oddsOnCreation,
            uint[] memory marketResults,
            bool[] memory resolvedMarkets,
            bool[] memory exercisedMarkets
        )
    {
        ParlayMarket parlay = ParlayMarket(_parlayMarket);
        if (parlay.initialized()) {
            numOfSportMarkets = parlay.numOfSportMarkets();
            amount = parlay.amount();
            sUSDPaid = parlay.sUSDPaid();
            totalResultQuote = parlay.totalResultQuote();
            resolved = parlay.resolved();
            parlayPaused = parlay.paused();
            alreadyLost = parlay.parlayAlreadyLost();
            fundsIssued = parlay.fundsIssued();
            markets = new address[](numOfSportMarkets);
            positions = new uint[](numOfSportMarkets);
            oddsOnCreation = new uint[](numOfSportMarkets);
            marketResults = new uint[](numOfSportMarkets);
            resolvedMarkets = new bool[](numOfSportMarkets);
            exercisedMarkets = new bool[](numOfSportMarkets);
            for (uint i = 0; i < numOfSportMarkets; i++) {
                (
                    markets[i],
                    positions[i],
                    oddsOnCreation[i],
                    marketResults[i],
                    resolvedMarkets[i],
                    exercisedMarkets[i],
                    ,

                ) = parlay.sportMarket(i);
            }
        }
    }

    function getUserParlays(address _userAccount) external view returns (address[] memory userAllParlays) {
        userAllParlays = new address[](userNumOfParlays[_userAccount]);
        for (uint i = 0; i < userNumOfParlays[_userAccount]; i++) {
            userAllParlays[i] = userParlays[_userAccount][i];
        }
    }

    function getAllParlaysForGamePosition(address _sportMarket, uint _position) external view returns (address[] memory) {
        return _getAllParlaysForGamePosition(_sportMarket, _position);
    }

    function getAllParlaysForGame(address _sportMarket)
        external
        view
        returns (
            address[] memory homeParlays,
            address[] memory awayParlays,
            address[] memory drawParlays
        )
    {
        homeParlays = _getAllParlaysForGamePosition(_sportMarket, 0);
        awayParlays = _getAllParlaysForGamePosition(_sportMarket, 1);
        if (ISportPositionalMarket(_sportMarket).optionsCount() > 2) {
            drawParlays = _getAllParlaysForGamePosition(_sportMarket, 2);
        }
    }

    // todo
    function exerciseParlays(address[] memory _parlayMarket) external {
        for (uint i = 0; i < _parlayMarket.length; i++) {
            if (IParlayMarketsAMM(parlayMarketsAMM).isActiveParlay(_parlayMarket[i])) {
                IParlayMarketsAMM(parlayMarketsAMM).exerciseParlay(_parlayMarket[i]);
            }
        }
    }

    // todo
    function exerciseSportMarketInParlays(address[] memory _parlayMarket, address _sportMarket) external {
        for (uint i = 0; i < _parlayMarket.length; i++) {
            if (IParlayMarketsAMM(parlayMarketsAMM).isActiveParlay(_parlayMarket[i])) {
                IParlayMarketsAMM(parlayMarketsAMM).exerciseSportMarketInParlay(_parlayMarket[i], _sportMarket);
            }
        }
    }

    function addUserParlay(address _parlayMarket, address _parlayOwner) external onlyParlayAMM {
        userNumOfParlays[_parlayOwner] = userNumOfParlays[_parlayOwner] + 1;
        userParlays[_parlayOwner][userNumOfParlays[_parlayOwner]] = _parlayMarket;
    }

    function addParlayForGamePosition(
        address _game,
        uint _position,
        address _parlayMarket,
        address _parlayOwner
    ) external onlyParlayAMM {
        require(msg.sender == parlayMarketsAMM, "Invalid sender");
        if (parlayOwner[_parlayMarket] == address(0)) {
            parlayOwner[_parlayMarket] = _parlayOwner;
            userNumOfParlays[_parlayOwner] = userNumOfParlays[_parlayOwner] + 1;
            userParlays[_parlayOwner][userNumOfParlays[_parlayOwner]] = _parlayMarket;
        }
        _parlaysInGamePosition[_game][_position].add(_parlayMarket);
        gameAddressPositionParlay[_game][_position][numOfParlaysInGamePosition[_game][_position]] = _parlayMarket;
        numOfParlaysInGamePosition[_game][_position] += 1;
    }

    function removeParlayForGamePosition(
        address _game,
        uint _position,
        address _parlayMarket
    ) external onlyParlayAMM {
        require(msg.sender == parlayMarketsAMM, "Invalid sender");
        _parlaysInGamePosition[_game][_position].remove(_parlayMarket);
    }

    function isGameInParlay(address _game, address _parlay) external view returns (bool containsParlay, uint position) {
        for (uint i = 0; i < 3; i++) {
            if (_parlaysInGamePosition[_game][i].contains(_parlay)) {
                containsParlay = true;
                position = i;
            }
        }
    }

    function isGamePositionInParlay(
        address _game,
        uint _position,
        address _parlay
    ) public view returns (bool containsParlay) {
        containsParlay = _parlaysInGamePosition[_game][_position].contains(_parlay);
    }

    function _getAllParlaysForGamePosition(address _sportMarket, uint _position)
        internal
        view
        returns (address[] memory allParlays)
    {
        allParlays = new address[](numOfParlaysInGamePosition[_sportMarket][_position]);
        for (uint i = 0; i < numOfParlaysInGamePosition[_sportMarket][_position]; i++) {
            allParlays[i] = gameAddressPositionParlay[_sportMarket][_position][i];
        }
    }

    function setParlayMarketsAMM(address _parlayMarketsAMM) external onlyOwner {
        parlayMarketsAMM = _parlayMarketsAMM;
        emit SetParlayMarketsAMM(_parlayMarketsAMM);
    }

    modifier onlyParlayAMM() {
        _onlyParlayAMM();
        _;
    }

    function _onlyParlayAMM() internal view {
        require(msg.sender == parlayMarketsAMM, "Not ParlayAMM");
    }

    event SetParlayMarketsAMM(address _parlayMarketsAMM);
}

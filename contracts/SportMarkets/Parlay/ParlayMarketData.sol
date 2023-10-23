// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "../../interfaces/IParlayMarketsAMM.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../../utils/libraries/AddressSetLib.sol";
import "./ParlayMarket.sol";

contract ParlayMarketData is Initializable, ProxyOwned, ProxyPausable {
    using AddressSetLib for AddressSetLib.AddressSet;
    AddressSetLib.AddressSet internal _knownMarkets;

    uint private constant ONE = 1e18;

    struct ParlayDetails {
        uint amount;
        uint sUSDPaid;
    }

    struct SGPFees {
        uint tag;
        uint sgpMoneylineTotals;
        uint sgpMoneylineSpreads;
        uint sgpSpreadsTotals;
    }

    mapping(address => mapping(uint => AddressSetLib.AddressSet)) internal _parlaysInGamePosition;

    mapping(address => mapping(uint => mapping(uint => address))) public gameAddressPositionParlay;
    mapping(address => mapping(uint => uint)) public numOfParlaysInGamePosition;

    mapping(address => ParlayDetails) public parlayDetails;
    mapping(address => mapping(uint => address)) public userParlays;
    mapping(address => address) public parlayOwner;
    mapping(address => uint) public userNumOfParlays;
    address public parlayMarketsAMM;

    struct ParlayAmmParameters {
        uint minUSDAmount;
        uint maxSupportedAmount;
        uint maxSupportedOdds;
        uint parlayAmmFee;
        uint safeBoxImpact;
        uint parlaySize;
    }

    function initialize(address _owner, address _parlayMarketsAMM) external initializer {
        setOwner(_owner);
        parlayMarketsAMM = _parlayMarketsAMM;
    }

    function getParlayOutcomeDetails(address _parlayMarket)
        external
        view
        returns (
            bool initialized,
            bool resolved,
            bool parlayPaused,
            bool alreadyLost,
            bool fundsIssued
        )
    {
        ParlayMarket parlay = ParlayMarket(_parlayMarket);
        if (parlay.initialized()) {
            initialized = parlay.initialized();
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

    function getAllParlaysForGames(address[] memory _sportMarket)
        external
        view
        returns (address[] memory parlays, uint numOfParlays)
    {
        address[] memory homeParlays;
        address[] memory awayParlays;
        address[] memory drawParlays;
        uint max_length;
        uint totalNumOfParlays;
        bool addToExercise;
        uint8 marketResult;
        bool alreadyLost;
        for (uint i = 0; i < _sportMarket.length; i++) {
            totalNumOfParlays +=
                numOfParlaysInGamePosition[_sportMarket[i]][0] +
                numOfParlaysInGamePosition[_sportMarket[i]][1] +
                numOfParlaysInGamePosition[_sportMarket[i]][2];
        }
        parlays = new address[](totalNumOfParlays);
        for (uint i = 0; i < _sportMarket.length; i++) {
            (homeParlays, awayParlays, drawParlays) = _getAllParlaysForGame(_sportMarket[i]);
            max_length = homeParlays.length > awayParlays.length ? homeParlays.length : awayParlays.length;
            max_length = drawParlays.length > 0 && drawParlays.length > max_length ? drawParlays.length : max_length;
            if (ISportPositionalMarket(_sportMarket[i]).resolved() && !ISportPositionalMarket(_sportMarket[i]).cancelled()) {
                marketResult = uint8(ISportPositionalMarket(_sportMarket[i]).result());
                for (uint j = 0; j < max_length; j++) {
                    if (homeParlays.length > j) {
                        alreadyLost = ParlayMarket(homeParlays[j]).parlayAlreadyLost();
                        addToExercise = ParlayMarket(homeParlays[j]).fundsIssued();
                        addToExercise =
                            (!alreadyLost && marketResult != 1) ||
                            (alreadyLost && marketResult == 1 && !addToExercise);
                        if (addToExercise) {
                            parlays[numOfParlays] = homeParlays[j];
                            numOfParlays++;
                        }
                    }
                    if (awayParlays.length > j) {
                        alreadyLost = ParlayMarket(awayParlays[j]).parlayAlreadyLost();
                        addToExercise = ParlayMarket(awayParlays[j]).fundsIssued();
                        addToExercise =
                            (!alreadyLost && marketResult != 2) ||
                            (alreadyLost && marketResult == 2 && !addToExercise);
                        if (addToExercise) {
                            parlays[numOfParlays] = awayParlays[j];
                            numOfParlays++;
                        }
                    }
                    if (drawParlays.length > j) {
                        alreadyLost = ParlayMarket(drawParlays[j]).parlayAlreadyLost();
                        addToExercise = ParlayMarket(drawParlays[j]).fundsIssued();
                        addToExercise =
                            (!alreadyLost && marketResult != 3) ||
                            (alreadyLost && marketResult == 3 && !addToExercise);
                        if (addToExercise) {
                            parlays[numOfParlays] = drawParlays[j];
                            numOfParlays++;
                        }
                    }
                }
            }
        }
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
        (homeParlays, awayParlays, drawParlays) = _getAllParlaysForGame(_sportMarket);
    }

    function getParlayAMMParameters() external view returns (ParlayAmmParameters memory) {
        return
            ParlayAmmParameters(
                IParlayMarketsAMM(parlayMarketsAMM).minUSDAmount(),
                IParlayMarketsAMM(parlayMarketsAMM).maxSupportedAmount(),
                IParlayMarketsAMM(parlayMarketsAMM).maxSupportedOdds(),
                IParlayMarketsAMM(parlayMarketsAMM).parlayAmmFee(),
                IParlayMarketsAMM(parlayMarketsAMM).safeBoxImpact(),
                IParlayMarketsAMM(parlayMarketsAMM).parlaySize()
            );
    }

    function _getAllParlaysForGame(address _sportMarket)
        internal
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
        uint profit = IERC20Upgradeable(IParlayMarketsAMM(parlayMarketsAMM).sUSD()).balanceOf(parlayMarketsAMM);
        for (uint i = 0; i < _parlayMarket.length; i++) {
            if (IParlayMarketsAMM(parlayMarketsAMM).isActiveParlay(_parlayMarket[i])) {
                IParlayMarketsAMM(parlayMarketsAMM).exerciseParlay(_parlayMarket[i]);
            }
        }
        profit = IERC20Upgradeable(IParlayMarketsAMM(parlayMarketsAMM).sUSD()).balanceOf(parlayMarketsAMM) - profit;
        emit ParlaysExercised(profit, _parlayMarket);
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

    function getAllSGPFees() external view returns (SGPFees[] memory sgpFees) {
        uint numberOfFeesSet;
        uint[] memory indexes = new uint[](100);
        for (uint i = 9001; i < 9999; i++) {
            if (
                IParlayMarketsAMM(parlayMarketsAMM).getSgpFeePerCombination(i, 0, 10002, 3, 3) > 0 ||
                IParlayMarketsAMM(parlayMarketsAMM).getSgpFeePerCombination(i, 0, 10001, 3, 3) > 0 ||
                IParlayMarketsAMM(parlayMarketsAMM).getSgpFeePerCombination(i, 10001, 10002, 3, 3) > 0
            ) {
                indexes[numberOfFeesSet] = i;
                ++numberOfFeesSet;
            }
        }
        if (numberOfFeesSet > 0) {
            sgpFees = new SGPFees[](numberOfFeesSet);
            for (uint i = 0; i < numberOfFeesSet; i++) {
                sgpFees[i].tag = indexes[i];
                sgpFees[i].sgpMoneylineTotals = IParlayMarketsAMM(parlayMarketsAMM).getSgpFeePerCombination(
                    indexes[i],
                    0,
                    10002,
                    3,
                    3
                );
                sgpFees[i].sgpMoneylineSpreads = IParlayMarketsAMM(parlayMarketsAMM).getSgpFeePerCombination(
                    indexes[i],
                    0,
                    10001,
                    3,
                    3
                );
                sgpFees[i].sgpSpreadsTotals = IParlayMarketsAMM(parlayMarketsAMM).getSgpFeePerCombination(
                    indexes[i],
                    10001,
                    10002,
                    3,
                    3
                );
            }
        }
    }

    function getAllSGPFeesForBatch(uint[] calldata tags) external view returns (SGPFees[] memory sgpFees) {
        sgpFees = new SGPFees[](tags.length);
        for (uint i = 0; i < tags.length; i++) {
            sgpFees[i].tag = tags[i];
            sgpFees[i].sgpMoneylineTotals = IParlayMarketsAMM(parlayMarketsAMM).getSgpFeePerCombination(
                tags[i],
                0,
                10002,
                3,
                3
            );
            sgpFees[i].sgpMoneylineSpreads = IParlayMarketsAMM(parlayMarketsAMM).getSgpFeePerCombination(
                tags[i],
                0,
                10001,
                3,
                3
            );
            sgpFees[i].sgpSpreadsTotals = IParlayMarketsAMM(parlayMarketsAMM).getSgpFeePerCombination(
                tags[i],
                10001,
                10002,
                3,
                3
            );
        }
    }

    function getCombinedMarketOdd(
        address[] memory _sportMarkets,
        uint[] memory _positions
        ) external view returns(uint quote) {
            if(_sportMarkets.length == 2 && _positions.length == 2) {
                ( , , quote, , , , ) = IParlayMarketsAMM(parlayMarketsAMM).buyQuoteFromParlay(_sportMarkets, _positions, ONE);
            }
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
    event ParlaysExercised(uint profit, address[] parlays);
}

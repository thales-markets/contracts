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
            fundsIssued = parlay.resolved();
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
            fundsIssued = parlay.resolved();
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

    function getCombinedMarketOdd(address[] memory _sportMarkets, uint[] memory _positions)
        external
        view
        returns (uint quote)
    {
        if (_sportMarkets.length == 2 && _positions.length == 2) {
            (, , quote, , , , ) = IParlayMarketsAMM(parlayMarketsAMM).buyQuoteFromParlay(_sportMarkets, _positions, ONE);
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

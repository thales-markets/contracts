// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";

// interface
import "../interfaces/ISportPositionalMarketManager.sol";

/// @title Sports AMM Risk contract
/// @author gruja
contract SportAMMRiskManager is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    /* ========== RISK MANAGER CONST VARIABLES ========== */
    uint public constant MIN_TAG_NUMBER = 9000;
    uint public constant MIN_CHILD_NUMBER = 10000;
    uint public constant MIN_PLAYER_PROPS_NUMBER = 11000;

    /* ========== RISK MANAGER STATE VARIABLES ========== */
    address public manager;
    uint public defaultCapPerGame;
    mapping(uint => uint) public capPerSport;
    mapping(uint => mapping(uint => uint)) public capPerSportAndChild;
    mapping(address => uint) public capPerMarket;

    uint public defaultRiskMultiplier;
    mapping(uint => uint) public riskMultiplierForSport;
    mapping(address => uint) public riskMultiplierPerMarket;

    uint public maxCap;
    uint public maxRiskMultiplier;

    mapping(uint => bool) public isMarketForSportOnePositional;
    mapping(uint => bool) public isMarketForPlayerPropsOnePositional;

    // @return specific min_spread per address
    mapping(uint => mapping(uint => uint)) public minSpreadPerSport;

    /// @return The maximum supported odd for sport
    mapping(uint => uint) public minSupportedOddsPerSport;

    /// @return The maximum supported odd for sport
    mapping(uint => uint) public maxSpreadPerSport;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        address _manager,
        uint _defaultCapPerGame,
        uint[] memory _sportIds,
        uint[] memory _capsPerSport,
        uint[] memory _sportIdsForChilds,
        uint[] memory _childsIds,
        uint[] memory _capsForChilds,
        uint _defaultRiskMultiplier,
        uint[] memory _sportIdsForMultiplier,
        uint[] memory _riskMultiplierPerSport
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        defaultCapPerGame = _defaultCapPerGame;
        defaultRiskMultiplier = _defaultRiskMultiplier;
        manager = _manager;

        for (uint i; i < _sportIds.length; i++) {
            capPerSport[_sportIds[i]] = _capsPerSport[i];
        }

        for (uint i; i < _sportIdsForChilds.length; i++) {
            capPerSportAndChild[_sportIdsForChilds[i]][_childsIds[i]] = _capsForChilds[i];
        }

        for (uint i; i < _sportIdsForMultiplier.length; i++) {
            riskMultiplierForSport[_sportIdsForMultiplier[i]] = _riskMultiplierPerSport[i];
        }
    }

    /* ========== VIEW FUNCTIONS ========== */

    /// @notice calculate which cap needs to be applied to the given market
    /// @param _market to get cap for
    /// @return toReturn cap to use
    function calculateCapToBeUsed(address _market) external view returns (uint toReturn) {
        return _calculateCapToBeUsed(_market);
    }

    /// @notice returns if market is in to much of a risk
    /// @param _totalSpent total spent on market
    /// @param _market for which is calculation done
    /// @return _isNotRisky true/false
    function isTotalSpendingLessThanTotalRisk(uint _totalSpent, address _market) external view returns (bool _isNotRisky) {
        uint capToBeUsed = _calculateCapToBeUsed(_market);
        uint riskMultiplier = _calculateRiskMultiplier(_market);
        return _totalSpent <= capToBeUsed * riskMultiplier;
    }

    /// @notice returns all data (caps, min spread, etc.) for given sports
    /// @param _sportIds sport ids
    /// @return _capsPerSport caps per sport
    /// @return _capsPerSportH caps per child H
    /// @return _capsPerSportT caps per child T
    /// @return _capsPerSportPP caps per child PP
    /// @return _minSpreadSport min spread per sport
    /// @return _minSpreadSportH min spread per child H
    /// @return _minSpreadSportT min spread per child T
    /// @return _minSpreadSportPP min spread per child PP
    function getAllDataForSports(uint[] memory _sportIds)
        external
        view
        returns (
            uint[] memory _capsPerSport,
            uint[] memory _capsPerSportH,
            uint[] memory _capsPerSportT,
            uint[] memory _capsPerSportPP,
            uint[] memory _minSpreadSport,
            uint[] memory _minSpreadSportH,
            uint[] memory _minSpreadSportT,
            uint[] memory _minSpreadSportPP
        )
    {
        _capsPerSport = new uint[](_sportIds.length);
        _capsPerSportH = new uint[](_sportIds.length);
        _capsPerSportT = new uint[](_sportIds.length);
        _capsPerSportPP = new uint[](_sportIds.length);
        _minSpreadSport = new uint[](_sportIds.length);
        _minSpreadSportH = new uint[](_sportIds.length);
        _minSpreadSportT = new uint[](_sportIds.length);
        _minSpreadSportPP = new uint[](_sportIds.length);

        for (uint i = 0; i < _sportIds.length; i++) {
            _capsPerSport[i] = capPerSport[_sportIds[i]];
            _capsPerSportH[i] = capPerSportAndChild[_sportIds[i]][MIN_CHILD_NUMBER + 1];
            _capsPerSportT[i] = capPerSportAndChild[_sportIds[i]][MIN_CHILD_NUMBER + 2];
            _capsPerSportPP[i] = capPerSportAndChild[_sportIds[i]][MIN_CHILD_NUMBER + 10];
            _minSpreadSport[i] = minSpreadPerSport[_sportIds[i]][0];
            _minSpreadSportH[i] = minSpreadPerSport[_sportIds[i]][MIN_CHILD_NUMBER + 1];
            _minSpreadSportT[i] = minSpreadPerSport[_sportIds[i]][MIN_CHILD_NUMBER + 2];
            _minSpreadSportPP[i] = minSpreadPerSport[_sportIds[i]][MIN_CHILD_NUMBER + 10];
        }
    }

    /* ========== INTERNALS ========== */

    function _calculateRiskMultiplier(address market) internal view returns (uint toReturn) {
        uint marketRisk = riskMultiplierPerMarket[market];

        if (marketRisk == 0) {
            (uint tag1, ) = _getTagsForMarket(market);
            uint riskPerTag = riskMultiplierForSport[tag1];
            marketRisk = riskPerTag > 0 ? riskPerTag : defaultRiskMultiplier;
        }

        toReturn = marketRisk;
    }

    function _calculateCapToBeUsed(address market) internal view returns (uint toReturn) {
        toReturn = capPerMarket[market];
        if (toReturn == 0) {
            (uint tag1, uint tag2) = _getTagsForMarket(market);
            uint capFirstTag = capPerSport[tag1];
            capFirstTag = capFirstTag > 0 ? capFirstTag : defaultCapPerGame;
            toReturn = capFirstTag;

            if (tag2 > 0) {
                uint capSecondTag = capPerSportAndChild[tag1][tag2];
                toReturn = capSecondTag > 0 ? capSecondTag : capFirstTag / 2;
            }
        }
    }

    function _getTagsForMarket(address _market) internal view returns (uint tag1, uint tag2) {
        ISportPositionalMarket sportMarket = ISportPositionalMarket(_market);
        tag1 = sportMarket.tags(0);
        tag2 = sportMarket.isChild() ? sportMarket.tags(1) : 0;
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    /// @notice Setting the Cap per spec. market
    /// @param _markets market addresses
    /// @param _capPerMarket The cap amount used for the specific markets
    function setCapPerMarket(address[] memory _markets, uint _capPerMarket) external {
        require(
            msg.sender == owner || ISportPositionalMarketManager(manager).isWhitelistedAddress(msg.sender),
            "Invalid sender"
        );
        require(_capPerMarket <= maxCap, "Invalid cap");
        for (uint i; i < _markets.length; i++) {
            require(_markets[i] != address(0), "Invalid address");
            capPerMarket[_markets[i]] = _capPerMarket;
            emit SetCapPerMarket(_markets[i], _capPerMarket);
        }
    }

    /// @notice Setting the Cap per Sport ID
    /// @param _sportID The tagID used for sport (9004)
    /// @param _childID The tagID used for childid (10002)
    /// @param _capPerChild The cap amount used for the sportID
    function setCapPerSportAndChild(
        uint _sportID,
        uint _childID,
        uint _capPerChild
    ) external onlyOwner {
        uint currentCapPerSport = capPerSport[_sportID] > 0 ? capPerSport[_sportID] : defaultCapPerGame;
        require(_capPerChild <= currentCapPerSport, "Invalid cap");
        require(_sportID > MIN_TAG_NUMBER, "Invalid tag for sport");
        require(_childID > MIN_CHILD_NUMBER, "Invalid tag for child");
        capPerSportAndChild[_sportID][_childID] = _capPerChild;
        emit SetCapPerSportAndChild(_sportID, _childID, _capPerChild);
    }

    /// @notice Setting the Cap per Sport ID
    /// @param _sportID The tagID used for each market
    /// @param _capPerSport The cap amount used for the sportID
    function setCapPerSport(uint _sportID, uint _capPerSport) external onlyOwner {
        require(_sportID > MIN_TAG_NUMBER, "Invalid tag for sport");
        require(_capPerSport <= maxCap, "Invalid cap");
        capPerSport[_sportID] = _capPerSport;
        emit SetCapPerSport(_sportID, _capPerSport);
    }

    /// @notice Setting the Cap per game default value
    /// @param _capPerGame default cap
    function setDefaultCapPerGame(uint _capPerGame) external onlyOwner {
        require(_capPerGame <= maxCap, "Invalid cap");
        defaultCapPerGame = _capPerGame;
        emit SetDefaultCapPerGame(_capPerGame);
    }

    /// @notice default risk multiplier
    /// @param _riskMultiplier risk multiplier
    function setDefaultRiskMultiplier(uint _riskMultiplier) external onlyOwner {
        require(_riskMultiplier <= maxRiskMultiplier, "Invalid multiplier");
        defaultRiskMultiplier = _riskMultiplier;
        emit SetDefaultRiskMultiplier(_riskMultiplier);
    }

    /// @notice Setting the risk multiplier per Sport ID
    /// @param _sportID The tagID used for each market
    /// @param _riskMultiplier The risk multiplier amount used for the sportID
    function setRiskMultiplierPerSport(uint _sportID, uint _riskMultiplier) external onlyOwner {
        require(_sportID > MIN_TAG_NUMBER, "Invalid tag for sport");
        require(_riskMultiplier <= maxRiskMultiplier, "Invalid multiplier");
        riskMultiplierForSport[_sportID] = _riskMultiplier;
        emit SetRiskMultiplierPerSport(_sportID, _riskMultiplier);
    }

    /// @notice Setting the risk multiplier per spec. market
    /// @param _markets market addresses
    /// @param _riskMultiplier The risk multiplier used for the specific markets
    function setRiskMultiplierMarket(address[] memory _markets, uint _riskMultiplier) external {
        require(
            msg.sender == owner || ISportPositionalMarketManager(manager).isWhitelistedAddress(msg.sender),
            "Invalid sender"
        );
        require(_riskMultiplier <= maxRiskMultiplier, "Invalid multiplier");
        for (uint i; i < _markets.length; i++) {
            require(_markets[i] != address(0), "Invalid address");
            riskMultiplierPerMarket[_markets[i]] = _riskMultiplier;
            emit SetRiskMultiplierPerMarket(_markets[i], _riskMultiplier);
        }
    }

    /// @notice Setting the Sport Positional Manager contract address
    /// @param _manager Address of Staking contract
    function setSportsPositionalMarketManager(address _manager) external onlyOwner {
        require(_manager != address(0), "Invalid address");
        manager = _manager;
        emit SetSportsPositionalMarketManager(_manager);
    }

    /// @notice Setting the max cap and risk per market
    /// @param _maxCap max cap per market
    /// @param _maxRisk max risk multiplier
    function setMaxCapAndRisk(uint _maxCap, uint _maxRisk) external onlyOwner {
        require(_maxCap > defaultCapPerGame && _maxRisk > defaultRiskMultiplier, "Invalid input");
        maxCap = _maxCap;
        maxRiskMultiplier = _maxRisk;
        emit SetMaxCapAndRisk(_maxCap, _maxRisk);
    }

    function setMinSupportedOddsAndMaxSpreadPerSportPerSport(
        uint _sportID,
        uint _minSupportedOdds,
        uint _maxSpreadPerSport
    ) external onlyOwner {
        minSupportedOddsPerSport[_sportID] = _minSupportedOdds;
        maxSpreadPerSport[_sportID] = _maxSpreadPerSport;
        emit SetMinSupportedOddsAndMaxSpreadPerSport(_sportID, _minSupportedOdds, _maxSpreadPerSport);
    }

    /// @notice Setting the Min Spread per Sport ID
    /// @param _tag1 The first tagID used for each market
    /// @param _tag2 The second tagID used for each market
    /// @param _minSpread The min spread amount used for the sportID
    function setMinSpreadPerSport(
        uint _tag1,
        uint _tag2,
        uint _minSpread
    ) external onlyOwner {
        minSpreadPerSport[_tag1][_tag2] = _minSpread;
        emit SetMinSpreadPerSport(_tag1, _tag2, _minSpread);
    }

    /// @notice setting one positional sport
    /// @param _sportID tag id for sport
    /// @param _flag is one positional sport flag
    function setSportOnePositional(uint _sportID, bool _flag) external onlyOwner {
        require(_sportID > MIN_TAG_NUMBER, "Invalid tag for sport");
        require(isMarketForSportOnePositional[_sportID] != _flag, "Invalid flag");
        isMarketForSportOnePositional[_sportID] = _flag;
        emit SetSportOnePositional(_sportID, _flag);
    }

    /// @notice setting one positional sport
    /// @param _playerPropsOptionTag tag id for PP
    /// @param _flag is one positional sport flag
    function setPlayerPropsOnePositional(uint _playerPropsOptionTag, bool _flag) external onlyOwner {
        require(_playerPropsOptionTag > MIN_PLAYER_PROPS_NUMBER, "Invalid tag for player props");
        require(isMarketForPlayerPropsOnePositional[_playerPropsOptionTag] != _flag, "Invalid flag");
        isMarketForPlayerPropsOnePositional[_playerPropsOptionTag] = _flag;
        emit SetPlayerPropsOnePositional(_playerPropsOptionTag, _flag);
    }

    function getMinSpreadToUse(
        bool useDefaultMinSpread,
        address market,
        uint min_spread,
        uint min_spreadPerAddress
    ) external view returns (uint min_spreadToUse) {
        (uint tag1, uint tag2) = _getTagsForMarket(market);
        uint minSpreadByTags = minSpreadPerSport[tag1][tag2];
        uint minSpreadByPrimaryTag = minSpreadPerSport[tag1][0];
        uint spreadForTag = tag2 > 0 && minSpreadByTags > 0 ? minSpreadByTags : minSpreadByPrimaryTag;
        min_spreadToUse = useDefaultMinSpread
            ? (spreadForTag > 0 ? spreadForTag : min_spread)
            : (min_spreadPerAddress > 0 ? min_spreadPerAddress : (spreadForTag > 0 ? spreadForTag : min_spread));
    }

    function getMaxSpreadForMarket(address _market, uint max_spread) external view returns (uint maxSpread) {
        (uint tag1, ) = _getTagsForMarket(_market);
        uint _maxSpreadPerSport = maxSpreadPerSport[tag1];
        maxSpread = _maxSpreadPerSport > 0 ? _maxSpreadPerSport : max_spread;
    }

    function getMinOddsForMarket(address _market, uint minSupportedOdds) external view returns (uint minOdds) {
        (uint tag1, ) = _getTagsForMarket(_market);
        uint _minSupportedOddsPerSport = minSupportedOddsPerSport[tag1];
        minOdds = _minSupportedOddsPerSport > 0 ? _minSupportedOddsPerSport : minSupportedOdds;
    }

    /* ========== MODIFIERS ========== */
    /* ========== EVENTS ========== */
    event SetCapPerSport(uint _sport, uint _cap);
    event SetCapPerMarket(address _market, uint _cap);
    event SetCapPerSportAndChild(uint _sport, uint _child, uint _cap);
    event SetSportsPositionalMarketManager(address _manager);
    event SetDefaultCapPerGame(uint _cap);
    event SetDefaultRiskMultiplier(uint _riskMultiplier);
    event SetRiskMultiplierPerSport(uint _sport, uint _riskMultiplier);
    event SetRiskMultiplierPerMarket(address _market, uint _riskMultiplier);
    event SetMaxCapAndRisk(uint _maxCap, uint _maxRisk);
    event SetMinSpreadPerSport(uint _tag1, uint _tag2, uint _spread);
    event SetMinSupportedOddsAndMaxSpreadPerSport(uint _sport, uint _minSupportedOddsPerSport, uint _maxSpreadPerSport);
    event SetSportOnePositional(uint _sport, bool _flag);
    event SetPlayerPropsOnePositional(uint _playerPropsOptionTag, bool _flag);
}

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
        uint capPerMarket = _calculateCapToBeUsed(_market);
        uint riskMultiplier = _calculateRiskMultiplier(_market);
        return _totalSpent <= capPerMarket * riskMultiplier;
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
}

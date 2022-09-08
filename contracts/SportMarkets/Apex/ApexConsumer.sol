// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

// interface
import "../../interfaces/ISportPositionalMarketManager.sol";

/// @title Consumer contract which stores all data from CL data feed (Link to docs: https://market.link/nodes/TheRundown/integrations), also creates all sports markets based on that data
/// @author vladan
contract ApexConsumer is Initializable, ProxyOwned, ProxyPausable {
    /* ========== CONSTANTS =========== */

    uint public constant CANCELLED = 0;
    uint public constant HOME_WIN = 1;
    uint public constant AWAY_WIN = 2;
    uint public constant NUMBER_OF_POSITIONS = 2;
    uint public constant MIN_TAG_NUMBER = 9100;

    /* ========== CONSUMER STATE VARIABLES ========== */

    struct RaceCreate {
        string raceId;
        uint256 startTime;
        string eventId;
        string eventName;
        string betType;
    }

    struct GameCreate {
        bytes32 gameId;
        uint256 startTime;
        uint256 homeOdds;
        uint256 awayOdds;
        uint256 drawOdds;
        string homeTeam;
        string awayTeam;
    }

    struct GameResolve {
        bytes32 gameId;
        uint8 homeScore;
        uint8 awayScore;
        uint8 statusId;
    }

    struct GameOdds {
        bytes32 gameId;
        uint256 homeOdds;
        uint256 awayOdds;
        uint256 drawOdds;
    }

    /* ========== STATE VARIABLES ========== */

    // global params
    address public wrapperAddress;
    mapping(address => bool) public whitelistedAddresses;

    string public results;
    string public resultsDetail;

    // Maps <GameId, Game>
    mapping(string => RaceCreate) public raceCreated;
    mapping(bytes32 => GameCreate) public gameCreated;
    mapping(bytes32 => GameResolve) public gameResolved;
    mapping(bytes32 => GameOdds) public gameOdds;
    mapping(bytes32 => uint) public sportsIdPerGame;
    mapping(bytes32 => bool) public gameFulfilledCreated;
    mapping(bytes32 => bool) public gameFulfilledResolved;

    // sports props
    mapping(string => bool) public supportedSport;
    mapping(string => uint) public supportedSportId;

    // market props
    ISportPositionalMarketManager public sportsManager;
    mapping(bytes32 => address) public marketPerGameId;
    mapping(address => bytes32) public gameIdPerMarket;
    mapping(address => bool) public marketCreated;
    mapping(address => bool) public marketResolved;
    mapping(address => bool) public marketCanceled;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        string[] memory _supportedSports,
        address _sportsManager
    ) external initializer {
        setOwner(_owner);
        sportsManager = ISportPositionalMarketManager(_sportsManager);
        whitelistedAddresses[_owner] = true;
        for (uint i; i < _supportedSports.length; i++) {
            supportedSport[_supportedSports[i]] = true;
            supportedSportId[_supportedSports[i]] = i;
        }
    }

    /* ========== CONSUMER FULFILL FUNCTIONS ========== */

    /**
     * @notice Consumes the data returned by the node job on a particular request.
     * @param _requestId the request ID for fulfillment
     */
    function fulfillMetaData(
        bytes32 _requestId,
        string memory _event_id,
        string memory _bet_type,
        string memory _event_name,
        uint256 _qualifying_start_time,
        uint256 _race_start_time,
        string memory _sport
    ) external onlyWrapper {
        if (_qualifying_start_time > block.timestamp) {
            RaceCreate memory race;

            race.raceId = _event_id;
            race.eventId = _event_id;
            race.eventName = _event_name;
            race.betType = _bet_type;
            race.startTime = _qualifying_start_time;

            raceCreated[_sport] = race;

            emit RequestMetaDataFulfilled(
                _requestId,
                _event_id,
                _bet_type,
                _event_name,
                _qualifying_start_time,
                _race_start_time
            );
        }
    }

    /**
     * @notice Consumes the data returned by the node job on a particular request.
     * @param _requestId the request ID for fulfillment
     * @param _betTypeDetail the type of bet being requested.
     * @param _probA: Probability for Team/Category/Rider A, returned as uint256.
     * @param _probB: Probability for Team/Category/Rider B, returned as uint256.
     */

    function fulfillMatchup(
        bytes32 _requestId,
        string memory _betTypeDetail,
        uint256 _probA,
        uint256 _probB,
        uint256 _timestamp,
        bytes32 _gameId,
        string memory _sport
    ) external onlyWrapper {
        RaceCreate memory race = raceCreated[_sport];

        if (race.startTime > block.timestamp && !gameFulfilledCreated[_gameId]) {
            GameCreate memory game;

            game.gameId = _gameId;
            game.homeOdds = _probA;
            game.awayOdds = _probB;
            game.homeTeam = _betTypeDetail;
            game.awayTeam = _betTypeDetail;
            game.startTime = race.startTime;

            gameCreated[_gameId] = game;
            sportsIdPerGame[_gameId] = supportedSportId[_sport];
            gameFulfilledCreated[_gameId] = true;
            gameOdds[_gameId] = GameOdds(_gameId, game.homeOdds, game.awayOdds, game.drawOdds);

            // emit GameCreated(requestId, _sportId, _game.gameId, _game, queues.lastCreated(), getNormalizedOdds(_game.gameId));

            emit RequestProbabilitiesFulfilled(_requestId, _betTypeDetail, _probA, _probB, _timestamp);
        }
    }

    /**
     * @notice Consumes the data returned by the node job on a particular request.
     * @param _requestId the request ID for fulfillment
     * @param _result win/loss for the matchup.
     * @param _resultDetails ranking/timing data to elaborate on win/loss
     */
    function fulfillResults(
        bytes32 _requestId,
        string memory _result,
        string memory _resultDetails
    ) external onlyWrapper {
        emit RequestResultsFulfilled(_requestId, _result, _resultDetails);
        results = _result;
        resultsDetail = _resultDetails;
    }

    /// @notice creates market for a given game id
    /// @param _gameId game id
    function createMarketForGame(bytes32 _gameId) public {
        require(marketPerGameId[_gameId] == address(0), "Market for game already exists");
        require(gameFulfilledCreated[_gameId], "No such game fulfilled, created");
        _createMarket(_gameId);
    }

    /* ========== VIEW FUNCTIONS ========== */

    /// @notice view function which returns game created object based on id of a game
    /// @param _gameId game id
    /// @return GameCreate game create object
    function getGameCreatedById(bytes32 _gameId) public view returns (GameCreate memory) {
        return gameCreated[_gameId];
    }

    /// @notice view function which returns if game is resolved or canceled and ready for market to be resolved or canceled
    /// @param _gameId game id for which game is looking
    /// @return bool is it ready for resolve or cancel true/false
    function isGameResolvedOrCanceled(bytes32 _gameId) public view returns (bool) {
        return marketResolved[marketPerGameId[_gameId]] || marketCanceled[marketPerGameId[_gameId]];
    }

    /// @notice view function which returns normalized odds up to 100 (Example: 50-40-10)
    /// @param _gameId game id for which game is looking
    /// @return uint[] odds array normalized
    function getNormalizedOdds(bytes32 _gameId) public view returns (uint[] memory) {
        uint[] memory normalizedOdds = new uint[](3);
        normalizedOdds[0] = gameOdds[_gameId].homeOdds;
        normalizedOdds[1] = gameOdds[_gameId].awayOdds;
        normalizedOdds[2] = gameOdds[_gameId].drawOdds;

        for (uint i = 0; i < normalizedOdds.length; i++) {
            normalizedOdds[i] = (1e18 * normalizedOdds[i]) / 1e4;
        }
        return normalizedOdds;
    }

    function isApexGame(bytes32 _gameId) public view returns (bool) {
        return gameFulfilledCreated[_gameId];
    }

    /* ========== INTERNALS ========== */

    function _createMarket(bytes32 _gameId) internal {
        GameCreate memory game = getGameCreatedById(_gameId);
        uint sportId = sportsIdPerGame[_gameId];
        uint[] memory tags = _calculateTags(sportId);

        // create
        sportsManager.createMarket(
            _gameId,
            _append(game.homeTeam, game.awayTeam), // gameLabel
            game.startTime, //maturity
            0, //initialMint
            NUMBER_OF_POSITIONS,
            tags //tags
        );

        address marketAddress = sportsManager.getActiveMarketAddress(sportsManager.numActiveMarkets() - 1);
        marketPerGameId[game.gameId] = marketAddress;
        gameIdPerMarket[marketAddress] = game.gameId;
        marketCreated[marketAddress] = true;

        // emit CreateSportsMarket(marketAddress, game.gameId, game, tags, getNormalizedOdds(game.gameId));
    }

    function _pauseOrUnpauseMarket(address _market, bool _pause) internal {
        if (sportsManager.isMarketPaused(_market) != _pause) {
            sportsManager.setMarketPaused(_market, _pause);
            emit PauseSportsMarket(_market, _pause);
        }
    }

    function _cancelMarket(bytes32 _gameId) internal {
        sportsManager.resolveMarket(marketPerGameId[_gameId], 0);
        marketCanceled[marketPerGameId[_gameId]] = true;

        emit CancelSportsMarket(marketPerGameId[_gameId], _gameId);
    }

    function _append(string memory teamA, string memory teamB) internal pure returns (string memory) {
        return string(abi.encodePacked(teamA, " vs ", teamB));
    }

    function _calculateTags(uint _sportsId) internal pure returns (uint[] memory) {
        uint[] memory result = new uint[](1);
        result[0] = MIN_TAG_NUMBER + _sportsId;
        return result;
    }

    function _areOddsValid(GameOdds memory _game) internal pure returns (bool) {
        return _game.awayOdds != 0 && _game.homeOdds != 0;
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    /// @notice sets if sport is suported or not (delete from supported sport)
    /// @param sport sport which needs to be supported or not
    /// @param _isSupported true/false (supported or not)
    function setSupportedSport(string memory sport, bool _isSupported) external onlyOwner {
        require(supportedSport[sport] != _isSupported, "Already set");
        supportedSport[sport] = _isSupported;
        emit SupportedSportsChanged(sport, _isSupported);
    }

    /// @notice sets wrapper andmanager address
    /// @param _wrapperAddress wrapper address
    /// @param _sportsManager sport manager address
    function setSportContracts(address _wrapperAddress, address _sportsManager) external onlyOwner {
        require(_wrapperAddress != address(0) || _sportsManager != address(0), "Invalid addreses");

        sportsManager = ISportPositionalMarketManager(_sportsManager);
        wrapperAddress = _wrapperAddress;

        emit NewSportContracts(_wrapperAddress, _sportsManager);
    }

    /// @notice adding/removing whitelist address depending on a flag
    /// @param _whitelistAddress address that needed to be whitelisted/ ore removed from WL
    /// @param _flag adding or removing from whitelist (true: add, false: remove)
    function addToWhitelist(address _whitelistAddress, bool _flag) external onlyOwner {
        require(_whitelistAddress != address(0), "Invalid address");
        require(whitelistedAddresses[_whitelistAddress] != _flag, "Already set to that flag");
        whitelistedAddresses[_whitelistAddress] = _flag;
        emit AddedIntoWhitelist(_whitelistAddress, _flag);
    }

    /* ========== MODIFIERS ========== */

    modifier onlyWrapper() {
        require(msg.sender == wrapperAddress, "Only wrapper can call this function");
        _;
    }

    modifier isAddressWhitelisted() {
        require(whitelistedAddresses[msg.sender], "Address not supported");
        _;
    }

    /* ========== EVENTS ========== */

    event PauseSportsMarket(address _marketAddress, bool _pause);
    event CancelSportsMarket(address _marketAddress, bytes32 _id);
    event SupportedSportsChanged(string _sport, bool _isSupported);
    event NewSportContracts(address _wrapperAddress, address _sportsManager);
    event AddedIntoWhitelist(address _whitelistAddress, bool _flag);

    event RequestMetaDataFulfilled(
        bytes32 indexed requestId,
        string event_id,
        string bet_type,
        string event_name,
        uint256 qualifying_start_time,
        uint256 _race_start_time
    );
    event RequestProbabilitiesFulfilled(
        bytes32 indexed requestId,
        string betTypeDetail,
        uint256 probA,
        uint256 probB,
        uint256 timestamp
    );
    event RequestResultsFulfilled(bytes32 indexed requestId, string result, string resultDetails);
}

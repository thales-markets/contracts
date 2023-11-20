// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// external
import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@openzeppelin/contracts-4.4.1/security/Pausable.sol";
import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";

// internal
import "../../interfaces/ITherundownConsumer.sol";
import "../../interfaces/ITherundownConsumerVerifier.sol";
import "../../interfaces/IGamesPlayerPropsReceiver.sol";
import "../../interfaces/IGamesPlayerProps.sol";

/// @title Wrapper contract which calls CL sports data (Link to docs: https://market.link/nodes/TheRundown/integrations)
/// @author gruja
contract TherundownConsumerWrapper is ChainlinkClient, Ownable, Pausable {
    using Chainlink for Chainlink.Request;
    using SafeERC20 for IERC20;

    ITherundownConsumer public consumer;
    ITherundownConsumerVerifier public verifier;
    IGamesPlayerPropsReciever public playerPropsReciever;
    IGamesPlayerProps public playerProps;
    mapping(bytes32 => uint) public sportIdPerRequestId;
    mapping(bytes32 => uint) public datePerRequest;
    uint public paymentCreate;
    uint public paymentResolve;
    uint public paymentOdds;
    IERC20 public linkToken;
    bytes32 public oddsSpecId;
    bytes32 public oddsSpecIdPlayerProps;
    address public sportsAMM;

    mapping(bytes32 => bytes[]) public requestIdGamesCreated;
    mapping(bytes32 => bytes[]) public requestIdGamesResolved;
    mapping(bytes32 => bytes[]) public requestIdGamesOdds;
    mapping(bytes32 => uint256) private requestIdRemainder;
    mapping(bytes32 => bytes[]) public requestIdPlayerPropsResolved;
    mapping(bytes32 => bytes[]) public requestIdPlayerProps;

    mapping(bytes32 => bool) public requestIdGamesCreatedFulFilled;
    mapping(bytes32 => bool) public requestIdGamesResolvedFulFilled;
    mapping(bytes32 => bool) public requestIdGamesOddsFulFilled;
    mapping(bytes32 => bool) public requestIdPlayerPropsResolvedFulFilled;
    mapping(bytes32 => bool) public requestIdPlayerPropsFulFilled;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _link,
        address _oracle,
        address _consumer,
        uint _paymentCreate,
        uint _paymentResolve,
        uint _paymentOdds,
        bytes32 _oddsSpecId,
        address _sportsAMM,
        address _verifier,
        address _playerPropsReciever,
        address _playerProps
    ) {
        setChainlinkToken(_link);
        setChainlinkOracle(_oracle);
        consumer = ITherundownConsumer(_consumer);
        paymentCreate = _paymentCreate;
        paymentResolve = _paymentResolve;
        paymentOdds = _paymentOdds;
        linkToken = IERC20(_link);
        oddsSpecId = _oddsSpecId;
        sportsAMM = _sportsAMM;
        verifier = ITherundownConsumerVerifier(_verifier);
        playerPropsReciever = IGamesPlayerPropsReciever(_playerPropsReciever);
        playerProps = IGamesPlayerProps(_playerProps);
    }

    /* ========== CONSUMER REQUEST FUNCTIONS ========== */

    /// @notice request of create/resolve games on a specific date with specific sport with optional filters
    /// @param _specId specification id which is provided by CL
    /// @param _market string which can be "create" or "resolve"
    /// @param _sportId sports id which is provided from CL (Example: NBA = 4)
    /// @param _date date on which game/games are played
    /// @param _statusIds optional param, grap only for specific statusess
    /// @param _gameIds optional param, grap only for specific games
    function requestGamesResolveWithFilters(
        bytes32 _specId,
        string memory _market,
        uint256 _sportId,
        uint256 _date,
        string[] memory _statusIds,
        string[] memory _gameIds
    ) public whenNotPaused isValidRequest(_market, _sportId) {
        Chainlink.Request memory req;
        uint payment;

        if (keccak256(abi.encodePacked(_market)) == keccak256(abi.encodePacked("create"))) {
            req = buildChainlinkRequest(_specId, address(this), this.fulfillGamesCreated.selector);
            payment = paymentCreate;
        } else {
            req = buildChainlinkRequest(_specId, address(this), this.fulfillGamesResolved.selector);
            payment = paymentResolve;
        }

        req.addUint("date", _date);
        req.add("market", _market);
        req.addUint("sportId", _sportId);
        req.addStringArray("statusIds", _statusIds);
        req.addStringArray("gameIds", _gameIds);

        _putLink(msg.sender, payment);

        bytes32 requestId = sendChainlinkRequest(req, payment);
        sportIdPerRequestId[requestId] = _sportId;
        datePerRequest[requestId] = _date;
    }

    /// @notice request of resolve player props for sport/game/player/option
    /// @param _specId specification id which is provided by CL
    /// @param _market string which can be "create" or "resolve"
    /// @param _date date on which game/games are played
    /// @param _sportId sports id which is provided from CL (Example: NBA = 4)
    /// @param _gameIds game which player is playing
    /// @param _playerIds player id as string
    /// @param _optionIds option id as string
    function requestPlayerPropsResolveWithFilters(
        bytes32 _specId,
        string memory _market,
        uint256 _date,
        uint256 _sportId,
        string[] memory _gameIds,
        string[] memory _playerIds,
        string[] memory _optionIds
    ) public whenNotPaused isValidRequest(_market, _sportId) {
        Chainlink.Request memory req;
        uint payment;

        req = buildChainlinkRequest(_specId, address(this), this.fulfillPlayerPropsResolved.selector);
        payment = paymentResolve;

        req.add("market", _market);
        req.addUint("date", _date);
        req.addUint("sportId", _sportId);
        req.addStringArray("gameIds", _gameIds);
        req.addStringArray("playerIds", _playerIds);
        req.addStringArray("optionIds", _optionIds);

        _putLink(msg.sender, payment);

        bytes32 requestId = sendChainlinkRequest(req, payment);
        sportIdPerRequestId[requestId] = _sportId;
        datePerRequest[requestId] = _date;
    }

    /// @notice request of create/resolve games on a specific date with specific sport without filters
    /// @param _specId specification id which is provided by CL
    /// @param _market string which can be "create" or "resolve"
    /// @param _sportId sports id which is provided from CL (Example: NBA = 4)
    /// @param _date date on which game/games are played
    function requestGames(
        bytes32 _specId,
        string memory _market,
        uint256 _sportId,
        uint256 _date
    ) public whenNotPaused isValidRequest(_market, _sportId) {
        Chainlink.Request memory req;
        uint payment;

        if (keccak256(abi.encodePacked(_market)) == keccak256(abi.encodePacked("create"))) {
            req = buildChainlinkRequest(_specId, address(this), this.fulfillGamesCreated.selector);
            payment = paymentCreate;
        } else {
            req = buildChainlinkRequest(_specId, address(this), this.fulfillGamesResolved.selector);
            payment = paymentResolve;
        }

        req.addUint("date", _date);
        req.add("market", _market);
        req.addUint("sportId", _sportId);

        _putLink(msg.sender, payment);

        bytes32 requestId = sendChainlinkRequest(req, payment);
        sportIdPerRequestId[requestId] = _sportId;
        datePerRequest[requestId] = _date;
    }

    /// @notice request for odds in games on a specific date with specific sport with filters
    /// @param _specId specification id which is provided by CL
    /// @param _sportId sports id which is provided from CL (Example: NBA = 4)
    /// @param _date date on which game/games are played
    /// @param _gameIds optional param, grap only for specific games
    function requestOddsWithFilters(
        bytes32 _specId,
        uint256 _sportId,
        uint256 _date,
        string[] memory _gameIds
    ) public whenNotPaused {
        require(consumer.supportedSport(_sportId), "SportId is not supported");

        Chainlink.Request memory req = buildChainlinkRequest(_specId, address(this), this.fulfillGamesOdds.selector);

        req.addUint("date", _date);
        req.addUint("sportId", _sportId);

        // optional param.
        if (_gameIds.length > 0) {
            req.addStringArray("gameIds", _gameIds);
        }

        _putLink(msg.sender, paymentOdds);

        bytes32 requestId = sendChainlinkRequest(req, paymentOdds);
        sportIdPerRequestId[requestId] = _sportId;
        datePerRequest[requestId] = _date;
    }

    /// @notice request for odds in games on a specific date with specific sport with filters
    /// @param _marketAddress market address which triggered
    function callUpdateOddsForSpecificGame(address _marketAddress) external whenNotPaused {
        require(msg.sender == sportsAMM, "Only Sports AMM can call this function");

        // don't fail if no link in it
        if (linkToken.balanceOf(address(this)) >= paymentOdds) {
            (uint _sportId, uint _date, ) = consumer.getGamePropsForOdds(_marketAddress);
            bytes32[] memory _ids = consumer.getGamesPerDatePerSport(_sportId, _date);
            _requestOddsWithFiltersFromAmm(oddsSpecId, _sportId, _date, verifier.getStringIDsFromBytesArrayIDs(_ids));
            emit UpdateOddsFromAMMForAGame(_sportId, _date, _marketAddress);
        }
    }

    /// @notice Request odds update for specific player props when triggered by a market address
    /// @param _marketAddress Market address that triggered the update
    // Function to convert an array of uint values to an array of strings
    function callUpdateOddsForSpecificPlayerProps(address _marketAddress) external whenNotPaused {
        require(msg.sender == sportsAMM, "Only Sports AMM can call this function");
        if (linkToken.balanceOf(address(this)) >= paymentOdds) {
            // Get player props data for the market
            (address _parent, bytes32 _gameId, uint64 _playerId, uint8 _optionId) = playerProps.getPlayerPropsDataForMarket(
                _marketAddress
            );

            // Create arrays with single elements for filtering
            bytes32[] memory _gameIds = new bytes32[](1);
            _gameIds[0] = _gameId;
            string[] memory _playerIdStrings = new string[](1);
            _playerIdStrings[0] = verifier.convertUintToString(uint(_playerId));
            string[] memory _optionIdStrings = new string[](1);
            _optionIdStrings[0] = verifier.convertUintToString(uint(_optionId));

            // Get sport and date information
            (uint _sportId, uint _date, ) = consumer.getGamePropsForOdds(_parent);

            // Request odds update using the filtered data
            _requestPlayerPropsOddsWithFiltersFromAmm(
                oddsSpecIdPlayerProps,
                _sportId,
                _date,
                verifier.getStringIDsFromBytesArrayIDs(_gameIds),
                _playerIdStrings, // Use the converted strings
                _optionIdStrings // Use the converted strings
            );

            // Emit an event to log the update request
            emit UpdatePlayerPropsOddsFromAMM(_sportId, _date, _marketAddress, _gameId, _playerId, _optionId);
        }
    }

    /// @notice getting bookmaker by sports id
    /// @param _sportId id of a sport for fetching
    function getBookmakerIdsBySportId(uint256 _sportId) external view returns (uint256[] memory) {
        return verifier.getBookmakerIdsBySportId(_sportId);
    }

    /// @notice getting bookmaker by sports id for playerprops
    /// @param _sportId id of a sport for fetching
    function getBookmakerIdsBySportIdForPlayerProps(uint256 _sportId) external view returns (uint256[] memory) {
        return verifier.getBookmakerIdsBySportIdForPlayerProps(_sportId);
    }

    /* ========== CONSUMER FULFILL FUNCTIONS ========== */

    /// @notice proxy all retrieved data for created games from CL to consumer
    /// @param _requestId request id autogenerated from CL
    /// @param _games array of a games
    function fulfillGamesCreated(
        bytes32 _requestId,
        uint256 _remainder,
        bytes[] memory _games
    ) external recordChainlinkFulfillment(_requestId) {
        requestIdGamesCreated[_requestId] = _games;
        requestIdGamesCreatedFulFilled[_requestId] = true;
        requestIdRemainder[_requestId] = _remainder;
        consumer.fulfillGamesCreated(_requestId, _games, sportIdPerRequestId[_requestId], datePerRequest[_requestId]);
    }

    /// @notice proxy all retrieved data for resolved games from CL to consumer
    /// @param _requestId request id autogenerated from CL
    /// @param _games array of a games
    function fulfillGamesResolved(
        bytes32 _requestId,
        uint256 _remainder,
        bytes[] memory _games
    ) external recordChainlinkFulfillment(_requestId) {
        requestIdGamesResolved[_requestId] = _games;
        requestIdGamesResolvedFulFilled[_requestId] = true;
        requestIdRemainder[_requestId] = _remainder;
        consumer.fulfillGamesResolved(_requestId, _games, sportIdPerRequestId[_requestId]);
    }

    /// @notice proxy all retrieved data for resolved games from CL to consumer
    /// @param _requestId request id autogenerated from CL
    /// @param _playerProps array of a player props
    function fulfillPlayerPropsResolved(bytes32 _requestId, bytes[] memory _playerProps)
        external
        recordChainlinkFulfillment(_requestId)
    {
        requestIdPlayerPropsResolved[_requestId] = _playerProps;
        requestIdPlayerPropsResolvedFulFilled[_requestId] = true;
        playerPropsReciever.fulfillPlayerPropsCLResolved(_playerProps);
    }

    /// @notice proxy all retrieved data for odds in games from CL to consumer
    /// @param _requestId request id autogenerated from CL
    /// @param _games array of a games
    function fulfillGamesOdds(
        bytes32 _requestId,
        uint256 _remainder,
        bytes[] memory _games
    ) external recordChainlinkFulfillment(_requestId) {
        requestIdGamesOdds[_requestId] = _games;
        requestIdRemainder[_requestId] = _remainder;
        requestIdGamesOddsFulFilled[_requestId] = true;
        consumer.fulfillGamesOdds(_requestId, _games);
    }

    /// @notice proxy all retrieved data for odds in games from CL to consumer
    /// @param _requestId request id autogenerated from CL
    /// @param _playerProps array of a playerProps
    function fulfillPlayerPropsOdds(bytes32 _requestId, bytes[] memory _playerProps)
        external
        recordChainlinkFulfillment(_requestId)
    {
        requestIdPlayerProps[_requestId] = _playerProps;
        requestIdPlayerPropsFulFilled[_requestId] = true;
        playerPropsReciever.fulfillPlayerPropsCL(_playerProps);
    }

    /* ========== VIEWS ========== */

    /// @notice getting oracle address for CL data sport feed
    /// @return address of oracle
    function getOracleAddress() external view returns (address) {
        return chainlinkOracleAddress();
    }

    /// @notice getting LINK token address for payment for requests
    /// @return address of LINK token
    function getTokenAddress() external view returns (address) {
        return chainlinkTokenAddress();
    }

    /// @notice add all odds request fulfilled
    /// @param _requestsIds array of request ids
    /// @return bool if all fullfilled or not
    function areOddsRequestIdsFulFilled(bytes32[] memory _requestsIds) external view returns (bool) {
        for (uint i = 0; i < _requestsIds.length; i++) {
            if (!requestIdGamesOddsFulFilled[_requestsIds[i]]) {
                return false;
            }
        }
        return true;
    }

    /// @notice add all creation request fulfilled
    /// @param _requestsIds array of request ids
    /// @return bool if all fullfilled or not
    function areCreatedRequestIdsFulFilled(bytes32[] memory _requestsIds) external view returns (bool) {
        for (uint i = 0; i < _requestsIds.length; i++) {
            if (!requestIdGamesCreatedFulFilled[_requestsIds[i]]) {
                return false;
            }
        }
        return true;
    }

    /// @notice add all resolve request fulfilled
    /// @param _requestsIds array of request ids
    /// @return bool if all fullfilled or not
    function areResolvedRequestIdsFulFilled(bytes32[] memory _requestsIds) external view returns (bool) {
        for (uint i = 0; i < _requestsIds.length; i++) {
            if (!requestIdGamesResolvedFulFilled[_requestsIds[i]]) {
                return false;
            }
        }
        return true;
    }

    /// @notice add all resolve request fulfilled
    /// @param _requestsIds array of request ids
    /// @return bool if all fullfilled or not
    function areResolvedPlayerPropsRequestIdsFulFilled(bytes32[] memory _requestsIds) external view returns (bool) {
        for (uint i = 0; i < _requestsIds.length; i++) {
            if (!requestIdPlayerPropsResolvedFulFilled[_requestsIds[i]]) {
                return false;
            }
        }
        return true;
    }

    /* ========== INTERNALS ========== */

    function _putLink(address _sender, uint _payment) internal {
        linkToken.safeTransferFrom(_sender, address(this), _payment);
    }

    function _requestOddsWithFiltersFromAmm(
        bytes32 _specId,
        uint256 _sportId,
        uint256 _date,
        string[] memory _gameIds
    ) internal {
        Chainlink.Request memory req = buildChainlinkRequest(_specId, address(this), this.fulfillGamesOdds.selector);

        req.addUint("date", _date);
        req.addUint("sportId", _sportId);

        // optional param.
        if (_gameIds.length > 0) {
            req.addStringArray("gameIds", _gameIds);
        }

        bytes32 requestId = sendChainlinkRequest(req, paymentOdds);
        sportIdPerRequestId[requestId] = _sportId;
        datePerRequest[requestId] = _date;
    }

    function _requestPlayerPropsOddsWithFiltersFromAmm(
        bytes32 _specId,
        uint256 _sportId,
        uint256 _date,
        string[] memory _gameIds,
        string[] memory _playerIds,
        string[] memory _optionIds
    ) internal {
        Chainlink.Request memory req = buildChainlinkRequest(_specId, address(this), this.fulfillPlayerPropsOdds.selector);

        req.addUint("date", _date);
        req.addUint("sportId", _sportId);
        req.addStringArray("gameIds", _gameIds);
        req.addStringArray("playerIds", _playerIds);
        req.addStringArray("optionIds", _optionIds);

        bytes32 requestId = sendChainlinkRequest(req, paymentOdds);
        sportIdPerRequestId[requestId] = _sportId;
        datePerRequest[requestId] = _date;
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    /// @notice setting payment for game creation request
    /// @param _paymentCreate amount of LINK per request for create games
    function setPaymentCreate(uint _paymentCreate) external onlyOwner {
        require(_paymentCreate > 0, "Can not be zero");
        paymentCreate = _paymentCreate;
        emit NewPaymentAmountCreate(_paymentCreate);
    }

    /// @notice setting payment for game resolve request
    /// @param _paymentResolve amount of LINK per request for resolve games
    function setPaymentResolve(uint _paymentResolve) external onlyOwner {
        require(_paymentResolve > 0, "Can not be zero");
        paymentResolve = _paymentResolve;
        emit NewPaymentAmountResolve(_paymentResolve);
    }

    /// @notice setting payment for odds request
    /// @param _paymentOdds amount of LINK per request for game odds
    function setPaymentOdds(uint _paymentOdds) external onlyOwner {
        require(_paymentOdds > 0, "Can not be zero");
        paymentOdds = _paymentOdds;
        emit NewPaymentAmountOdds(_paymentOdds);
    }

    /// @notice setting new oracle address
    /// @param _oracle address of oracle sports data feed
    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid address");
        setChainlinkOracle(_oracle);
        emit NewOracleAddress(_oracle);
    }

    /// @notice setting consumer address
    /// @param _consumer address of a consumer which gets the data from CL requests
    function setConsumer(address _consumer) external onlyOwner {
        require(_consumer != address(0), "Invalid address");
        consumer = ITherundownConsumer(_consumer);
        emit NewConsumer(_consumer);
    }

    /// @notice setting consumer verifier address
    /// @param _verifier address of a consumer verifier
    function setVerifier(address _verifier) external onlyOwner {
        require(_verifier != address(0), "Invalid address");
        verifier = ITherundownConsumerVerifier(_verifier);
        emit NewVerifier(_verifier);
    }

    /// @notice setting link address
    /// @param _link address of a LINK which request will be paid
    function setLink(address _link) external onlyOwner {
        require(_link != address(0), "Invalid address");
        setChainlinkToken(_link);
        linkToken = IERC20(_link);
        emit NewLinkAddress(_link);
    }

    /// @notice setting odds spec id
    /// @param _specId spec id
    function setOddsSpecId(bytes32 _specId) external onlyOwner {
        oddsSpecId = _specId;
        emit NewOddsSpecId(_specId);
    }

    /// @notice setting odds spec id for player props
    /// @param _specId spec id
    function setOddsSpecIdForPlayerProps(bytes32 _specId) external onlyOwner {
        oddsSpecIdPlayerProps = _specId;
        emit NewOddsSpecIdPlayerProps(_specId);
    }

    /// @notice setting amm address
    /// @param _sportsAmm amm address
    function setSportsAmmAddress(address _sportsAmm) external onlyOwner {
        require(_sportsAmm != address(0), "Invalid address");
        sportsAMM = _sportsAmm;
        emit NewSportsAmmAddress(_sportsAmm);
    }

    /// @notice setting player props reciever address
    /// @param _playerPropsReciever props reciever address
    function setPlayerPropsReceiverAddress(address _playerPropsReciever) external onlyOwner {
        require(_playerPropsReciever != address(0), "Invalid address");
        playerPropsReciever = IGamesPlayerPropsReciever(_playerPropsReciever);
        emit NewPlayerPropsReciever(_playerPropsReciever);
    }

    /// @notice setting player props  address
    /// @param _playerProps props address
    function setPlayerPropsAddress(address _playerProps) external onlyOwner {
        require(_playerProps != address(0), "Invalid address");
        playerProps = IGamesPlayerProps(_playerProps);
        emit NewPlayerProps(_playerProps);
    }

    /// @notice Retrieve LINK from the contract
    /// @param account whom to send the LINK
    /// @param amount how much LINK to retrieve
    function retrieveLINKAmount(address payable account, uint amount) external onlyOwner {
        linkToken.safeTransfer(account, amount);
    }

    /* ========== MODIFIERS ========== */

    modifier isValidRequest(string memory _market, uint256 _sportId) {
        require(verifier.isSupportedMarketType(_market), "Market is not supported");
        require(consumer.supportedSport(_sportId), "SportId is not supported");
        _;
    }

    /* ========== EVENTS ========== */

    event NewOracleAddress(address _oracle);
    event NewPaymentAmountCreate(uint _paymentCreate);
    event NewPaymentAmountResolve(uint _paymentResolve);
    event NewPaymentAmountOdds(uint _paymentOdds);
    event NewConsumer(address _consumer);
    event NewVerifier(address _verifier);
    event NewLinkAddress(address _link);
    event NewOddsSpecId(bytes32 _specId);
    event NewSportsAmmAddress(address _sportsAmm);
    event UpdateOddsFromAMMForAGame(uint256 _sportId, uint256 _date, address _marketAddress);
    event NewPlayerPropsReciever(address _playerPropsReciever);
    event NewPlayerProps(address _playerProps);
    event NewOddsSpecIdPlayerProps(bytes32 _specId);
    event UpdatePlayerPropsOddsFromAMM(
        uint256 _sportId,
        uint256 _date,
        address _marketAddress,
        bytes32 _gameId,
        uint64 _playerId,
        uint8 _optionId
    );
}

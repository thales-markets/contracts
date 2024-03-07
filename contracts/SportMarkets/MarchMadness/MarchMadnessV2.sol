// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/utils/Counters.sol";
import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/security/Pausable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC721/extensions/ERC721URIStorage.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "../../interfaces/IMultiCollateralOnOffRamp.sol";

contract MarchMadnessV2 is ERC721URIStorage, Pausable, Ownable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /* ========== LIBRARIES ========== */

    using Counters for Counters.Counter;

    /* ========== STATE VARIABLES ========== */

    Counters.Counter private _tokenIds;

    string public _name = "Overtime March Madness 2024";
    string public _symbol = "OTMM";

    uint public canNotMintOrUpdateAfter;

    uint constant NUMBER_OF_ROUNDS = 6;
    uint constant NUMBER_OF_GAMES = 63;
    uint constant NUMBER_OF_TEAMS = 64;
    uint private constant MAX_APPROVAL = type(uint256).max;

    uint[NUMBER_OF_GAMES] public results;

    mapping(uint => uint[NUMBER_OF_GAMES]) public itemToBrackets;
    mapping(uint => uint[]) public roundToGameIds;

    string public urlToUse;

    uint public mintingPrice = 50 * 1e6;

    IERC20Upgradeable public sUSD;
    IMultiCollateralOnOffRamp public multiCollateralOnOffRamp;

    address public safeBox;

    uint public sbFee;

    mapping(address => bool) public whitelistedAddresses;

    /* ========== MODIFIER ========== */

    modifier notAfterFinalDate() {
        require(canNotMintOrUpdateAfter != 0, "canNotMintOrUpdateAfter is not set");
        require(block.timestamp < canNotMintOrUpdateAfter, "Can not mint after settled date");
        _;
    }

    /* ========== CONSTRUCTOR ========== */

    constructor() ERC721(_name, _symbol) {}

    /* ========== OWC ========== */

    function mint(uint[NUMBER_OF_GAMES] calldata _brackets)
        external
        whenNotPaused
        notAfterFinalDate
        returns (uint newItemId)
    {
        require(IERC20Upgradeable(sUSD).balanceOf(msg.sender) >= mintingPrice, "Not enough balance");
        IERC20Upgradeable(sUSD).safeTransferFrom(msg.sender, address(this), mintingPrice);

        newItemId = _mintInternal(_brackets);
    }

    function mintWithDiffCollateral(
        address collateral,
        uint collateralAmount,
        bool isEth,
        uint[NUMBER_OF_GAMES] calldata _brackets
    ) external whenNotPaused notAfterFinalDate returns (uint newItemId) {
        uint convertedAmount;
        if (isEth) {
            convertedAmount = multiCollateralOnOffRamp.onrampWithEth{value: collateralAmount}(collateralAmount);
        } else {
            IERC20Upgradeable(collateral).safeTransferFrom(msg.sender, address(this), collateralAmount);
            IERC20Upgradeable(collateral).approve(address(multiCollateralOnOffRamp), collateralAmount);
            convertedAmount = multiCollateralOnOffRamp.onramp(collateral, collateralAmount);
        }

        require(convertedAmount > mintingPrice, "insufficient collateral");

        newItemId = _mintInternal(_brackets);
    }

    function _mintInternal(uint[NUMBER_OF_GAMES] calldata _brackets) internal returns (uint newItemId) {
        _tokenIds.increment();

        newItemId = _tokenIds.current();

        _mint(msg.sender, newItemId);

        itemToBrackets[newItemId] = _brackets;

        _setTokenURI(newItemId, urlToUse);

        IERC20Upgradeable(sUSD).safeTransfer(safeBox, (mintingPrice * sbFee) / 1e18);

        emit Mint(msg.sender, newItemId, _brackets);
    }

    function updateBracketsForAlreadyMintedItem(uint _tokenId, uint[NUMBER_OF_GAMES] memory _brackets)
        external
        whenNotPaused
        notAfterFinalDate
    {
        require(_exists(_tokenId), "Item does not exists");
        require(ownerOf(_tokenId) == msg.sender, "Caller is not owner of entered tokenId");

        itemToBrackets[_tokenId] = _brackets;

        emit UpdateBracketsForAlreadyMintedItem(msg.sender, _tokenId, _brackets);
    }

    /* ========== VIEW ========== */
    function getResults() external view returns (uint[NUMBER_OF_GAMES] memory) {
        return results;
    }

    function isTeamWinnerOfGameId(uint _gameId, uint _teamId) public view returns (bool _flag) {
        if (isValidGameId(_gameId)) {
            if (results[_gameId] == _teamId) _flag = true;
        }
        return _flag;
    }

    function getCorrectPositionsPerRoundByTokenId(uint _roundId, uint _tokenId)
        public
        view
        returns (uint correctPredictions)
    {
        if (!isValidRoundId(_roundId)) return 0;
        if (!_exists(_tokenId)) return 0;

        uint[] memory gameIdsForRound = roundToGameIds[_roundId];
        uint[NUMBER_OF_GAMES] memory brackets = itemToBrackets[_tokenId];

        for (uint i = 0; i < gameIdsForRound.length; i++) {
            if (isTeamWinnerOfGameId(gameIdsForRound[i], brackets[gameIdsForRound[i]])) correctPredictions++;
        }

        return correctPredictions;
    }

    function getCorrectPositionsByRound(uint _tokenId) public view returns (uint[6] memory correctPositionsByRound) {
        for (uint i = 0; i < NUMBER_OF_ROUNDS; i++) {
            uint correctPositionPerRound = getCorrectPositionsPerRoundByTokenId(i, _tokenId);
            correctPositionsByRound[i] = correctPositionPerRound;
        }

        return correctPositionsByRound;
    }

    function getTotalPointsByTokenId(uint _tokenId) public view returns (uint totalPoints) {
        if (!_exists(_tokenId)) return totalPoints;

        for (uint i = 0; i < NUMBER_OF_ROUNDS; i++) {
            uint correctPositionPerRound = getCorrectPositionsPerRoundByTokenId(i, _tokenId);
            totalPoints += (correctPositionPerRound * (2**i));
        }

        return totalPoints;
    }

    /* ========== INTERNALS ========== */

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override {
        require(from == address(0) || to == address(0), "NonTransferrableERC721Token: non transferrable");
    }

    function isValidGameId(uint _gameId) internal pure returns (bool) {
        return _gameId >= 0 && _gameId < NUMBER_OF_GAMES;
    }

    function isValidRoundId(uint _roundId) internal pure returns (bool) {
        return _roundId >= 0 && _roundId < NUMBER_OF_ROUNDS;
    }

    function isValidTeamIndex(uint _teamId) internal pure returns (bool) {
        return _teamId > 0 && _teamId <= NUMBER_OF_TEAMS;
    }

    function isWhitelistedAddress(address _address) external view returns (bool) {
        return whitelistedAddresses[_address];
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    function setMultiCollateralOnOffRamp(address _onramper) external onlyOwner {
        multiCollateralOnOffRamp = IMultiCollateralOnOffRamp(_onramper);
        sUSD.approve(_onramper, MAX_APPROVAL);
        emit SetMultiCollateralOnOffRamp(_onramper);
    }

    function setsUSD(address _address) external onlyOwner {
        sUSD = IERC20Upgradeable(_address);
        emit SetsUSD(_address);
    }

    function setSafeBox(address _safeBox, uint _sbFee) external onlyOwner {
        safeBox = _safeBox;
        sbFee = _sbFee;
        emit SetSafeBox(_safeBox, _sbFee);
    }

    function setWhitelistedAddress(address _address, bool enabled) external onlyOwner {
        whitelistedAddresses[_address] = enabled;
        emit SetWhitelistedAddress(_address, enabled);
    }

    function setMintingPrice(uint _mintingPrice) external onlyOwner {
        mintingPrice = _mintingPrice;
        emit SetMintingPrice(_mintingPrice);
    }

    function setPaused(bool paused) external onlyOwner {
        return paused ? _pause() : _unpause();
    }

    function setURLToUse(string memory _urlToUse) external onlyOwner {
        urlToUse = _urlToUse;
    }

    function setResultForGame(uint _gameId, uint _teamId) external {
        require(msg.sender == owner() || whitelistedAddresses[msg.sender], "Invalid caller");
        require(isValidTeamIndex(_teamId), "Not valid team index");
        require(isValidGameId(_gameId), "Not valid game index");
        results[_gameId] = _teamId;

        emit ResultForGameAdded(_gameId, _teamId);
    }

    function setResultArray(uint[NUMBER_OF_GAMES] memory _results) external {
        require(msg.sender == owner() || whitelistedAddresses[msg.sender], "Invalid caller");
        for (uint i = 0; i < _results.length; i++) {
            require(isValidGameId(i), "Not valid game index");

            results[i] = _results[i];

            emit ResultForGameAdded(i, _results[i]);
        }
    }

    function setFinalDateForPositioning(uint _toDate) external onlyOwner {
        canNotMintOrUpdateAfter = _toDate;

        emit FinalPositioningDateUpdated(_toDate);
    }

    function retrieveSUSDAmount(uint amount) external onlyOwner {
        sUSD.safeTransfer(msg.sender, amount);
    }

    function assignGameIdsToRound(uint _roundId, uint[] memory _gameIds) external onlyOwner {
        // Validation of game ids
        for (uint i = 0; i < _gameIds.length; i++) {
            require(isValidGameId(_gameIds[i]), "Not valid gameId");
        }
        require(isValidRoundId(_roundId), "Not valid round id");
        roundToGameIds[_roundId] = _gameIds;

        emit GameIdsAssignedToRound(_roundId, _gameIds);
    }

    /* ========== EVENTS ========== */

    event Mint(address _recipient, uint _id, uint[NUMBER_OF_GAMES] _brackets);
    event UpdateBracketsForAlreadyMintedItem(address _minter, uint itemIndex, uint[NUMBER_OF_GAMES] _newBrackets);

    event ResultForGameAdded(uint _gameIndex, uint _teamId);
    event FinalPositioningDateUpdated(uint _toDate);
    event GameIdsAssignedToRound(uint _roundId, uint[] _gameIds);
    event SetsUSD(address _address);
    event SetMultiCollateralOnOffRamp(address _onramper);
    event SetMintingPrice(uint mintingPrice);
    event SetSafeBox(address _safeBox, uint _sbFee);
    event SetWhitelistedAddress(address whitelisted, bool enabled);
}

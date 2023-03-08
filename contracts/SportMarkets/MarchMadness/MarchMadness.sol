// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/utils/Counters.sol";
import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/security/Pausable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC721/extensions/ERC721URIStorage.sol";

contract MarchMadness is ERC721URIStorage, Pausable, Ownable {
    /* ========== LIBRARIES ========== */

    using Counters for Counters.Counter;

    /* ========== STATE VARIABLES ========== */

    Counters.Counter private _tokenIds;

    string public _name = "Overtime March Madness";
    string public _symbol = "OMM";

    uint public canNotMintOrUpdateAfter;

    uint NUMBER_OF_ROUNDS = 6;

    uint[63] public results;
    uint[6] public roundToPoints;

    mapping(address => bool) public addressAlreadyMinted;

    mapping(uint => uint[63]) public itemToBrackets;
    mapping(address => uint) public addressToTokenId;
    mapping(uint => uint[]) public roundToGameIds;

    string public urlToUse;

    /* ========== MODIFIER ========== */

    modifier notAfterFinalDate() {
        require(canNotMintOrUpdateAfter != 0, "canNotMintOrUpdateAfter is not set");
        require(block.timestamp < canNotMintOrUpdateAfter, "Can not mint after settled date");
        _;
    }

    /* ========== CONSTRUCTOR ========== */

    constructor() ERC721(_name, _symbol) {}

    /* ========== OWC ========== */

    function mint(uint[63] memory _brackets) external whenNotPaused notAfterFinalDate returns (uint newItemId) {
        require(!addressAlreadyMinted[msg.sender], "Address already minted");

        _tokenIds.increment();

        newItemId = _tokenIds.current();

        _mint(msg.sender, newItemId);

        addressAlreadyMinted[msg.sender] = true;

        itemToBrackets[newItemId] = _brackets;
        addressToTokenId[msg.sender] = newItemId;

        _setTokenURI(newItemId, urlToUse);

        emit Mint(msg.sender, newItemId, _brackets);
    }

    function updateBracketsForAlreadyMintedItem(uint _tokenId, uint[63] memory _brackets)
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
    function getBracketsByMinter(address _minter) public view returns (uint[63] memory brackets) {
        uint _tokenId = addressToTokenId[_minter];
        if (_tokenId == 0 || itemToBrackets[_tokenId][0] == 0) return brackets;
        brackets = itemToBrackets[_tokenId];
        return brackets;
    }

    function getResults() external view returns (uint[63] memory) {
        return results;
    }

    function isTeamWinnerOfGameId(uint _gameId, uint _teamId) public view returns (bool _flag) {
        if (isValidGameId(_gameId)) {
            if (results[_gameId] == _teamId) _flag = true;
        }
        return _flag;
    }

    function getCorrectPositionsByTokenId(uint _tokenId) public view returns (uint correctPredictions) {
        uint[63] memory _brackets = itemToBrackets[_tokenId];
        if (_brackets[1] == 0) return 0;

        for (uint i = 0; i < _brackets.length; i++) {
            if (_brackets[i] == results[i]) {
                correctPredictions++;
            }
        }

        return correctPredictions;
    }

    function getCorrectPositionsByMinterAddress(address _minter) public view returns (uint) {
        if (addressToTokenId[_minter] == 0) return 0;
        return getCorrectPositionsByTokenId(addressToTokenId[_minter]);
    }

    function getCorrectPositionsPerRoundByTokenId(uint _roundId, uint _tokenId)
        public
        view
        returns (uint correctPredictions)
    {
        if (!isValidRoundId(_roundId)) return 0;
        if (!_exists(_tokenId)) return 0;

        uint[] memory gameIdsForRound = roundToGameIds[_roundId];
        uint[63] memory brackets = itemToBrackets[_tokenId];

        for (uint i = 0; i < gameIdsForRound.length; i++) {
            if (isTeamWinnerOfGameId(gameIdsForRound[i], brackets[gameIdsForRound[i]])) correctPredictions++;
        }

        return correctPredictions;
    }

    function getCorrectPositionsPerRoundByMinterAddress(uint _roundId, address _minter) public view returns (uint) {
        if (addressToTokenId[_minter] == 0) return 0;
        return getCorrectPositionsPerRoundByTokenId(_roundId, addressToTokenId[_minter]);
    }

    function getCorrectPositionsByRound(address _minter) public view returns (uint[6] memory correctPositionsByRound) {
        if (!_exists(addressToTokenId[_minter])) return correctPositionsByRound;

        for (uint i = 0; i < NUMBER_OF_ROUNDS; i++) {
            uint correctPositionPerRound = getCorrectPositionsPerRoundByTokenId(i, addressToTokenId[_minter]);
            correctPositionsByRound[i] = correctPositionPerRound;
        }

        return correctPositionsByRound;
    }

    function getTotalPointsByTokenId(uint _tokenId) public view returns (uint totalPoints) {
        if (!_exists(_tokenId)) return totalPoints;

        for (uint i = 0; i < roundToPoints.length; i++) {
            uint correctPositionPerRound = getCorrectPositionsPerRoundByTokenId(i, _tokenId);
            totalPoints += (correctPositionPerRound * roundToPoints[i]);
        }

        return totalPoints;
    }

    function getPointsPerRound(address _minter) public view returns (uint[6] memory pointsPerRound) {
        if (addressToTokenId[_minter] == 0) return pointsPerRound;
        if (!_exists(addressToTokenId[_minter])) return pointsPerRound;

        for (uint i = 0; i < NUMBER_OF_ROUNDS; i++) {
            uint correctPositionPerRound = getCorrectPositionsPerRoundByTokenId(i, addressToTokenId[_minter]);
            pointsPerRound[i] += (correctPositionPerRound * roundToPoints[i]);
        }

        return pointsPerRound;
    }

    function getTotalPointsByMinterAddress(address _minter) public view returns (uint) {
        if (addressToTokenId[_minter] == 0) return 0;
        return getTotalPointsByTokenId(addressToTokenId[_minter]);
    }

    /* ========== INTERNALS ========== */

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override {
        require(from == address(0) || to == address(0), "NonTransferrableERC721Token: non transferrable");
    }

    function isValidGameId(uint _gameId) internal pure returns (bool _flag) {
        if (_gameId >= 0 && _gameId < 63) _flag = true;
        return _flag;
    }

    function isValidRoundId(uint _roundId) internal pure returns (bool _flag) {
        if (_roundId >= 0 && _roundId < 6) _flag = true;
        return _flag;
    }

    function isValidTeamIndex(uint _teamId) internal pure returns (bool _flag) {
        if (_teamId > 0 && _teamId <= 64) _flag = true;
        return _flag;
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    function setPaused(bool paused) external onlyOwner {
        return paused ? _pause() : _unpause();
    }

    function setURLToUse(string memory _urlToUse) external onlyOwner {
        urlToUse = _urlToUse;
    }

    function setResultForGame(uint _gameId, uint _teamId) external onlyOwner {
        require(isValidTeamIndex(_teamId), "Not valid team index");
        require(isValidGameId(_gameId), "Not valid game index");
        results[_gameId] = _teamId;

        emit ResultForGameAdded(_gameId, _teamId);
    }

    function setFinalDateForPositioning(uint _toDate) external onlyOwner {
        canNotMintOrUpdateAfter = _toDate;

        emit FinalPositioningDateUpdated(_toDate);
    }

    function setPointsToRound(uint _roundId, uint _points) external onlyOwner {
        require(isValidGameId(_roundId), "Not valid roundId");
        roundToPoints[_roundId] = _points;

        emit PointsSettledForRound(_roundId, _points);
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

    event Mint(address _recipient, uint _id, uint[63] _brackets);
    event UpdateBracketsForAlreadyMintedItem(address _minter, uint itemIndex, uint[63] _newBrackets);

    event ResultForGameAdded(uint _gameIndex, uint _teamId);
    event FinalPositioningDateUpdated(uint _toDate);
    event GameIdsAssignedToRound(uint _roundId, uint[] _gameIds);
    event PointsSettledForRound(uint _roundId, uint _points);
}

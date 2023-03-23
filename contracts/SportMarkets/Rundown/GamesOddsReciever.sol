// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

// interface
import "../../interfaces/ITherundownConsumer.sol";
import "../../interfaces/IGamesOddsObtainer.sol";

/// @title Recieve odds from a bots and cast to contract odds
/// @author gruja
contract GamesOddsReceiver is Initializable, ProxyOwned, ProxyPausable {
    ITherundownConsumer public consumer;
    IGamesOddsObtainer public obtainer;

    mapping(address => bool) public whitelistedAddresses;

    /// @notice public initialize proxy method
    /// @param _owner future owner of a contract
    function initialize(
        address _owner,
        address _consumer,
        address _obtainer,
        address[] memory _whitelistAddresses
    ) public initializer {
        setOwner(_owner);
        consumer = ITherundownConsumer(_consumer);
        obtainer = IGamesOddsObtainer(_obtainer);

        for (uint i; i < _whitelistAddresses.length; i++) {
            whitelistedAddresses[_whitelistAddresses[i]] = true;
        }
    }

    function fulfillGamesOdds(
        bytes32[] memory _gameIds,
        int24[] memory _mainOdds,
        int16[] memory _spreadLines,
        int24[] memory _spreadOdds,
        uint24[] memory _totalLines,
        int24[] memory _totalOdds
    ) external isAddressWhitelisted {
        for (uint i = 0; i < _gameIds.length; i++) {
            IGamesOddsObtainer.GameOdds memory game = _castToGameOdds(
                i,
                _gameIds[i],
                _mainOdds,
                _spreadLines,
                _spreadOdds,
                _totalLines,
                _totalOdds
            );
            // game needs to be fulfilled and market needed to be created
            if (consumer.gameFulfilledCreated(_gameIds[i]) && consumer.marketPerGameId(_gameIds[i]) != address(0)) {
                obtainer.obtainOdds(_gameIds[i], game, consumer.sportsIdPerGame(_gameIds[i]));
            }
        }
    }

    function _castToGameOdds(
        uint index,
        bytes32 _gameId,
        int24[] memory _mainOdds,
        int16[] memory _spreadLines,
        int24[] memory _spreadOdds,
        uint24[] memory _totalLines,
        int24[] memory _totalOdds
    ) internal returns (IGamesOddsObtainer.GameOdds memory) {
        return
            IGamesOddsObtainer.GameOdds(
                _gameId,
                _mainOdds[index * 3],
                _mainOdds[index * 3 + 1],
                _mainOdds[index * 3 + 2],
                _spreadLines[index * 2],
                _spreadOdds[index * 2],
                _spreadLines[index * 2 + 1],
                _spreadOdds[index * 2 + 1],
                _totalLines[index * 2],
                _totalOdds[index * 2],
                _totalLines[index * 2 + 1],
                _totalOdds[index * 2 + 1]
            );
    }

    /// @notice sets the consumer contract address, which only owner can execute
    /// @param _consumer address of a consumer contract
    function setConsumerAddress(address _consumer) external onlyOwner {
        require(_consumer != address(0), "Invalid address");
        consumer = ITherundownConsumer(_consumer);
        emit NewConsumerAddress(_consumer);
    }

    /// @notice sets the consumer contract address, which only owner can execute
    /// @param _obtainer address of a consumer contract
    function setObtainerAddress(address _obtainer) external onlyOwner {
        require(_obtainer != address(0), "Invalid address");
        obtainer = IGamesOddsObtainer(_obtainer);
        emit NewObtainerAddress(_obtainer);
    }

    /// @notice adding/removing whitelist address depending on a flag
    /// @param _whitelistAddresses addresses that needed to be whitelisted/ ore removed from WL
    /// @param _flag adding or removing from whitelist (true: add, false: remove)
    function addToWhitelist(address[] memory _whitelistAddresses, bool _flag) external onlyOwner {
        require(_whitelistAddresses.length > 0, "Whitelisted addresses cannot be empty");
        for (uint256 index = 0; index < _whitelistAddresses.length; index++) {
            require(_whitelistAddresses[index] != address(0), "Can't be zero address");
            // only if current flag is different, if same skip it
            if (whitelistedAddresses[_whitelistAddresses[index]] != _flag) {
                whitelistedAddresses[_whitelistAddresses[index]] = _flag;
                emit AddedIntoWhitelist(_whitelistAddresses[index], _flag);
            }
        }
    }

    modifier isAddressWhitelisted() {
        require(whitelistedAddresses[msg.sender], "Whitelisted address");
        _;
    }

    event NewObtainerAddress(address _obtainer);
    event NewConsumerAddress(address _consumer);
    event AddedIntoWhitelist(address _whitelistAddress, bool _flag);
}

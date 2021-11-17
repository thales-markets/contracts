pragma solidity ^0.5.16;

import "synthetix-2.50.4-ovm/contracts/Pausable.sol";
import "openzeppelin-solidity-2.3.0/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity-2.3.0/contracts/math/Math.sol";
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/SafeERC20.sol";
import "synthetix-2.50.4-ovm/contracts/SafeDecimalMath.sol";
import "../interfaces/IPriceFeed.sol";

contract ThalesRoyale is Owned, Pausable {
    using SafeMath for uint;
    using SafeDecimalMath for uint;
    using SafeERC20 for IERC20;

    uint public reward;
    IERC20 public rewardToken;
    bytes32 public oracleKey;
    IPriceFeed public priceFeed;
    uint public rounds;
    uint public signUpPeriod = 72 hours;

    uint public roundChoosingLength = 8 hours;
    uint public roundLength = 24 hours;

    uint public round = 0;
    uint public roundStartTime;
    uint public roundEndTime;

    uint public roundTargetPrice;

    mapping(uint => uint) public roundResult;
    mapping(uint => uint) public targetPricePerRound;
    mapping(uint => uint) public finalPricePerRound;

    mapping(uint256 => mapping(uint256 => uint256)) public positionsOverPricePerRound;
    mapping(uint256 => mapping(uint256 => uint256)) public positionsUnderPricePerRound;
    mapping(uint => uint) public totalPlayersPerRound;
    mapping(uint => uint) public eliminatedPerRound;

    address[] public players;
    mapping(address => uint) public playerSignedUp;

    uint public creationTime;
    bool public started = false;
    bool public finished = false;

    mapping(address => mapping(uint256 => uint256)) public positionInARound;

    constructor(
        address _owner,
        bytes32 _oracleKey,
        IPriceFeed _priceFeed,
        uint reward,
        address _rewardToken,
        uint _rounds,
        uint _signUpPeriod,
        uint _roundChoosingLength,
        uint _roundLength
    ) public Owned(_owner) {
        creationTime = block.timestamp;
        oracleKey = _oracleKey;
        priceFeed = _priceFeed;
        rewardToken = IERC20(_rewardToken);
        rounds = _rounds;
        signUpPeriod = _signUpPeriod;
        roundChoosingLength = _roundChoosingLength;
        roundLength = _roundLength;
    }

    function signUp() external {
        require(block.timestamp < (creationTime + signUpPeriod), "Sign up period has expired");
        require(playerSignedUp[msg.sender] == 0, "Player already signed up");
        playerSignedUp[msg.sender] = block.timestamp;
        players.push(msg.sender);
        emit SignedUp(msg.sender);
    }

    function signUpOnBehalf(address newSignee) external onlyOwner {
        require(block.timestamp < (creationTime + signUpPeriod), "Sign up period has expired");
        require(playerSignedUp[newSignee] == 0, "Player already signed up");
        playerSignedUp[newSignee] = block.timestamp;
        players.push(newSignee);
        emit SignedUp(newSignee);
    }

    function startRoyale() external {
        require(block.timestamp > (creationTime + signUpPeriod), "Can't start until signup period expires");
        require(started == false, "Already started");
        roundTargetPrice = priceFeed.rateForCurrency(oracleKey);
        targetPricePerRound[1] = roundTargetPrice;
        started = true;
        round = 1;
        roundStartTime = block.timestamp;
        roundEndTime = roundStartTime + roundLength;
        totalPlayersPerRound[1] = players.length;
        emit RoyaleStarted();
    }

    function takeAPosition(uint position) external {
        require(position == 1 || position == 2, "Position can only be 1 or 2");
        require(started, "Competition not started yet");
        require(!finished, "Competition finished");
        require(playerSignedUp[msg.sender] != 0, "Player did not sign up");

        if (round != 1) {
            require(positionInARound[msg.sender][round - 1] == roundResult[round - 1], "Player no longer alive");
        }

        require(block.timestamp < roundStartTime + roundChoosingLength, "Round positioning finished");
        positionInARound[msg.sender][round] = position;

        // price is equal or over from a real price
        if(position == 2){
            positionsOverPricePerRound[round][position]++;
        }else{
            // price is under a real price
            positionsUnderPricePerRound[round][position]++;
        }

        emit TookAPosition(msg.sender, round, position);
    }

    function closeRound() external {
        require(started, "Competition not started yet");
        require(!finished, "Competition finished");
        require(canCloseRound(), "Can't close round yet");

        uint nextRound = round + 1;

        finalPricePerRound[round] = priceFeed.rateForCurrency(oracleKey);
        roundResult[round] = priceFeed.rateForCurrency(oracleKey) >= roundTargetPrice ? 2 : 1;
        roundTargetPrice = priceFeed.rateForCurrency(oracleKey);

        uint winningPositionsPerRound = roundResult[round] == 2 ? positionsOverPricePerRound[round][2] : positionsUnderPricePerRound[round][1];

        if (nextRound <= rounds){
            // setting total players for next round (round + 1) to be result of position in a previous round
            totalPlayersPerRound[nextRound] = winningPositionsPerRound;
        }

        // setting eliminated players to be total players - number of winning players
        eliminatedPerRound[round] = totalPlayersPerRound[round] - winningPositionsPerRound;   

        round = nextRound;
        targetPricePerRound[round] = roundTargetPrice;

        if (round > rounds) {
            finished = true;
            emit RoyaleFinished();
        } else {
            roundStartTime = block.timestamp;
            roundEndTime = roundStartTime + roundLength;
            totalPlayersPerRound[round] = getAlivePlayers().length;
        }
        emit RoundClosed(round - 1, roundResult[round - 1]);
    }

    function canCloseRound() public view returns (bool) {
        return block.timestamp > (roundStartTime + roundLength);
    }

    function isPlayerAlive(address player) public view returns (bool) {
        if (round > 1) {
            return (positionInARound[player][round - 1] == roundResult[round - 1]);
        } else {
            return playerSignedUp[player] != 0;
        }
    }

    function getPlayers() public view returns (address[] memory) {
        return players;
    }

    function getAlivePlayers() public view returns (address[] memory) {
        uint k = 0;
        for (uint i = 0; i < players.length; i++) {
            if (isPlayerAlive(players[i])) {
                k = k + 1;
            }
        }

        address[] memory alivePlayers = new address[](k);
        k = 0;

        for (uint i = 0; i < players.length; i++) {
            if (isPlayerAlive(players[i])) {
                alivePlayers[k] = players[i];
                k = k + 1;
            }
        }

        return alivePlayers;
    }

    function getTotalPlayersPerRound(uint _round) public view returns (uint) {
        return totalPlayersPerRound[_round];
    }

    function getEliminatedPerRound(uint _round) public view returns (uint) {
        return eliminatedPerRound[_round];
    }

    function setSignUpPeriod(uint _signUpPeriod) public onlyOwner {
        signUpPeriod = _signUpPeriod;
    }

    function setRoundChoosingLength(uint _roundChoosingLength) public onlyOwner {
        roundChoosingLength = _roundChoosingLength;
    }

    function setRoundLength(uint _roundLength) public onlyOwner {
        roundLength = _roundLength;
    }

    function setRewards(uint _reward) public onlyOwner {
        reward = _reward;
    }

    function setPriceFeed(IPriceFeed _priceFeed) public onlyOwner {
        priceFeed = _priceFeed;
    }

    event SignedUp(address user);
    event RoundClosed(uint round, uint result);
    event TookAPosition(address user, uint round, uint position);
    event RoyaleStarted();
    event RoyaleFinished();
}

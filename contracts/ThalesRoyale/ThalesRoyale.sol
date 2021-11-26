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
    uint public claimTime = 1 weeks;
    uint public roundTargetPrice;

    // per season properties season -> rest
    uint public season = 1; 
    mapping(uint => uint) public roundPerSeason;
    mapping(uint => bool) public seasonStart;
    mapping(uint => bool) public seasonFinish;
    mapping(uint => uint) public seasonCreationTime;
    mapping(uint => uint) public royaleSeasonEndTime;
    mapping(uint => uint) public roundInSeasonEndTime;
    mapping(uint => uint) public roundInASeasonStartTime;
    mapping(uint => address[]) public playersPerSeason;
    mapping(uint => mapping(address => uint256)) public playerSignedUpPerSeason;
    mapping(uint => uint) public seasonStartedTime;
    mapping(uint => mapping(uint => uint)) public roundResultPerSeason;
    mapping(uint => mapping(uint => uint)) public targetPricePerRoundPerSeason;
    mapping(uint => mapping(uint => uint)) public finalPricePerRoundPerSeason;
    mapping(uint => mapping(uint256 => mapping(uint256 => uint256))) public positionsPerRoundPerSeason; 
    mapping(uint => mapping(uint => uint)) public totalPlayersPerRoundPerSeason; 
    mapping(uint => mapping(uint => uint)) public eliminatedPerRoundPerSeason;

    mapping(uint => mapping(address => mapping(uint256 => uint256))) public positionInARoundPerSeason;
    mapping(uint => mapping(address => bool)) public rewardCollectedPerSeason;
    mapping(uint => uint) public rewardPerPlayerPerSeason;

    constructor(
        address _owner,
        bytes32 _oracleKey,
        IPriceFeed _priceFeed,
        uint _reward,
        address _rewardToken,
        uint _rounds,
        uint _signUpPeriod,
        uint _roundChoosingLength,
        uint _roundLength,
        uint _claimTime,
        uint _season
    ) public Owned(_owner) {
        oracleKey = _oracleKey;
        priceFeed = _priceFeed;
        rewardToken = IERC20(_rewardToken);
        rounds = _rounds;
        signUpPeriod = _signUpPeriod;
        roundChoosingLength = _roundChoosingLength;
        roundLength = _roundLength;
        reward = _reward;
        claimTime = _claimTime;
        season = _season;
        seasonCreationTime[_season] = block.timestamp;
    }

    function signUp() external {
        require(block.timestamp < (seasonCreationTime[season] + signUpPeriod), "Sign up period has expired");
        require(playerSignedUpPerSeason[season][msg.sender] == 0, "Player already signed up");
        playerSignedUpPerSeason[season][msg.sender] = block.timestamp;
        playersPerSeason[season].push(msg.sender);
        emit SignedUp(msg.sender, season);
    }

    function signUpOnBehalf(address newSignee) external onlyOwner {
        require(block.timestamp < (seasonCreationTime[season] + signUpPeriod), "Sign up period has expired");
        require(playerSignedUpPerSeason[season][newSignee] == 0, "Player already signed up");
        playerSignedUpPerSeason[season][newSignee] = block.timestamp;
        playersPerSeason[season].push(newSignee);
        emit SignedUp(newSignee, season);
    }

    function startRoyale() external {
        require(block.timestamp > (seasonCreationTime[season] + signUpPeriod), "Can't start until signup period expires");
        require(seasonStart[season] == false, "Already started");
        roundTargetPrice = priceFeed.rateForCurrency(oracleKey);
        targetPricePerRoundPerSeason[season][1] = roundTargetPrice;
        seasonStart[season] = true;
        roundPerSeason[season] = 1;
        roundInASeasonStartTime[season] = block.timestamp;
        roundInSeasonEndTime[season] = roundInASeasonStartTime[season] + roundLength;
        totalPlayersPerRoundPerSeason[season][1] = playersPerSeason[season].length;
        emit RoyaleStarted(season);
    }

    function takeAPosition(uint position) external {
        require(position == 1 || position == 2, "Position can only be 1 or 2");
        require(seasonStart[season], "Competition not started yet");
        require(!seasonFinish[season], "Competition finished");
        require(playerSignedUpPerSeason[season][msg.sender] != 0, "Player did not sign up");
        require(positionInARoundPerSeason[season][msg.sender][roundPerSeason[season]] != position, "Same position");

        if (roundPerSeason[season] != 1) {
            require(positionInARoundPerSeason[season][msg.sender][roundPerSeason[season] - 1] == roundResultPerSeason[season][roundPerSeason[season] - 1], "Player no longer alive");
        }

        require(block.timestamp < roundInASeasonStartTime[season] + roundChoosingLength, "Round positioning finished");

        // this block is when sender change positions in a round - first reduce
        if(positionInARoundPerSeason[season][msg.sender][roundPerSeason[season]] == 1){
            positionsPerRoundPerSeason[season][roundPerSeason[season]][1]--;
        }else if (positionInARoundPerSeason[season][msg.sender][roundPerSeason[season]] == 2) {
            positionsPerRoundPerSeason[season][roundPerSeason[season]][2]--;
        }

        // set new value
        positionInARoundPerSeason[season][msg.sender][roundPerSeason[season]] = position;

        // add number of positions
        if(position == 2){
            positionsPerRoundPerSeason[season][roundPerSeason[season]][position]++;
        }else{
            positionsPerRoundPerSeason[season][roundPerSeason[season]][position]++;
        }

        emit TookAPosition(msg.sender, season, roundPerSeason[season], position);
    }

    function closeRound() external {
        require(seasonStart[season], "Competition not started yet");
        require(!seasonFinish[season], "Competition finished");
        require(block.timestamp > (roundInASeasonStartTime[season] + roundLength), "Can't close round yet");

        uint nextRound = roundPerSeason[season] + 1;

        finalPricePerRoundPerSeason[season][roundPerSeason[season]] = priceFeed.rateForCurrency(oracleKey);
        roundResultPerSeason[season][roundPerSeason[season]] = priceFeed.rateForCurrency(oracleKey) >= roundTargetPrice ? 2 : 1;
        roundTargetPrice = priceFeed.rateForCurrency(oracleKey);

        uint winningPositionsPerRound = roundResultPerSeason[season][roundPerSeason[season]] == 2 ? positionsPerRoundPerSeason[season][roundPerSeason[season]][2] : positionsPerRoundPerSeason[season][roundPerSeason[season]][1];

        if (nextRound <= rounds){
            // setting total players for next round (round + 1) to be result of position in a previous round
            totalPlayersPerRoundPerSeason[season][nextRound] = winningPositionsPerRound;
        }

        // setting eliminated players to be total players - number of winning players
        eliminatedPerRoundPerSeason[season][roundPerSeason[season]] = totalPlayersPerRoundPerSeason[season][roundPerSeason[season]] - winningPositionsPerRound;   

        roundPerSeason[season] = nextRound;
        targetPricePerRoundPerSeason[season][roundPerSeason[season]] = roundTargetPrice;

        if (roundPerSeason[season] > rounds || totalPlayersPerRoundPerSeason[season][roundPerSeason[season]] <= 1) {
            seasonFinish[season] = true;
            // there is no more rounds left and it has alive players at last round
            if (roundPerSeason[season] > rounds && getAlivePlayers().length > 0) {
                _populateReward(getAlivePlayers());
            }
            royaleSeasonEndTime[season] = block.timestamp;
            // first close previous round then royale
            emit RoundClosed(season, roundPerSeason[season] - 1, roundResultPerSeason[season][roundPerSeason[season] - 1]);
            emit RoyaleFinished(season);
        } else {
            roundInASeasonStartTime[season] = block.timestamp;
            roundInSeasonEndTime[season] = roundInASeasonStartTime[season] + roundLength;
            emit RoundClosed(season, roundPerSeason[season] - 1, roundResultPerSeason[season][roundPerSeason[season] - 1]);
        }
    }

    function canCloseRound() public view returns (bool) {
        return seasonStart[season] && !seasonFinish[season] && block.timestamp > (roundInASeasonStartTime[season] + roundLength);
    }

    function canStartRoyale() public view returns (bool) {
        return !seasonStart[season] && block.timestamp > (seasonCreationTime[season] + signUpPeriod);
    }

    function isPlayerAliveInASpecificSeason(address player, uint _season) public view returns (bool) {
        if (roundPerSeason[_season] > 1) {
            return (positionInARoundPerSeason[_season][player][roundPerSeason[_season] - 1] == roundResultPerSeason[_season][roundPerSeason[_season] - 1]);
        } else {
            return playerSignedUpPerSeason[_season][player] != 0;
        }
    }

    function isPlayerAlive(address player) public view returns (bool) {
        if (roundPerSeason[season] > 1) {
            return (positionInARoundPerSeason[season][player][roundPerSeason[season] - 1] == roundResultPerSeason[season][roundPerSeason[season] - 1]);
        } else {
            return playerSignedUpPerSeason[season][player] != 0;
        }
    }

    function getPlayers() public view returns (address[] memory) {
        return playersPerSeason[season];
    }

    function getPlayersInASeason(uint _season) public view returns (address[] memory) {
        return playersPerSeason[_season];
    }

    function getAlivePlayers() public view returns (address[] memory) {
        uint k = 0;
        for (uint i = 0; i < playersPerSeason[season].length; i++) {
            if (isPlayerAlive(playersPerSeason[season][i])) {
                k = k + 1;
            }
        }

        address[] memory alivePlayers = new address[](k);
        k = 0;

        for (uint i = 0; i < playersPerSeason[season].length; i++) {
            if (isPlayerAlive(playersPerSeason[season][i])) {
                alivePlayers[k] = playersPerSeason[season][i];
                k = k + 1;
            }
        }

        return alivePlayers;
    }

    function getAlivePlayersInSpecificSeason(uint _season) public view returns (address[] memory) {
        uint k = 0;
        for (uint i = 0; i < playersPerSeason[_season].length; i++) {
            if (isPlayerAliveInASpecificSeason(playersPerSeason[_season][i], _season)) {
                k = k + 1;
            }
        }

        address[] memory alivePlayers = new address[](k);
        k = 0;

        for (uint i = 0; i < playersPerSeason[_season].length; i++) {
            if (isPlayerAliveInASpecificSeason(playersPerSeason[_season][i], _season)) {
                alivePlayers[k] = playersPerSeason[_season][i];
                k = k + 1;
            }
        }

        return alivePlayers;
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

    function setRoundNumber(uint _rounds) public onlyOwner {
        rounds = _rounds;
    }


    function setClaimTime(uint _claimTime) public onlyOwner {
        claimTime = _claimTime;
    }

    function startNewSeason() public onlyOwner {
        require(seasonFinish[season], "Previous season must be finished");
        season = season + 1;
        seasonCreationTime[season] = block.timestamp;
        emit NewSeasonStarted(season);
    }

    function _populateReward(address[] memory alivePlayers) internal {
        require(seasonFinish[season], "Royale must be finished");
        require(alivePlayers.length > 0, "There is no alive players left in Royale");

        rewardPerPlayerPerSeason[season] = reward.div(alivePlayers.length);
    }

    function claimRewardForCurrentSeason() public onlyWinners(season) {
        _claimRewardForSeason(season);
    }

    function claimRewardForSeason(uint _season) public onlyWinners (_season) {
        _claimRewardForSeason(_season);
    }

    function _claimRewardForSeason(uint _season) internal {
        require(reward > 0, "Reward must be set");
        require(rewardPerPlayerPerSeason[_season] > 0, "Reward per player must be more then zero");
        require(rewardCollectedPerSeason[_season][msg.sender] == false, "Player already collected reward");
        require(block.timestamp < (royaleSeasonEndTime[_season] + claimTime), "Time for reward claiming expired");

        // get balance 
        uint balance = rewardToken.balanceOf(address(this));
        
        if (balance != 0){

            // set collected -> true
            rewardCollectedPerSeason[_season][msg.sender] = true;
            
            // transfering rewardPerPlayer
            rewardToken.transfer(msg.sender, rewardPerPlayerPerSeason[_season]);

            // emit event
            emit RewardClaimed(_season, msg.sender, rewardPerPlayerPerSeason[_season]);
        }
    }

    modifier onlyWinners (uint _season) {
        require(seasonFinish[_season], "Royale must be finished!");
        require(getAlivePlayersInSpecificSeason(_season).length > 0, "There is no alive players left in Royale");
        require(isPlayerAliveInASpecificSeason(msg.sender, _season) == true, "Player is not alive");
        _;
    }

    event SignedUp(address user, uint season);
    event RoundClosed(uint season, uint round, uint result);
    event TookAPosition(address user, uint season, uint round, uint position);
    event RoyaleStarted(uint season);
    event RoyaleFinished(uint season);
    event RewardClaimed(uint season, address winner, uint reward);
    event NewSeasonStarted(uint season);
}

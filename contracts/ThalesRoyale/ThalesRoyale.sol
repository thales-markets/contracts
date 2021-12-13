pragma solidity ^0.5.16;

// external
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity-2.3.0/contracts/math/Math.sol";
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/upgrades-core/contracts/Initializable.sol";
import "synthetix-2.50.4-ovm/contracts/SafeDecimalMath.sol";

// interfaces
import "../interfaces/IPriceFeed.sol";

// internal
import "../utils/proxy/ProxyReentrancyGuard.sol";
import "../utils/proxy/ProxyOwned.sol";
import "../utils/proxy/ProxyPausable.sol";

contract ThalesRoyale is Initializable, ProxyOwned, ProxyReentrancyGuard, ProxyPausable {

    /* ========== LIBRARIES ========== */

    using SafeMath for uint;
    using SafeDecimalMath for uint;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IERC20 public rewardToken;
    bytes32 public oracleKey;
    IPriceFeed public priceFeed;

    uint public rounds = 6;
    uint public signUpPeriod = 72 hours;
    uint public roundChoosingLength = 8 hours;
    uint public roundLength = 24 hours;
    uint public claimTime = 1 weeks;

    bool public nextSeasonStartsAutomatically;
    uint public pauseBetweenSeasonsTime = 1 weeks;

    uint public roundTargetPrice;
    uint public buyInAmount;

    /* ========== SEASON VARIABLES ========== */

    uint public season = 1; 

    mapping(uint => uint) public rewardPerSeason;
    mapping(uint => uint) public signedUpPlayersCount;
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
    mapping(uint => uint) public unclaimedRewardPerSeason;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        bytes32 _oracleKey,
        IPriceFeed _priceFeed,
        uint _initialReward,
        address _rewardToken,
        uint _rounds,
        uint _signUpPeriod,
        uint _roundChoosingLength,
        uint _roundLength,
        uint _claimTime,
        uint _season,
        uint _buyInAmount,
        bool _nextSeasonStartsAutomatically,
        uint _pauseBetweenSeasonsTime
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        oracleKey = _oracleKey;
        priceFeed = _priceFeed;
        rewardPerSeason[_season] = _initialReward;
        rewardToken = IERC20(_rewardToken);
        rounds = _rounds;
        signUpPeriod = _signUpPeriod;
        roundChoosingLength = _roundChoosingLength;
        roundLength = _roundLength;
        claimTime = _claimTime;
        season = _season;
        seasonCreationTime[_season] = block.timestamp;
        buyInAmount = _buyInAmount;
        nextSeasonStartsAutomatically = _nextSeasonStartsAutomatically;
        pauseBetweenSeasonsTime = _pauseBetweenSeasonsTime;
    }

    /* ========== GAME ========== */

    function signUp() external {
        require(block.timestamp < (seasonCreationTime[season] + signUpPeriod), "Sign up period has expired");
        require(playerSignedUpPerSeason[season][msg.sender] == 0, "Player already signed up");
        require(rewardToken.allowance(msg.sender, address(this)) >= buyInAmount, "No allowance.");

        playerSignedUpPerSeason[season][msg.sender] = block.timestamp;
        playersPerSeason[season].push(msg.sender);
        signedUpPlayersCount[season]++;

        _buyIn(msg.sender, buyInAmount);

        emit SignedUp(msg.sender, season);
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
        totalPlayersPerRoundPerSeason[season][1] = signedUpPlayersCount[season];
        unclaimedRewardPerSeason[season] = rewardPerSeason[season];
        
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

        uint currentSeasonRound = roundPerSeason[season];
        uint nextRound = currentSeasonRound + 1;

        // getting price
        uint currentPriceFromOracle = priceFeed.rateForCurrency(oracleKey);

        finalPricePerRoundPerSeason[season][currentSeasonRound] = currentPriceFromOracle;
        roundResultPerSeason[season][currentSeasonRound] = currentPriceFromOracle >= roundTargetPrice ? 2 : 1;
        roundTargetPrice = currentPriceFromOracle;

        uint winningPositionsPerRound = roundResultPerSeason[season][currentSeasonRound] == 2 ? positionsPerRoundPerSeason[season][currentSeasonRound][2] : positionsPerRoundPerSeason[season][currentSeasonRound][1];

        if (nextRound <= rounds){
            // setting total players for next round (round + 1) to be result of position in a previous round
            totalPlayersPerRoundPerSeason[season][nextRound] = winningPositionsPerRound;
        }

        // setting eliminated players to be total players - number of winning players
        eliminatedPerRoundPerSeason[season][currentSeasonRound] = totalPlayersPerRoundPerSeason[season][currentSeasonRound] - winningPositionsPerRound;   

        // if no one is left no need to set values
        if(winningPositionsPerRound > 0){
            roundPerSeason[season] = nextRound;
            targetPricePerRoundPerSeason[season][nextRound] = roundTargetPrice;
        }

        if (nextRound > rounds || winningPositionsPerRound <= 1) {
            seasonFinish[season] = true;

            // in no one is winner pick from lest round
            if (winningPositionsPerRound == 0) {
                _populateReward(totalPlayersPerRoundPerSeason[season][currentSeasonRound]);
            } else{ 
                // there is min 1 winner
                _populateReward(winningPositionsPerRound);
            }

            royaleSeasonEndTime[season] = block.timestamp;
            // first close previous round then royale
            emit RoundClosed(season, currentSeasonRound, roundResultPerSeason[season][currentSeasonRound]);
            emit RoyaleFinished(season);
        } else {
            roundInASeasonStartTime[season] = block.timestamp;
            roundInSeasonEndTime[season] = roundInASeasonStartTime[season] + roundLength;
            emit RoundClosed(season, currentSeasonRound, roundResultPerSeason[season][currentSeasonRound]);
        }
    }

    function startNewSeason() external seasonCanStart {

        season = season + 1;
        seasonCreationTime[season] = block.timestamp;

        emit NewSeasonStarted(season);
    }

    function claimRewardForCurrentSeason() external onlyWinners(season) {
        _claimRewardForSeason(season);
    }

    function claimRewardForSeason(uint _season) external onlyWinners (_season) {
        _claimRewardForSeason(_season);
    }

    /* ========== VIEW ========== */

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

    /* ========== INTERNALS ========== */

    function _populateReward(uint numberOfWinners) internal {
        require(seasonFinish[season], "Royale must be finished");
        require(numberOfWinners > 0, "There is no alive players left in Royale");

        rewardPerPlayerPerSeason[season] = rewardPerSeason[season].div(numberOfWinners);
    }

    function _buyIn(address _sender, uint _amount) internal {

        rewardToken.transferFrom(_sender, address(this), _amount);
        rewardPerSeason[season] += _amount;

        emit BuyIn(_sender, _amount, season);
    }

    function _claimRewardForSeason(uint _season) internal {
        require(rewardPerSeason[_season] > 0, "Reward must be set");
        require(rewardPerPlayerPerSeason[_season] > 0, "Reward per player must be more then zero");
        require(rewardCollectedPerSeason[_season][msg.sender] == false, "Player already collected reward");
        require(block.timestamp <= (royaleSeasonEndTime[_season] + claimTime), "Time for reward claiming expired");

        // get balance 
        uint balance = rewardToken.balanceOf(address(this));
        
        if (balance != 0){

            // set collected -> true
            rewardCollectedPerSeason[_season][msg.sender] = true;

            unclaimedRewardPerSeason[_season] = unclaimedRewardPerSeason[_season].sub(rewardPerPlayerPerSeason[_season]);
            
            // transfering rewardPerPlayer
            rewardToken.transfer(msg.sender, rewardPerPlayerPerSeason[_season]);

            // emit event
            emit RewardClaimed(_season, msg.sender, rewardPerPlayerPerSeason[_season]);
        }
    }

    /* ========== CONTRACT MANAGEMENT ========== */

     function setNextSeasonStartsAutomatically(bool _nextSeasonStartsAutomatically) public onlyOwner {
        nextSeasonStartsAutomatically = _nextSeasonStartsAutomatically;
    }

     function setPauseBetweenSeasonsTime(uint _pauseBetweenSeasonsTime) public onlyOwner {
        pauseBetweenSeasonsTime = _pauseBetweenSeasonsTime;
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
        rewardPerSeason[season] = _reward;
    }

    function setRewardsForSpecificSeason(uint _reward, uint _season) public onlyOwner {
        require(_season >= season, "Can not put reward into season which passed");
        rewardPerSeason[_season] = _reward;
    }

    function setPriceFeed(IPriceFeed _priceFeed) public onlyOwner {
        priceFeed = _priceFeed;
    }

    function setRoundNumber(uint _rounds) public onlyOwner {
        rounds = _rounds;
    }

    function setBuyInAmount(uint _buyInAmount) public onlyOwner {
        buyInAmount = _buyInAmount;
    }

    function setClaimTime(uint _claimTime) public onlyOwner {
        claimTime = _claimTime;
    }

    function claimUnclaimedRewards(address _treasuryAddress, uint _season) external onlyOwner {
        require(block.timestamp > royaleSeasonEndTime[_season] + claimTime, "Time for reward claiming not expired");
        require(unclaimedRewardPerSeason[_season] > 0, "Nothing to claim");

        uint unclaimedAmount = unclaimedRewardPerSeason[_season];
        rewardToken.transfer(_treasuryAddress, unclaimedAmount);
        unclaimedRewardPerSeason[_season] = 0;

        emit UnclaimedRewardClaimed(_season, _treasuryAddress, unclaimedAmount);
    }

    function selfDestruct(address payable account) external onlyOwner {
        rewardToken.safeTransfer(account, rewardToken.balanceOf(address(this)));
        selfdestruct(account);
    }

    /* ========== MODIFIERS ========== */

    modifier seasonCanStart () {
        require( msg.sender == owner || (nextSeasonStartsAutomatically && block.timestamp > royaleSeasonEndTime[season] + pauseBetweenSeasonsTime)
            , "Only owner can start season before pause between two seasons");
        require(seasonFinish[season], "Previous season must be finished");
        _;
    }

    modifier onlyWinners (uint _season) {
        require(seasonFinish[_season], "Royale must be finished!");
        require(isPlayerAliveInASpecificSeason(msg.sender, _season) == true, "Player is not alive");
        _;
    }

    /* ========== EVENTS ========== */

    event SignedUp(address user, uint season);
    event BuyIn(address user, uint amount, uint season);
    event RoundClosed(uint season, uint round, uint result);
    event TookAPosition(address user, uint season, uint round, uint position);
    event RoyaleStarted(uint season);
    event RoyaleFinished(uint season);
    event RewardClaimed(uint season, address winner, uint reward);
    event UnclaimedRewardClaimed(uint season, address account, uint reward);
    event NewSeasonStarted(uint season);
}

pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

// interfaces
import "../interfaces/IPriceFeed.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";

contract ThalesRoyale is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard, AccessControlUpgradeable {
    /* ========== LIBRARIES ========== */

    using SafeMathUpgradeable for uint;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /* ========== CONSTANTS =========== */

    uint public constant DOWN = 1;
    uint public constant UP = 2;

    /* ========== STATE VARIABLES ========== */

    IERC20Upgradeable public rewardToken;
    bytes32 public oracleKey;
    IPriceFeed public priceFeed;

    uint public rounds;
    uint public signUpPeriod;
    uint public roundChoosingLength;
    uint public roundLength;

    bool public nextSeasonStartsAutomatically;
    uint public pauseBetweenSeasonsTime;

    uint public roundTargetPrice;
    uint public buyInAmount;

    /* ========== SEASON VARIABLES ========== */

    uint public season;

    mapping(uint => uint) public rewardPerSeason;
    mapping(uint => uint) public signedUpPlayersCount;
    mapping(uint => uint) public roundInASeason;
    mapping(uint => bool) public seasonStarted;
    mapping(uint => bool) public seasonFinished;
    mapping(uint => uint) public seasonCreationTime;
    mapping(uint => uint) public royaleSeasonEndTime;
    mapping(uint => uint) public roundInSeasonEndTime;
    mapping(uint => uint) public roundInASeasonStartTime;
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
    mapping(uint => uint) public rewardPerWinnerPerSeason;
    mapping(uint => uint) public unclaimedRewardPerSeason;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        bytes32 _oracleKey,
        IPriceFeed _priceFeed,
        address _rewardToken,
        uint _rounds,
        uint _signUpPeriod,
        uint _roundChoosingLength,
        uint _roundLength,
        uint _buyInAmount,
        uint _pauseBetweenSeasonsTime,
        bool _nextSeasonStartsAutomatically
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        season = 1;
        nextSeasonStartsAutomatically = true;
        seasonCreationTime[season] = block.timestamp;
        oracleKey = _oracleKey;
        priceFeed = _priceFeed;
        rewardToken = IERC20Upgradeable(_rewardToken);
        rounds = _rounds;
        signUpPeriod = _signUpPeriod;
        roundChoosingLength = _roundChoosingLength;
        roundLength = _roundLength;
        buyInAmount = _buyInAmount;
        pauseBetweenSeasonsTime = _pauseBetweenSeasonsTime;
        nextSeasonStartsAutomatically = _nextSeasonStartsAutomatically;
    }

    /* ========== GAME ========== */

    function signUp() external {
        require(block.timestamp < (seasonCreationTime[season] + signUpPeriod), "Sign up period has expired");
        require(playerSignedUpPerSeason[season][msg.sender] == 0, "Player already signed up");
        require(rewardToken.balanceOf(msg.sender) >= buyInAmount, "Not enough sUSD for buy in");

        playerSignedUpPerSeason[season][msg.sender] = block.timestamp;
        signedUpPlayersCount[season]++;

        _buyIn(msg.sender, buyInAmount);

        emit SignedUp(msg.sender, season);
    }

    function startRoyaleInASeason() external {
        require(block.timestamp > (seasonCreationTime[season] + signUpPeriod), "Can't start until signup period expires");
        require(signedUpPlayersCount[season] > 0, "Can not start, no players in a season");
        require(!seasonStarted[season], "Already started");

        roundTargetPrice = priceFeed.rateForCurrency(oracleKey);
        roundInASeason[season] = 1;
        targetPricePerRoundPerSeason[season][roundInASeason[season]] = roundTargetPrice;
        seasonStarted[season] = true;
        roundInASeasonStartTime[season] = block.timestamp;
        roundInSeasonEndTime[season] = roundInASeasonStartTime[season] + roundLength;
        totalPlayersPerRoundPerSeason[season][roundInASeason[season]] = signedUpPlayersCount[season];
        unclaimedRewardPerSeason[season] = rewardPerSeason[season];

        emit RoyaleStarted(season);
    }

    function takeAPosition(uint position) external {
        require(position == DOWN || position == UP, "Position can only be 1 or 2");
        require(seasonStarted[season], "Competition not started yet");
        require(!seasonFinished[season], "Competition finished");
        require(playerSignedUpPerSeason[season][msg.sender] != 0, "Player did not sign up");
        require(positionInARoundPerSeason[season][msg.sender][roundInASeason[season]] != position, "Same position");

        if (roundInASeason[season] != 1) {
            require(
                positionInARoundPerSeason[season][msg.sender][roundInASeason[season] - 1] ==
                    roundResultPerSeason[season][roundInASeason[season] - 1],
                "Player no longer alive"
            );
        }

        require(block.timestamp < roundInASeasonStartTime[season] + roundChoosingLength, "Round positioning finished");

        // this block is when sender change positions in a round - first reduce
        if (positionInARoundPerSeason[season][msg.sender][roundInASeason[season]] == DOWN) {
            positionsPerRoundPerSeason[season][roundInASeason[season]][DOWN]--;
        } else if (positionInARoundPerSeason[season][msg.sender][roundInASeason[season]] == UP) {
            positionsPerRoundPerSeason[season][roundInASeason[season]][UP]--;
        }

        // set new value
        positionInARoundPerSeason[season][msg.sender][roundInASeason[season]] = position;

        // add number of positions
        if (position == UP) {
            positionsPerRoundPerSeason[season][roundInASeason[season]][position]++;
        } else {
            positionsPerRoundPerSeason[season][roundInASeason[season]][position]++;
        }

        emit TookAPosition(msg.sender, season, roundInASeason[season], position);
    }

    function closeRound() external {
        require(seasonStarted[season], "Competition not started yet");
        require(!seasonFinished[season], "Competition finished");
        require(block.timestamp > (roundInASeasonStartTime[season] + roundLength), "Can't close round yet");

        uint currentSeasonRound = roundInASeason[season];
        uint nextRound = currentSeasonRound + 1;

        // getting price
        uint currentPriceFromOracle = priceFeed.rateForCurrency(oracleKey);

        finalPricePerRoundPerSeason[season][currentSeasonRound] = currentPriceFromOracle;
        roundResultPerSeason[season][currentSeasonRound] = currentPriceFromOracle >= roundTargetPrice ? UP : DOWN;
        roundTargetPrice = currentPriceFromOracle;

        uint winningPositionsPerRound =
            roundResultPerSeason[season][currentSeasonRound] == UP
                ? positionsPerRoundPerSeason[season][currentSeasonRound][UP]
                : positionsPerRoundPerSeason[season][currentSeasonRound][DOWN];

        if (nextRound <= rounds) {
            // setting total players for next round (round + 1) to be result of position in a previous round
            totalPlayersPerRoundPerSeason[season][nextRound] = winningPositionsPerRound;
        }

        // setting eliminated players to be total players - number of winning players
        eliminatedPerRoundPerSeason[season][currentSeasonRound] =
            totalPlayersPerRoundPerSeason[season][currentSeasonRound] -
            winningPositionsPerRound;

        // if no one is left no need to set values
        if (winningPositionsPerRound > 0) {
            roundInASeason[season] = nextRound;
            targetPricePerRoundPerSeason[season][nextRound] = roundTargetPrice;
        }

        if (nextRound > rounds || winningPositionsPerRound <= 1) {
            seasonFinished[season] = true;

            // in no one is winner pick from last round
            if (winningPositionsPerRound == 0) {
                _populateReward(totalPlayersPerRoundPerSeason[season][currentSeasonRound]);
            } else {
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

    function claimRewardForSeason(uint _season) external onlyWinners(_season) {
        _claimRewardForSeason(_season);
    }

    /* ========== VIEW ========== */

    function canCloseRound() public view returns (bool) {
        return
            seasonStarted[season] &&
            !seasonFinished[season] &&
            block.timestamp > (roundInASeasonStartTime[season] + roundLength);
    }

    function canStartRoyale() public view returns (bool) {
        return !seasonStarted[season] && block.timestamp > (seasonCreationTime[season] + signUpPeriod);
    }

    function canStartNewSeason() public view returns (bool) {
        return nextSeasonStartsAutomatically && block.timestamp > royaleSeasonEndTime[season] + pauseBetweenSeasonsTime;
    }

    function hasParticipatedInCurrentOrLastRoyale(address _player) public view returns (bool) {
        if (season > 1) {
            return playerSignedUpPerSeason[season][_player] > 0 || playerSignedUpPerSeason[season - 1][_player] > 0;
        } else {
            return playerSignedUpPerSeason[season][_player] > 0;
        }
    }

    function isPlayerAliveInASpecificSeason(address player, uint _season) public view returns (bool) {
        if (roundInASeason[_season] > 1) {
            return (positionInARoundPerSeason[_season][player][roundInASeason[_season] - 1] ==
                roundResultPerSeason[_season][roundInASeason[_season] - 1]);
        } else {
            return playerSignedUpPerSeason[_season][player] != 0;
        }
    }

    function isPlayerAlive(address player) public view returns (bool) {
        if (roundInASeason[season] > 1) {
            return (positionInARoundPerSeason[season][player][roundInASeason[season] - 1] ==
                roundResultPerSeason[season][roundInASeason[season] - 1]);
        } else {
            return playerSignedUpPerSeason[season][player] != 0;
        }
    }

    /* ========== INTERNALS ========== */

    function _populateReward(uint numberOfWinners) internal {
        require(seasonFinished[season], "Royale must be finished");
        require(numberOfWinners > 0, "There is no alive players left in Royale");

        rewardPerWinnerPerSeason[season] = rewardPerSeason[season].div(numberOfWinners);
    }

    function _buyIn(address _sender, uint _amount) internal {
        rewardToken.safeTransferFrom(_sender, address(this), _amount);
        rewardPerSeason[season] += _amount;
    }

    function _claimRewardForSeason(uint _season) internal {
        require(rewardPerSeason[_season] > 0, "Reward must be set");
        require(!rewardCollectedPerSeason[_season][msg.sender], "Player already collected reward");
        require(rewardToken.balanceOf(address(this)) != 0, "No balance");

        // set collected -> true
        rewardCollectedPerSeason[_season][msg.sender] = true;

        unclaimedRewardPerSeason[_season] = unclaimedRewardPerSeason[_season].sub(rewardPerWinnerPerSeason[_season]);

        // transfering rewardPerPlayer
        rewardToken.safeTransfer(msg.sender, rewardPerWinnerPerSeason[_season]);

        // emit event
        emit RewardClaimed(_season, msg.sender, rewardPerWinnerPerSeason[_season]);
    }

    function _putFunds(uint _amount, uint _season) internal {
        rewardPerSeason[_season] = rewardPerSeason[_season] + _amount;
        rewardToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    function putFunds(uint _amount, uint _season) external onlyOwner {
        require(_amount > 0, "Amount must be more then zero");
        require(_season >= season, "Cant put funds in a past");
        _putFunds(_amount, _season);
    }

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

    function setPriceFeed(IPriceFeed _priceFeed) public onlyOwner {
        priceFeed = _priceFeed;
    }

    function setBuyInAmount(uint _buyInAmount) public onlyOwner {
        buyInAmount = _buyInAmount;
    }

    /* ========== MODIFIERS ========== */

    modifier seasonCanStart() {
        require(
            msg.sender == owner ||
                (nextSeasonStartsAutomatically && block.timestamp > royaleSeasonEndTime[season] + pauseBetweenSeasonsTime),
            "Only owner can start season before pause between two seasons"
        );
        require(seasonFinished[season], "Previous season must be finished");
        _;
    }

    modifier onlyWinners(uint _season) {
        require(seasonFinished[_season], "Royale must be finished!");
        require(isPlayerAliveInASpecificSeason(msg.sender, _season) == true, "Player is not alive");
        _;
    }

    /* ========== EVENTS ========== */

    event SignedUp(address user, uint season);
    event RoundClosed(uint season, uint round, uint result);
    event TookAPosition(address user, uint season, uint round, uint position);
    event RoyaleStarted(uint season);
    event RoyaleFinished(uint season);
    event RewardClaimed(uint season, address winner, uint reward);
    event NewSeasonStarted(uint season);
}

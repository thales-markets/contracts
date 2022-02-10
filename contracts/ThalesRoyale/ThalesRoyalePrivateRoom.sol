pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
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

contract ThalesRoyalePrivateRoom is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    /* ========== LIBRARIES ========== */

    using SafeMathUpgradeable for uint;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /* ========== CONSTANTS =========== */

    uint public constant DOWN = 1;
    uint public constant UP = 2;

    /* ========== ROOM TYPES ========== */

    enum GameType {
        LAST_MAN_STANDING,
        LIMITED_NUMBER_OF_ROUNDS
    }
    enum RoomType {
        OPEN,
        CLOSED
    }

    /* ========== ROOM VARIABLES ========== */

    mapping(uint => address) public roomOwner;
    mapping(uint => bool) public roomPublished;
    mapping(uint => bytes32) public oracleKeyPerRoom;
    mapping(uint => uint) public roomCreationTime;
    mapping(uint => uint) public roomEndTime;
    mapping(uint => uint) public roomSignUpPeriod;
    mapping(uint => uint) public numberOfRoundsInRoom;
    mapping(uint => uint) public roundChoosingLengthInRoom;
    mapping(uint => uint) public roundLengthInRoom;
    mapping(uint => uint) public currentRoundInRoom;
    mapping(uint => bool) public roomStarted;
    mapping(uint => bool) public roomFinished;
    mapping(uint => bool) public isReversedPositioningInRoom;
    mapping(uint => RoomType) public roomTypePerRoom;
    mapping(uint => GameType) public gameTypeInRoom;
    mapping(uint => address[]) public playersPerRoom;
    mapping(uint => address[]) public alowedPlayersPerRoom;
    mapping(uint => mapping(address => uint256)) public playerSignedUpPerRoom;
    mapping(uint => mapping(address => bool)) public playerCanPlayInRoom;
    mapping(uint => uint) public buyInPerPlayerRerRoom;
    mapping(uint => uint) public numberOfPlayersInRoom;
    mapping(uint => uint) public numberOfAlowedPlayersInRoom;

    mapping(uint => uint) public roundTargetPriceInRoom;

    mapping(uint => mapping(uint => uint)) public roundResultPerRoom;
    mapping(uint => mapping(uint => uint)) public targetPricePerRoundPerRoom;
    mapping(uint => mapping(uint => uint)) public finalPricePerRoundPerRoom;
    mapping(uint => mapping(uint => uint)) public totalPlayersInARoomInARound;
    mapping(uint => mapping(uint => uint)) public eliminatedPerRoundPerRoom;

    mapping(uint => uint) public roundStartTimeInRoom;
    mapping(uint => uint) public roundEndTimeInRoom;

    mapping(uint => mapping(uint256 => mapping(uint256 => uint256))) public positionsPerRoundPerRoom;
    mapping(uint => mapping(address => mapping(uint256 => uint256))) public positionInARoundPerRoom;

    mapping(uint => uint) public rewardPerRoom;
    mapping(uint => uint) public rewardPerWinnerPerRoom;
    mapping(uint => mapping(address => bool)) public rewardCollectedPerRoom;
    mapping(uint => uint) public unclaimedRewardPerRoom;

    /* ========== STATE VARIABLES ========== */

    IERC20Upgradeable public rewardToken;
    IPriceFeed public priceFeed;

    address public safeBox;
    uint public safeBoxPercentage;

    uint public roomNumberCounter;

    uint public minTimeSignUp;
    uint public minRoundTime;
    uint public minChooseTime;
    uint public offsetBeteweenChooseAndEndRound;
    uint public maxPlayersInClosedRoom;
    uint public minBuyIn;
    uint public minNumberOfRounds;
    bytes32[] public allowedAssets;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _owner,
        IPriceFeed _priceFeed,
        address _rewardToken,
        uint _minTimeSignUp,
        uint _minRoundTime,
        uint _minChooseTime,
        uint _offsetBeteweenChooseAndEndRound,
        uint _maxPlayersInClosedRoom,
        uint _minBuyIn,
        bytes32[] memory _allowedAssets,
        uint _minNumberOfRounds
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        priceFeed = _priceFeed;
        rewardToken = IERC20Upgradeable(_rewardToken);
        minTimeSignUp = _minTimeSignUp;
        minRoundTime = _minRoundTime;
        minChooseTime = _minChooseTime;
        offsetBeteweenChooseAndEndRound = _offsetBeteweenChooseAndEndRound;
        maxPlayersInClosedRoom = _maxPlayersInClosedRoom;
        minBuyIn = _minBuyIn;
        allowedAssets = _allowedAssets;
        minNumberOfRounds = _minNumberOfRounds;
    }

    /* ========== ROOM CREATION ========== */

    function createOpenRoom(
        bytes32 _oracleKey,
        GameType _gameType,
        uint _buyInAmount,
        uint _amuontOfPlayersinRoom,
        uint _roomSignUpPeriod,
        uint _numberOfRoundsInRoom,
        uint _roundChoosingLength,
        uint _roundLength
    ) external {
        require(_buyInAmount >= minBuyIn, "Buy in must be greather then minimum");
        require(_roomSignUpPeriod >= minTimeSignUp, "Sign in period lower then minimum");
        require(_numberOfRoundsInRoom >= minNumberOfRounds, "Must be more minimum rounds");
        require(_roundChoosingLength >= minChooseTime, "Round chosing lower then minimum");
        require(_roundLength >= minRoundTime, "Round length lower then minimum");
        require(_roundLength >= _roundChoosingLength + offsetBeteweenChooseAndEndRound, "Offset lower then minimum");
        require(_amuontOfPlayersinRoom > 1, "Room must be open and have total players in room");
        require(isAssetAllowed(_oracleKey), "Not allowed assets");
        require(rewardToken.balanceOf(msg.sender) >= _buyInAmount, "No enough sUSD's");
        require(rewardToken.allowance(msg.sender, address(this)) >= _buyInAmount, "No allowance.");

        // set room_id
        roomNumberCounter++;

        // setting global room variables
        roomOwner[roomNumberCounter] = msg.sender;
        roomCreationTime[roomNumberCounter] = block.timestamp;
        roomSignUpPeriod[roomNumberCounter] = _roomSignUpPeriod;
        numberOfRoundsInRoom[roomNumberCounter] = _numberOfRoundsInRoom;
        roundChoosingLengthInRoom[roomNumberCounter] = _roundChoosingLength;
        roundLengthInRoom[roomNumberCounter] = _roundLength;
        roomTypePerRoom[roomNumberCounter] = RoomType.OPEN;
        gameTypeInRoom[roomNumberCounter] = _gameType;
        oracleKeyPerRoom[roomNumberCounter] = _oracleKey;

        // open room properties
        numberOfAlowedPlayersInRoom[roomNumberCounter] = _amuontOfPlayersinRoom;

        // adding amount
        buyInPerPlayerRerRoom[roomNumberCounter] = _buyInAmount;

        // first emit event for room creation
        emit RoomCreated(msg.sender, roomNumberCounter, RoomType.OPEN, _gameType);

        // automaticlly sign up owner of a group as first player
        _signUpOwnerIntoRoom(msg.sender, roomNumberCounter);

        roomPublished[roomNumberCounter] = true;
    }

    function createClosedRoom(
        bytes32 _oracleKey,
        GameType _gameType,
        address[] calldata _alowedPlayers,
        uint _buyInAmount,
        uint _roomSignUpPeriod,
        uint _numberOfRoundsInRoom,
        uint _roundChoosingLength,
        uint _roundLength
    ) external {
        require(_buyInAmount >= minBuyIn, "Buy in must be greather then minimum");
        require(_roomSignUpPeriod >= minTimeSignUp, "Sign in period lower then minimum");
        require(_numberOfRoundsInRoom >= minNumberOfRounds, "Must be more minimum rounds");
        require(_roundChoosingLength >= minChooseTime, "Round chosing lower then minimum");
        require(_roundLength >= minRoundTime, "Round length lower then minimum");
        require(_roundLength >= _roundChoosingLength + offsetBeteweenChooseAndEndRound, "Offset lower then minimum");
        require(
            _alowedPlayers.length > 0 && _alowedPlayers.length < maxPlayersInClosedRoom,
            "Need to have allowed player which number is not greather then max allowed players"
        );
        require(isAssetAllowed(_oracleKey), "Not allowed assets");
        require(rewardToken.balanceOf(msg.sender) >= _buyInAmount, "No enough sUSD's");
        require(rewardToken.allowance(msg.sender, address(this)) >= _buyInAmount, "No allowance.");

        // set room_id
        roomNumberCounter++;

        // setting global room variables
        roomOwner[roomNumberCounter] = msg.sender;
        roomCreationTime[roomNumberCounter] = block.timestamp;
        roomSignUpPeriod[roomNumberCounter] = _roomSignUpPeriod;
        numberOfRoundsInRoom[roomNumberCounter] = _numberOfRoundsInRoom;
        roundChoosingLengthInRoom[roomNumberCounter] = _roundChoosingLength;
        roundLengthInRoom[roomNumberCounter] = _roundLength;
        roomTypePerRoom[roomNumberCounter] = RoomType.CLOSED;
        gameTypeInRoom[roomNumberCounter] = _gameType;
        oracleKeyPerRoom[roomNumberCounter] = _oracleKey;

        // closed room properies
        alowedPlayersPerRoom[roomNumberCounter] = _alowedPlayers;
        alowedPlayersPerRoom[roomNumberCounter].push(msg.sender);
        numberOfAlowedPlayersInRoom[roomNumberCounter] = alowedPlayersPerRoom[roomNumberCounter].length;

        for (uint i = 0; i < alowedPlayersPerRoom[roomNumberCounter].length; i++) {
            playerCanPlayInRoom[roomNumberCounter][alowedPlayersPerRoom[roomNumberCounter][i]] = true;
        }

        // adding amount
        buyInPerPlayerRerRoom[roomNumberCounter] = _buyInAmount;

        // first emit event for room creation
        emit RoomCreated(msg.sender, roomNumberCounter, RoomType.CLOSED, _gameType);

        // automaticlly sign up owner of a group as first player
        _signUpOwnerIntoRoom(msg.sender, roomNumberCounter);

        roomPublished[roomNumberCounter] = true;
    }

    /* ========== GAME ========== */

    function signUpForRoom(uint _roomNumber) external {
        require(roomPublished[_roomNumber], "Room deleted or not published yet");
        require(
            block.timestamp < (roomCreationTime[_roomNumber] + roomSignUpPeriod[_roomNumber]),
            "Sign up period has expired"
        );
        require(playerSignedUpPerRoom[_roomNumber][msg.sender] == 0, "Player already signed up, for this room.");
        require(
            (roomTypePerRoom[_roomNumber] == RoomType.CLOSED && isPlayerAllowed(msg.sender, _roomNumber)) ||
                (roomTypePerRoom[_roomNumber] == RoomType.OPEN && haveSpaceInRoom(_roomNumber)),
            "Can not sign up for room, not allowed or it is full"
        );
        require(rewardToken.balanceOf(msg.sender) >= buyInPerPlayerRerRoom[_roomNumber], "No enough sUSD's");
        require(rewardToken.allowance(msg.sender, address(this)) >= buyInPerPlayerRerRoom[_roomNumber], "No allowance.");

        numberOfPlayersInRoom[_roomNumber]++;
        playerSignedUpPerRoom[_roomNumber][msg.sender] = block.timestamp;

        _buyIn(msg.sender, _roomNumber, buyInPerPlayerRerRoom[_roomNumber]);

        emit SignedUpInARoom(msg.sender, _roomNumber);
    }

    function startRoyaleInRoom(uint _roomNumber) external onlyRoomParticipants(_roomNumber) {
        require(roomPublished[_roomNumber], "Room deleted or not published yet");
        require(
            block.timestamp > (roomCreationTime[_roomNumber] + roomSignUpPeriod[_roomNumber]),
            "Can not start until signup period expires for that room"
        );
        require(!roomStarted[_roomNumber], "Royale already started for that room");

        roundTargetPriceInRoom[_roomNumber] = priceFeed.rateForCurrency(oracleKeyPerRoom[_roomNumber]);
        targetPricePerRoundPerRoom[_roomNumber][1] = roundTargetPriceInRoom[_roomNumber];
        roomStarted[_roomNumber] = true;
        currentRoundInRoom[_roomNumber] = 1;
        roundStartTimeInRoom[_roomNumber] = block.timestamp;
        roundEndTimeInRoom[_roomNumber] = roundStartTimeInRoom[_roomNumber] + roundLengthInRoom[_roomNumber];
        totalPlayersInARoomInARound[_roomNumber][1] = numberOfPlayersInRoom[_roomNumber];
        unclaimedRewardPerRoom[_roomNumber] = rewardPerRoom[_roomNumber];

        emit RoyaleStartedForRoom(_roomNumber, numberOfPlayersInRoom[_roomNumber], rewardPerRoom[_roomNumber]);
    }

    function takeAPositionInRoom(uint _roomNumber, uint _position) external onlyRoomParticipants(_roomNumber) {
        require(_position == DOWN || _position == UP, "Position can only be 1 or 2");
        require(roomStarted[_roomNumber], "Competition not started yet");
        require(!roomFinished[_roomNumber], "Competition finished");
        require(
            positionInARoundPerRoom[_roomNumber][msg.sender][currentRoundInRoom[_roomNumber]] != _position,
            "Same position"
        );

        if (currentRoundInRoom[_roomNumber] != 1) {
            require(isPlayerAliveInASpecificRoom(msg.sender, _roomNumber), "Player no longer alive");
        }

        require(
            block.timestamp < roundStartTimeInRoom[_roomNumber] + roundChoosingLengthInRoom[_roomNumber],
            "Round positioning finished"
        );

        // this block is when sender change positions in a round - first reduce
        if (positionInARoundPerRoom[_roomNumber][msg.sender][currentRoundInRoom[_roomNumber]] == DOWN) {
            positionsPerRoundPerRoom[_roomNumber][currentRoundInRoom[_roomNumber]][DOWN] = positionsPerRoundPerRoom[_roomNumber][currentRoundInRoom[_roomNumber]][DOWN].sub(1);
        } else if (positionInARoundPerRoom[_roomNumber][msg.sender][currentRoundInRoom[_roomNumber]] == UP) {
            positionsPerRoundPerRoom[_roomNumber][currentRoundInRoom[_roomNumber]][UP] = positionsPerRoundPerRoom[_roomNumber][currentRoundInRoom[_roomNumber]][UP].sub(1);
        }

        // set new value
        positionInARoundPerRoom[_roomNumber][msg.sender][currentRoundInRoom[_roomNumber]] = _position;

        // add number of positions
        if (_position == UP) {
            positionsPerRoundPerRoom[_roomNumber][currentRoundInRoom[_roomNumber]][_position]++;
        } else {
            positionsPerRoundPerRoom[_roomNumber][currentRoundInRoom[_roomNumber]][_position]++;
        }

        emit TookAPosition(msg.sender, _roomNumber, currentRoundInRoom[_roomNumber], _position);
    }

    function closeRoundInARoom(uint _roomNumber) external onlyRoomParticipants(_roomNumber) {
        require(roomStarted[_roomNumber], "Competition not started yet");
        require(!roomFinished[_roomNumber], "Competition finished");
        require(
            block.timestamp > (roundStartTimeInRoom[_roomNumber] + roundLengthInRoom[_roomNumber]),
            "Can not close round yet"
        );

        uint currentRound = currentRoundInRoom[_roomNumber];
        uint nextRound = currentRound + 1;

        // getting price
        uint currentPriceFromOracle = priceFeed.rateForCurrency(oracleKeyPerRoom[_roomNumber]);

        finalPricePerRoundPerRoom[_roomNumber][currentRound] = currentPriceFromOracle;
        roundResultPerRoom[_roomNumber][currentRound] = currentPriceFromOracle >= roundTargetPriceInRoom[_roomNumber]
            ? UP
            : DOWN;
        roundTargetPriceInRoom[_roomNumber] = currentPriceFromOracle;

        uint winningPositionsPerRound = roundResultPerRoom[_roomNumber][currentRound] == UP
            ? positionsPerRoundPerRoom[_roomNumber][currentRound][UP]
            : positionsPerRoundPerRoom[_roomNumber][currentRound][DOWN];
        uint losingPositions = roundResultPerRoom[_roomNumber][currentRound] == DOWN
            ? positionsPerRoundPerRoom[_roomNumber][currentRound][UP]
            : positionsPerRoundPerRoom[_roomNumber][currentRound][DOWN];

        if (nextRound <= numberOfRoundsInRoom[_roomNumber] || gameTypeInRoom[_roomNumber] == GameType.LAST_MAN_STANDING) {
            // setting total players for next round (round + 1) to be result of position in a previous round
            if (winningPositionsPerRound == 0 && gameTypeInRoom[_roomNumber] == GameType.LAST_MAN_STANDING) {
                totalPlayersInARoomInARound[_roomNumber][nextRound] = losingPositions;
            } else {
                totalPlayersInARoomInARound[_roomNumber][nextRound] = winningPositionsPerRound;
            }
        }

        // setting eliminated players to be total players - number of winning players
        if (winningPositionsPerRound == 0 && gameTypeInRoom[_roomNumber] == GameType.LAST_MAN_STANDING) {
            eliminatedPerRoundPerRoom[_roomNumber][currentRound] =
                totalPlayersInARoomInARound[_roomNumber][currentRound] -
                losingPositions;
        } else {
            eliminatedPerRoundPerRoom[_roomNumber][currentRound] =
                totalPlayersInARoomInARound[_roomNumber][currentRound] -
                winningPositionsPerRound;
        }

        // if no one is left no need to set values
        if (
            winningPositionsPerRound > 0 ||
            (winningPositionsPerRound == 0 && gameTypeInRoom[_roomNumber] == GameType.LAST_MAN_STANDING)
        ) {
            currentRoundInRoom[_roomNumber] = nextRound;
            targetPricePerRoundPerRoom[_roomNumber][nextRound] = roundTargetPriceInRoom[_roomNumber];
            isReversedPositioningInRoom[_roomNumber] = false;
        }

        // IF number of rounds is limmited and next round is crosses that limmit
        // OR winning people is less or equal to 1 FINISH game (LIMITED_NUMBER_OF_ROUNDS)
        // OR winning people is equal to 1 FINISH game (LAST_MAN_STANDING)
        if (
            (nextRound > numberOfRoundsInRoom[_roomNumber] &&
                gameTypeInRoom[_roomNumber] == GameType.LIMITED_NUMBER_OF_ROUNDS) ||
            (winningPositionsPerRound <= 1 && gameTypeInRoom[_roomNumber] == GameType.LIMITED_NUMBER_OF_ROUNDS) ||
            (winningPositionsPerRound == 1 && gameTypeInRoom[_roomNumber] == GameType.LAST_MAN_STANDING)
        ) {
            roomFinished[_roomNumber] = true;
            uint numberOfWinneres = 0;

            // in no one is winner pick from lest round
            if (winningPositionsPerRound == 0) {
                numberOfWinneres = totalPlayersInARoomInARound[_roomNumber][currentRound];
                _populateRewardForRoom(_roomNumber, totalPlayersInARoomInARound[_roomNumber][currentRound]);
                emit SplitBetweenLoosers(_roomNumber, currentRound, totalPlayersInARoomInARound[_roomNumber][currentRound]);
            } else {
                // there is min 1 winner
                numberOfWinneres = winningPositionsPerRound;
                _populateRewardForRoom(_roomNumber, winningPositionsPerRound);
            }

            roomEndTime[_roomNumber] = block.timestamp;
            // first close previous round then royale
            emit RoundClosedInRoom(_roomNumber, currentRound, roundResultPerRoom[_roomNumber][currentRound]);
            emit RoyaleFinishedForRoom(_roomNumber, numberOfWinneres, rewardPerWinnerPerRoom[_roomNumber]);
        } else {
            // need to reverse result because of isPlayerAliveInASpecificRoom() in positioning a new round so the play can continue
            if (winningPositionsPerRound == 0 && gameTypeInRoom[_roomNumber] == GameType.LAST_MAN_STANDING) {
                isReversedPositioningInRoom[_roomNumber] = true;
            }

            roundStartTimeInRoom[_roomNumber] = block.timestamp;
            roundEndTimeInRoom[_roomNumber] = roundStartTimeInRoom[_roomNumber] + roundLengthInRoom[_roomNumber];
            emit RoundClosedInRoom(_roomNumber, currentRound, roundResultPerRoom[_roomNumber][currentRound]);
        }
    }

    function claimRewardForRoom(uint _roomNumber) external onlyWinners(_roomNumber) {
        require(rewardPerRoom[_roomNumber] > 0, "Reward must be set");
        require(!rewardCollectedPerRoom[_roomNumber][msg.sender], "Player already collected reward");

        // set collected -> true
        rewardCollectedPerRoom[_roomNumber][msg.sender] = true;
        unclaimedRewardPerRoom[_roomNumber] = unclaimedRewardPerRoom[_roomNumber].sub(rewardPerWinnerPerRoom[_roomNumber]);
        // transfering rewardPerPlayer
        rewardToken.safeTransfer(msg.sender, rewardPerWinnerPerRoom[_roomNumber]);
        // emit event
        emit RewardClaimed(_roomNumber, msg.sender, rewardPerWinnerPerRoom[_roomNumber]);
    }

    /* ========== INTERNALS ========== */

    function _signUpOwnerIntoRoom(address _owner, uint _roomNumber) internal {
        numberOfPlayersInRoom[_roomNumber]++;
        playerSignedUpPerRoom[_roomNumber][_owner] = block.timestamp;
        playersPerRoom[_roomNumber].push(_owner);

        _buyIn(_owner, _roomNumber, buyInPerPlayerRerRoom[_roomNumber]);

        emit SignedUpInARoom(_owner, _roomNumber);
    }

    function _populateRewardForRoom(uint _roomNumber, uint _numberOfWinners) internal {
        rewardPerWinnerPerRoom[_roomNumber] = rewardPerRoom[_roomNumber].div(_numberOfWinners);
    }

    function _buyIn(
        address _sender,
        uint _roomNumber,
        uint _amount
    ) internal {

        (uint amountBuyIn, uint amountSafeBox) = _calculateSafeBoxOnAmount(_amount);

        if (amountSafeBox > 0) {
            rewardToken.safeTransferFrom(_sender, safeBox, amountSafeBox);
        }

        rewardToken.safeTransferFrom(_sender, address(this), amountBuyIn);
        rewardPerRoom[_roomNumber] += amountBuyIn;

        emit BuyIn(_sender, _amount, _roomNumber);
    }

    function _calculateSafeBoxOnAmount(uint _amount) internal view returns (uint, uint) {
        uint amountSafeBox = 0;

        if (safeBoxPercentage > 0) {
            amountSafeBox = _amount.div(100).mul(safeBoxPercentage);
        }

        uint amountBuyIn = _amount.sub(amountSafeBox);

        return (amountBuyIn, amountSafeBox);
    }

    function _isPlayerAliveInASpecificRoomReverseOrder(address player, uint _roomNumber) internal view returns (bool) {
        if (roundResultPerRoom[_roomNumber][currentRoundInRoom[_roomNumber] - 1] == DOWN) {
            return positionInARoundPerRoom[_roomNumber][player][currentRoundInRoom[_roomNumber] - 1] == UP;
        } else if (roundResultPerRoom[_roomNumber][currentRoundInRoom[_roomNumber] - 1] == UP) {
            return positionInARoundPerRoom[_roomNumber][player][currentRoundInRoom[_roomNumber] - 1] == DOWN;
        } else {
            return false;
        }
    }

    function _isPlayerAliveInASpecificRoomNormalOrder(address player, uint _roomNumber) internal view returns (bool) {
        if (currentRoundInRoom[_roomNumber] > 1) {
            return (positionInARoundPerRoom[_roomNumber][player][currentRoundInRoom[_roomNumber] - 1] ==
                roundResultPerRoom[_roomNumber][currentRoundInRoom[_roomNumber] - 1]);
        } else {
            return playerSignedUpPerRoom[_roomNumber][player] != 0;
        }
    }

    /* ========== VIEW ========== */

    function isAssetAllowed(bytes32 _oracleKey) public view returns (bool) {
        for (uint256 i = 0; i < allowedAssets.length; i++) {
            if (allowedAssets[i] == _oracleKey) {
                return true;
            }
        }
        return false;
    }

    function isPlayerAliveInASpecificRoom(address player, uint _roomNumber) public view returns (bool) {
        if (!isReversedPositioningInRoom[_roomNumber]) {
            return _isPlayerAliveInASpecificRoomNormalOrder(player, _roomNumber);
        } else {
            return _isPlayerAliveInASpecificRoomReverseOrder(player, _roomNumber);
        }
    }

    function isPlayerAllowed(address _player, uint _roomNumber) public view returns (bool) {
        return playerCanPlayInRoom[_roomNumber][_player];
    }

    function haveSpaceInRoom(uint _roomNumber) public view returns (bool) {
        return numberOfPlayersInRoom[_roomNumber] < numberOfAlowedPlayersInRoom[roomNumberCounter];
    }

    function isPlayerOwner(address _player, uint _roomNumber) public view returns (bool) {
        return _player == roomOwner[_roomNumber];
    }

    function canStartRoyaleInRoom(uint _roomNumber) public view returns (bool) {
        return
            block.timestamp > (roomCreationTime[_roomNumber] + roomSignUpPeriod[_roomNumber]) && !roomStarted[_roomNumber];
    }

    function canCloseRoundInRoom(uint _roomNumber) public view returns (bool) {
        return
            roomStarted[_roomNumber] &&
            !roomFinished[_roomNumber] &&
            block.timestamp > (roundStartTimeInRoom[_roomNumber] + roundLengthInRoom[_roomNumber]);
    }

    function getPlayersForRoom(uint _room) public view returns (address[] memory) {
        return playersPerRoom[_room];
    }

    /* ========== ROOM MANAGEMENT ========== */

    function setBuyInAmount(uint _roomNumber, uint _buyInAmount) public canChangeRoomVariables(_roomNumber) {
        require(_buyInAmount >= minBuyIn, "Buy in must be greather then minimum");
        require(buyInPerPlayerRerRoom[_roomNumber] != _buyInAmount, "Same amount");

        // if _buyInAmount is increased
        if (_buyInAmount > buyInPerPlayerRerRoom[_roomNumber]) {
            require(
                rewardToken.allowance(msg.sender, address(this)) >= _buyInAmount.sub(buyInPerPlayerRerRoom[_roomNumber]),
                "No allowance."
            );

            _buyIn(msg.sender, _roomNumber, _buyInAmount - buyInPerPlayerRerRoom[_roomNumber]);
            buyInPerPlayerRerRoom[_roomNumber] = _buyInAmount;
            // or decreased
        } else {
            (uint amountBuyIn,) = _calculateSafeBoxOnAmount(_buyInAmount);
            uint differenceInReward = rewardPerRoom[_roomNumber].sub(amountBuyIn);
            buyInPerPlayerRerRoom[_roomNumber] = _buyInAmount;
            rewardPerRoom[_roomNumber] = amountBuyIn;
            rewardToken.safeTransfer(msg.sender, differenceInReward);
        }

        emit BuyInAmountChanged(_roomNumber, _buyInAmount);
    }

    function setRoundLength(uint _roomNumber, uint _roundLength) public canChangeRoomVariables(_roomNumber) {
        require(_roundLength >= minRoundTime, "Round length lower then minimum");
        require(
            _roundLength >= roundChoosingLengthInRoom[_roomNumber] + offsetBeteweenChooseAndEndRound,
            "Offset lower then minimum"
        );

        roundLengthInRoom[_roomNumber] = _roundLength;

        emit NewRoundLength(_roomNumber, _roundLength);
    }

    function setRoomSignUpPeriod(uint _roomNumber, uint _roomSignUpPeriod) public canChangeRoomVariables(_roomNumber) {
        require(_roomSignUpPeriod >= minTimeSignUp, "Sign in period lower then minimum");

        roomSignUpPeriod[_roomNumber] = _roomSignUpPeriod;

        emit NewRoomSignUpPeriod(_roomNumber, _roomSignUpPeriod);
    }

    function setNumberOfRoundsInRoom(uint _roomNumber, uint _numberOfRoundsInRoom)
        public
        canChangeRoomVariables(_roomNumber)
    {
        require(_numberOfRoundsInRoom > minNumberOfRounds, "Must be more then minimum");

        numberOfRoundsInRoom[_roomNumber] = _numberOfRoundsInRoom;

        emit NewNumberOfRounds(_roomNumber, _numberOfRoundsInRoom);
    }

    function setRoundChoosingLength(uint _roomNumber, uint _roundChoosingLength) public canChangeRoomVariables(_roomNumber) {
        require(_roundChoosingLength >= minChooseTime, "Round chosing lower then minimum");
        require(
            roundLengthInRoom[_roomNumber] >= _roundChoosingLength + offsetBeteweenChooseAndEndRound,
            "Round length lower then minimum"
        );

        roundChoosingLengthInRoom[_roomNumber] = _roundChoosingLength;

        emit NewRoundChoosingLength(_roomNumber, _roundChoosingLength);
    }

    function setOracleKey(uint _roomNumber, bytes32 _oracleKey) public canChangeRoomVariables(_roomNumber) {
        require(isAssetAllowed(_oracleKey), "Not allowed assets");

        oracleKeyPerRoom[_roomNumber] = _oracleKey;

        emit NewOracleKeySetForRoom(_roomNumber, _oracleKey);
    }

    function setNewAllowedPlayersPerRoomClosedRoom(uint _roomNumber, address[] memory _alowedPlayers)
        public
        canChangeRoomVariables(_roomNumber)
    {
        require(
            roomTypePerRoom[_roomNumber] == RoomType.CLOSED && _alowedPlayers.length > 0,
            "Room need to be closed and  allowed players not empty"
        );

        // setting players - no play
        for (uint i = 0; i < alowedPlayersPerRoom[roomNumberCounter].length; i++) {
            playerCanPlayInRoom[roomNumberCounter][alowedPlayersPerRoom[roomNumberCounter][i]] = false;
        }

        // setting players that can play
        alowedPlayersPerRoom[_roomNumber] = _alowedPlayers;
        alowedPlayersPerRoom[_roomNumber].push(msg.sender);
        numberOfAlowedPlayersInRoom[_roomNumber] = alowedPlayersPerRoom[_roomNumber].length;

        for (uint i = 0; i < alowedPlayersPerRoom[_roomNumber].length; i++) {
            playerCanPlayInRoom[_roomNumber][alowedPlayersPerRoom[_roomNumber][i]] = true;
        }

        emit NewPlayersAllowed(_roomNumber, numberOfAlowedPlayersInRoom[_roomNumber]);
    }

    function addAllowedPlayerPerRoomClosedRoom(uint _roomNumber, address _alowedPlayer)
        public
        canChangeRoomVariables(_roomNumber)
    {
        require(roomTypePerRoom[_roomNumber] == RoomType.CLOSED, "Type of room needs to be closed");
        require(!playerCanPlayInRoom[_roomNumber][_alowedPlayer], "Already allowed");

        alowedPlayersPerRoom[_roomNumber].push(_alowedPlayer);
        playerCanPlayInRoom[_roomNumber][_alowedPlayer] = true;
        numberOfAlowedPlayersInRoom[_roomNumber]++;

        emit NewPlayerAddedIntoRoom(_roomNumber, _alowedPlayer);
    }

    function setAmuontOfPlayersInOpenRoom(uint _roomNumber, uint _amuontOfPlayersinRoom)
        public
        canChangeRoomVariables(_roomNumber)
    {
        require(
            roomTypePerRoom[_roomNumber] == RoomType.OPEN && _amuontOfPlayersinRoom > 1,
            "Must be more then one player and open room"
        );

        numberOfAlowedPlayersInRoom[_roomNumber] = _amuontOfPlayersinRoom;

        emit NewAmountOfPlayersInOpenRoom(_roomNumber, _amuontOfPlayersinRoom);
    }

    function deleteRoom(uint _roomNumber) public canChangeRoomVariables(_roomNumber) {
        require(roomPublished[_roomNumber], "Already deleted");

        roomPublished[_roomNumber] = false;
        rewardToken.safeTransfer(msg.sender, buyInPerPlayerRerRoom[_roomNumber]);

        emit RoomDeleted(_roomNumber, msg.sender);
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    function addAsset(bytes32 _asset) public onlyOwner {
        allowedAssets.push(_asset);
        emit NewAssetAllowed(_asset);
    }

    function setPriceFeed(IPriceFeed _priceFeed) public onlyOwner {
        priceFeed = _priceFeed;
        emit NewPriceFeed(_priceFeed);
    }

    function setMinTimeSignUp(uint _minTimeSignUp) public onlyOwner {
        minTimeSignUp = _minTimeSignUp;
        emit NewMinTimeSignUp(_minTimeSignUp);
    }

    function setMinRoundTime(uint _minRoundTime) public onlyOwner {
        minRoundTime = _minRoundTime;
        emit NewMinRoundTime(_minRoundTime);
    }

    function setMinChooseTime(uint _minChooseTime) public onlyOwner {
        minChooseTime = _minChooseTime;
        emit NewMinChooseTime(_minChooseTime);
    }

    function setOffsetBeteweenChooseAndEndRound(uint _offsetBeteweenChooseAndEndRound) public onlyOwner {
        offsetBeteweenChooseAndEndRound = _offsetBeteweenChooseAndEndRound;
        emit NewOffsetBeteweenChooseAndEndRound(_offsetBeteweenChooseAndEndRound);
    }

    function setMaxPlayersInClosedRoom(uint _maxPlayersInClosedRoom) public onlyOwner {
        maxPlayersInClosedRoom = _maxPlayersInClosedRoom;
        emit NewMaxPlayersInClosedRoom(_maxPlayersInClosedRoom);
    }

    function setMinBuyIn(uint _minBuyIn) public onlyOwner {
        minBuyIn = _minBuyIn;
        emit NewMinBuyIn(_minBuyIn);
    }

    function setSafeBoxPercentage(uint _safeBoxPercentage) public onlyOwner {
        require(_safeBoxPercentage >= 0 && _safeBoxPercentage <= 100, "Must be in between 0 and 100 %");
        safeBoxPercentage = _safeBoxPercentage;
        emit NewSafeBoxPercentage(_safeBoxPercentage);
    }

    function setSafeBox(address _safeBox) public onlyOwner {
        safeBox = _safeBox;
        emit NewSafeBox(_safeBox);
    }

    function pullFunds(address payable _account) external onlyOwner {
        rewardToken.safeTransfer(_account, rewardToken.balanceOf(address(this)));
        emit PullFunds(_account, rewardToken.balanceOf(address(this)));
    }

    /* ========== MODIFIERS ========== */

    modifier canChangeRoomVariables(uint _roomNumber) {
        require(msg.sender == roomOwner[_roomNumber], "You are not owner of room.");
        require(numberOfPlayersInRoom[_roomNumber] < 2, "Player already sign up for room, no change allowed");
        require(roomPublished[_roomNumber], "Deleted room");
        _;
    }

    modifier onlyRoomParticipants(uint _roomNumber) {
        require(playerSignedUpPerRoom[_roomNumber][msg.sender] != 0, "You are not room participant");
        _;
    }

    modifier onlyWinners(uint _roomNumber) {
        require(roomFinished[_roomNumber], "Royale must be finished!");
        require(isPlayerAliveInASpecificRoom(msg.sender, _roomNumber) == true, "Player is not alive");
        _;
    }

    /* ========== EVENTS ========== */

    event RoomCreated(address _owner, uint _roomNumberCounter, RoomType _roomType, GameType _gameType);
    event SignedUpInARoom(address _account, uint _roomNumber);
    event RoyaleStartedForRoom(uint _roomNumber, uint _playersNumber, uint _totalReward);
    event TookAPosition(address _user, uint _roomNumber, uint _round, uint _position);
    event RoundClosedInRoom(uint _roomNumber, uint _round, uint _result);
    event SplitBetweenLoosers(uint _roomNumber, uint _round, uint _numberOfPlayers);
    event RoyaleFinishedForRoom(uint _roomNumber, uint _numberOfWinners, uint _rewardPerWinner);
    event BuyIn(address _user, uint _amount, uint _roomNumber);
    event RewardClaimed(uint _roomNumber, address _winner, uint _reward);
    event NewAmountOfPlayersInOpenRoom(uint _roomNumber, uint _amuontOfPlayersinRoom);
    event NewPlayerAddedIntoRoom(uint _roomNumber, address _alowedPlayer);
    event NewPlayersAllowed(uint _roomNumber, uint _numberOfPlayers);
    event NewOracleKeySetForRoom(uint _roomNumber, bytes32 _oracleKey);
    event BuyInAmountChanged(uint _roomNumber, uint _buyInAmount);
    event NewRoundLength(uint _roomNumber, uint _roundLength);
    event NewRoundChoosingLength(uint _roomNumber, uint _roundChoosingLength);
    event NewRoomSignUpPeriod(uint _roomNumber, uint _signUpPeriod);
    event NewNumberOfRounds(uint _roomNumber, uint _numberRounds);
    event RoomDeleted(uint _roomNumber, address _roomOwner);
    event NewAssetAllowed(bytes32 _asset);
    event NewPriceFeed(IPriceFeed _priceFeed);
    event NewMinTimeSignUp(uint _minTimeSignUp);
    event NewMinRoundTime(uint _minRoundTime);
    event NewMinChooseTime(uint _minChooseTime);
    event NewOffsetBeteweenChooseAndEndRound(uint _offsetBeteweenChooseAndEndRound);
    event NewMaxPlayersInClosedRoom(uint _maxPlayersInClosedRoom);
    event NewMinBuyIn(uint _minBuyIn);
    event PullFunds(address _account, uint _amount);
    event NewSafeBoxPercentage(uint _safeBoxPercentage);
    event NewSafeBox(address _safeBox);
}

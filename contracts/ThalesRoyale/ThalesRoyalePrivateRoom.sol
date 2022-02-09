// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/Pausable.sol";
import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "../interfaces/IPriceFeed.sol";

contract ThalesRoyalePrivateRoom is Owned, Pausable {

    /* ========== LIBRARIES ========== */

    using SafeMath for uint;
    using SafeERC20 for IERC20;

    /* ========== ROOM TYPES ========== */

    enum GameType{LAST_MAN_STANDING, LIMITED_NUMBER_OF_ROUNDS}
    enum RoomType{OPEN, CLOSED}

    /* ========== ROOM VARIABLES ========== */

    mapping(uint => address) public roomOwner;
    mapping(uint => bytes32) public oracleKeyPerRoom;
    mapping(uint => uint) public roomCreationTime;
    mapping(uint => uint) public roomEndTime;
    mapping(uint => uint) public roomSignUpPeriod;
    mapping(uint => uint) public numberOfRoundsInRoom;
    mapping(uint => uint) public roundChoosingLengthInRoom;
    mapping(uint => uint) public climeTimePerRoom;
    mapping(uint => uint) public roundLengthInRoom;
    mapping(uint => uint) public currentRoundInRoom;
    mapping(uint => bool) public roomStarted;
    mapping(uint => bool) public roomFinished;
    mapping(uint => bool) public playerStartedSignUp;
    mapping(uint => RoomType) public roomTypePerRoom;
    mapping(uint => GameType) public gameTypeInRoom;
    mapping(uint => address[]) public alowedPlayersPerRoom;
    mapping(uint => address[]) public playersInRoom;
    mapping(uint => mapping(address => uint256)) public playerSignedUpPerRoom;
    mapping(uint => mapping(address => bool)) public playerCanPlayInRoom;
    mapping(uint => uint) public buyInPerPlayerRerRoom;
    mapping(uint => uint) public numberOfPlayersInRoom;
    mapping(uint => uint) public numberOfAlowedPlayersInRoom;

    mapping(uint => uint) public roundTargetPriceInRoom;

    mapping(uint => mapping(uint => uint)) public roundResultPerRoom;
    mapping(uint =>mapping(uint => uint)) public targetPricePerRoundPerRoom;
    mapping(uint => mapping(uint => uint)) public finalPricePerRoundPerRoom;
    mapping(uint =>mapping(uint => uint)) public totalPlayersInARoomInARound;
    mapping(uint => mapping(uint => uint)) public eliminatedPerRoundPerRoom;

    mapping(uint => uint) public roundStartTimeInRoom;
    mapping(uint => uint) public roundEndTimeInRoom;

    mapping(uint => mapping(uint256 => mapping(uint256 => uint256))) public positionsPerRoundPerRoom; 
    mapping(uint => mapping(address => mapping(uint256 => uint256))) public positionInARoundPerRoom;
    
    mapping(uint => uint) public rewardPerRoom;
    mapping(uint => uint) public rewardPerPlayerPerRoom;
    mapping(uint => mapping(address => bool)) public rewardCollectedPerRoom;

    /* ========== CONSTRAINT VARIABLES ========== */

    uint minTimeSignUp = 15 minutes;
    uint minRoundTime = 30 minutes;
    uint minChooseTime = 15 minutes;
    uint offsetBeteweenChooseAndEndRound = 15 minutes;
    uint minClaimTime = 24 hours;
    uint maxPlayersInClosedRoom = 10;
    uint minBuyIn = 1;

    string [] public allowedAssets = ["BTC", "ETH", "LINK", "SNX"];

    /* ========== STATE VARIABLES ========== */

    IERC20 public rewardToken;
    IPriceFeed public priceFeed;

    uint public roomNumberCounter;

    constructor(
        address _owner,
        IPriceFeed _priceFeed,
        address _rewardToken
    ) Owned(_owner) {
        priceFeed = _priceFeed;
        rewardToken = IERC20(_rewardToken);
    }

    /* ========== ROOM CREATION ========== */

    function createARoom(
        bytes32 _oracleKey,
        RoomType _roomType, 
        GameType _gameType, 
        address[] calldata _alowedPlayers,
        uint _buyInAmount,
        uint _amuontOfPlayersinRoom,
        uint _roomSignUpPeriod,
        uint _numberOfRoundsInRoom,
        uint _roundChoosingLength,
        uint _roundLength,
        uint _claimTime
        ) external {
        require(_buyInAmount >= minBuyIn, "Buy in must be greather then minimum");
        require(_roomSignUpPeriod >= minTimeSignUp, "Sign in period must be greather or equal then 15 min.");
        require(_numberOfRoundsInRoom > 1, "Must be more then one round");
        require(_roundChoosingLength >= minChooseTime, "Round chosing period must be more then 15min.");
        require(_roundLength >= minRoundTime, "Round length must be more then 30 min.");
        require(_claimTime >= minClaimTime, "Claim time must be more then one day.");
        require(_roundLength >= _roundChoosingLength + offsetBeteweenChooseAndEndRound, "Round length must be greather with minimum offset of 15min.");
        require((_roomType == RoomType.CLOSED && _alowedPlayers.length > 0 && _alowedPlayers.length < maxPlayersInClosedRoom) ||
                (_roomType == RoomType.OPEN && _amuontOfPlayersinRoom > 0), 
                "Room must be open and have total players in room or closed with allowed players");
        require(isAssetAllowed(_oracleKey), "Not allowed assets");
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
        climeTimePerRoom[roomNumberCounter] = _claimTime;
        roomTypePerRoom[roomNumberCounter] = _roomType;
        gameTypeInRoom[roomNumberCounter] = _gameType;
        oracleKeyPerRoom[roomNumberCounter] = _oracleKey;

        // set only if it closed 
        if(_roomType == RoomType.CLOSED){
            alowedPlayersPerRoom[roomNumberCounter] = _alowedPlayers;
            alowedPlayersPerRoom[roomNumberCounter].push(msg.sender);
            numberOfAlowedPlayersInRoom[roomNumberCounter] = alowedPlayersPerRoom[roomNumberCounter].length;

            for (uint i = 0; i < alowedPlayersPerRoom[roomNumberCounter].length; i++) {
                playerCanPlayInRoom[roomNumberCounter][alowedPlayersPerRoom[roomNumberCounter][i]] = true;
            }

        }else{
            numberOfAlowedPlayersInRoom[roomNumberCounter] = _amuontOfPlayersinRoom;
            playerCanPlayInRoom[roomNumberCounter][msg.sender] = true;
        }

        // adding amount
        buyInPerPlayerRerRoom[roomNumberCounter] = _buyInAmount;

        // first emit event for room creation
        emit RoomCreated(msg.sender, roomNumberCounter, _roomType, _gameType);

        // automaticlly sign up owner of a group as first player
        _signUpOwnerIntoRoom(msg.sender, roomNumberCounter);
    }

    /* ========== GAME ========== */

    function signUpForRoom(uint _roomNumber) external {
        require(roomNumberCounter >= _roomNumber, "No private room stil created!");
        require(block.timestamp < (roomCreationTime[_roomNumber] + roomSignUpPeriod[_roomNumber]), "Sign up period has expired");
        require(playerSignedUpPerRoom[_roomNumber][msg.sender] == 0, "Player already signed up, for this room.");
        require(
                (roomTypePerRoom[_roomNumber] == RoomType.CLOSED && isPlayerAllowed(msg.sender, _roomNumber)) ||
                (roomTypePerRoom[_roomNumber] == RoomType.OPEN && numberOfPlayersInRoom[_roomNumber] < numberOfAlowedPlayersInRoom[roomNumberCounter])
            , "Can not sign up for room, not allowed or it is full");
        require(rewardToken.allowance(msg.sender, address(this)) >= buyInPerPlayerRerRoom[_roomNumber], "No allowance.");

        numberOfPlayersInRoom[_roomNumber]++;
        playerSignedUpPerRoom[_roomNumber][msg.sender] = block.timestamp;
        playersInRoom[_roomNumber].push(msg.sender);
        if (roomTypePerRoom[_roomNumber] == RoomType.OPEN){
            playerCanPlayInRoom[_roomNumber][msg.sender] = true;
        }

        _buyIn(msg.sender, _roomNumber, buyInPerPlayerRerRoom[_roomNumber]);

        if(!playerStartedSignUp[_roomNumber]){
            playerStartedSignUp[_roomNumber] = true;
        }

        emit SignedUpInARoom(msg.sender, _roomNumber);
    }

    function startRoyaleInRoom(uint _roomNumber) external onlyRoomParticipantes(_roomNumber) {
        require(block.timestamp > (roomCreationTime[_roomNumber] + roomSignUpPeriod[_roomNumber]), "Can not start until signup period expires for that room");
        require(roomStarted[_roomNumber] == false, "Royale already started for that room");

        roundTargetPriceInRoom[_roomNumber] = priceFeed.rateForCurrency(oracleKeyPerRoom[_roomNumber]);
        targetPricePerRoundPerRoom[_roomNumber][1] = roundTargetPriceInRoom[_roomNumber];
        roomStarted[_roomNumber] = true;
        currentRoundInRoom[_roomNumber] = 1;
        roundStartTimeInRoom[_roomNumber] = block.timestamp;
        roundEndTimeInRoom[_roomNumber] = roundStartTimeInRoom[_roomNumber] + roundLengthInRoom[_roomNumber];
        totalPlayersInARoomInARound[_roomNumber][1] = numberOfPlayersInRoom[_roomNumber];

        emit RoyaleStartedForRoom(_roomNumber);
    }

    function takeAPositionInRoom(uint _roomNumber, uint _position) external onlyRoomParticipantes(_roomNumber) {
        require(_position == 1 || _position == 2, "Position can only be 1 or 2");
        require(roomStarted[_roomNumber], "Competition not started yet");
        require(!roomFinished[_roomNumber], "Competition finished");
        require(positionInARoundPerRoom[_roomNumber][msg.sender][currentRoundInRoom[_roomNumber]] != _position, "Same position");

         if (currentRoundInRoom[_roomNumber] != 1) {
            require(isPlayerAliveInASpecificRoom(msg.sender, _roomNumber), "Player no longer alive");
        }

        require(block.timestamp < roundStartTimeInRoom[_roomNumber] + roundChoosingLengthInRoom[_roomNumber], "Round positioning finished");

        // this block is when sender change positions in a round - first reduce
        if(positionInARoundPerRoom[_roomNumber][msg.sender][currentRoundInRoom[_roomNumber]] == 1){
            positionsPerRoundPerRoom[_roomNumber][currentRoundInRoom[_roomNumber]][1]--;
        }else if (positionInARoundPerRoom[_roomNumber][msg.sender][currentRoundInRoom[_roomNumber]] == 2) {
            positionsPerRoundPerRoom[_roomNumber][currentRoundInRoom[_roomNumber]][2]--;
        }

        // set new value
        positionInARoundPerRoom[_roomNumber][msg.sender][currentRoundInRoom[_roomNumber]] = _position;

        // add number of positions
        if(_position == 2){
            positionsPerRoundPerRoom[_roomNumber][currentRoundInRoom[_roomNumber]][_position]++;
        }else{
            positionsPerRoundPerRoom[_roomNumber][currentRoundInRoom[_roomNumber]][_position]++;
        }

        emit TookAPosition(msg.sender, _roomNumber, currentRoundInRoom[_roomNumber], _position);
    }

    function closeRound(uint _roomNumber) external onlyRoomParticipantes(_roomNumber){
        require(roomStarted[_roomNumber], "Competition not started yet");
        require(!roomFinished[_roomNumber], "Competition finished");
        require(block.timestamp > (roundStartTimeInRoom[_roomNumber] + roundLengthInRoom[_roomNumber]), "Can not close round yet");

        uint currentRound = currentRoundInRoom[_roomNumber];
        uint nextRound = currentRound + 1;

        // getting price
        uint currentPriceFromOracle = priceFeed.rateForCurrency(oracleKeyPerRoom[_roomNumber]);

        finalPricePerRoundPerRoom[_roomNumber][currentRound] = currentPriceFromOracle;
        roundResultPerRoom[_roomNumber][currentRound] = currentPriceFromOracle >= roundTargetPriceInRoom[_roomNumber] ? 2 : 1;
        roundTargetPriceInRoom[_roomNumber] = currentPriceFromOracle;

        uint winningPositionsPerRound = roundResultPerRoom[_roomNumber][currentRound] == 2 ? positionsPerRoundPerRoom[_roomNumber][currentRound][2] : positionsPerRoundPerRoom[_roomNumber][currentRound][1];

        if (nextRound <= numberOfRoundsInRoom[_roomNumber] || gameTypeInRoom[_roomNumber] == GameType.LAST_MAN_STANDING){
            // setting total players for next round (round + 1) to be result of position in a previous round
            totalPlayersInARoomInARound[_roomNumber][nextRound] = winningPositionsPerRound;
        }

        // setting eliminated players to be total players - number of winning players
        eliminatedPerRoundPerRoom[_roomNumber][currentRound] = totalPlayersInARoomInARound[_roomNumber][currentRound] - winningPositionsPerRound;   

        // if no one is left no need to set values
        if(winningPositionsPerRound > 0){
            currentRoundInRoom[_roomNumber] = nextRound;
            targetPricePerRoundPerRoom[_roomNumber][nextRound] = roundTargetPriceInRoom[_roomNumber];
        }

        // IF number of rounds is limmited and next round is crosses that limmit 
        // OR wiining people is less or eqal to 1 FINISH game (LAST_MAN_STANDING)
        if ((nextRound > numberOfRoundsInRoom[_roomNumber] && gameTypeInRoom[_roomNumber] == GameType.LIMITED_NUMBER_OF_ROUNDS)
                || (winningPositionsPerRound <= 1)) {

            roomFinished[_roomNumber] = true;

            // in no one is winner pick from lest round
            if (winningPositionsPerRound == 0) {
                _populateRewardForRoom(_roomNumber, totalPlayersInARoomInARound[_roomNumber][currentRound]);
                emit SplitBetweenLoosers(_roomNumber, currentRound, totalPlayersInARoomInARound[_roomNumber][currentRound]);
            } else{ 
                // there is min 1 winner
                _populateRewardForRoom(_roomNumber, winningPositionsPerRound);
            }

            roomEndTime[_roomNumber] = block.timestamp;
            // first close previous round then royale
            emit RoundClosedInRoom(_roomNumber, currentRound, roundResultPerRoom[_roomNumber][currentRound]);
            emit RoyaleFinishedForRoom(_roomNumber);
        } else {
            roundStartTimeInRoom[_roomNumber] = block.timestamp;
            roundEndTimeInRoom[_roomNumber] = roundStartTimeInRoom[_roomNumber] + roundLengthInRoom[_roomNumber];
            emit RoundClosedInRoom(_roomNumber, currentRound, roundResultPerRoom[_roomNumber][currentRound]);
        }
        
    }

    function claimRewardForRoom(uint _roomNumber) external onlyWinners(_roomNumber){
        require(rewardPerRoom[_roomNumber] > 0, "Reward must be set");
        require(rewardPerPlayerPerRoom[_roomNumber] > 0, "Reward per player must be more then zero");
        require(rewardCollectedPerRoom[_roomNumber][msg.sender] == false, "Player already collected reward");
        require(block.timestamp < (roomEndTime[_roomNumber] + climeTimePerRoom[_roomNumber]), "Time for reward claiming expired");

        // get balance 
        uint balance = rewardToken.balanceOf(address(this));
        
        if (balance != 0){

            // set collected -> true
            rewardCollectedPerRoom[_roomNumber][msg.sender] = true;
            
            // transfering rewardPerPlayer
            rewardToken.transfer(msg.sender, rewardPerPlayerPerRoom[_roomNumber]);

            // emit event
            emit RewardClaimed(_roomNumber, msg.sender, rewardPerPlayerPerRoom[_roomNumber]);
        }
    }

    /* ========== INTERNALS ========== */

    function _signUpOwnerIntoRoom(address _owner, uint _roomNumber) internal {
        
        numberOfPlayersInRoom[_roomNumber]++;
        playerSignedUpPerRoom[_roomNumber][_owner] = block.timestamp;
        playersInRoom[_roomNumber].push(_owner);

        _buyIn(_owner, _roomNumber ,buyInPerPlayerRerRoom[_roomNumber]);

        emit SignedUpInARoom(_owner, _roomNumber);

    }

    function _populateRewardForRoom(uint _roomNumber, uint _numberOfWinners) internal {
        require(roomFinished[_roomNumber], "Royale must be finished");
        require(_numberOfWinners > 0, "There is no alive players left in Royale");

        rewardPerPlayerPerRoom[_roomNumber] = rewardPerRoom[_roomNumber].div(_numberOfWinners);
    }

    function _buyIn(address _sender, uint _roomNumber, uint _amount) internal {

        rewardToken.transferFrom(_sender, address(this), _amount);
        rewardPerRoom[_roomNumber] += _amount;

        emit BuyIn(_sender, _amount, _roomNumber);
    }

    /* ========== PURE ========== */

    function stringToBytes32(string memory source) public pure returns (bytes32 result) {

        bytes memory tempEmptyStringTest = bytes(source);

        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }

        assembly {
            result := mload(add(source, 32))
        }
    }

    /* ========== VIEW ========== */

    function isAssetAllowed(bytes32 _oracleKey) public view returns (bool) {
        for (uint256 i = 0; i < allowedAssets.length; i++) {
            if(stringToBytes32(allowedAssets[i]) == _oracleKey){
                return true;
            }
        }
        return false;
    }

    function isPlayerAliveInASpecificRoom(address player, uint _roomNumber) public view returns (bool) {
        if (currentRoundInRoom[_roomNumber] > 1) {
            return (positionInARoundPerRoom[_roomNumber][player][currentRoundInRoom[_roomNumber] - 1] == roundResultPerRoom[_roomNumber][currentRoundInRoom[_roomNumber] - 1]);
        } else {
            return playerSignedUpPerRoom[_roomNumber][player] != 0;
        }
    }

    function isPlayerAllowed(address _player, uint _roomNumber) public view returns (bool) {
        return playerCanPlayInRoom[_roomNumber][_player];
    }

    function isPlayerOwner(address _player, uint _roomNumber) public view returns (bool) {
        return _player == roomOwner[_roomNumber];
    }

    /* ========== ROOM MANAGEMENT ========== */

    function setBuyInAmount(
        uint _roomNumber, 
        uint _buyInAmount
        ) public onlyOwnerOfRoom(_roomNumber) 
                canChangeRoomVariables(_roomNumber) {
                    
        require(_buyInAmount >= minBuyIn, "Buy in must be greather then minimum");
        require(buyInPerPlayerRerRoom[_roomNumber] - _buyInAmount == 0, "Same amount");
        require(playerStartedSignUp[_roomNumber], "Player already sign up for room, no change allowed");
        
        // if _buyInAmount is increased 
        if(_buyInAmount - buyInPerPlayerRerRoom[_roomNumber]  > 0){
            
            require(rewardToken.allowance(msg.sender, address(this)) >= _buyInAmount - buyInPerPlayerRerRoom[_roomNumber], "No allowance.");
            
            _buyIn(msg.sender, _roomNumber ,_buyInAmount - buyInPerPlayerRerRoom[_roomNumber]);
            buyInPerPlayerRerRoom[_roomNumber] = _buyInAmount;
        // or decreased
        }else{

            // get balance 
            uint balance = rewardToken.balanceOf(address(this));

            if (balance != 0){
                
                rewardPerRoom[_roomNumber]= rewardPerRoom[_roomNumber] - (buyInPerPlayerRerRoom[_roomNumber] - _buyInAmount);
                buyInPerPlayerRerRoom[_roomNumber] = _buyInAmount;
                rewardToken.transfer(msg.sender, buyInPerPlayerRerRoom[_roomNumber] - _buyInAmount);
            
            }
        }
    }

    function setRoundLength(
        uint _roomNumber, 
        uint _roundLength
        ) public onlyOwnerOfRoom(_roomNumber) 
                canChangeRoomVariables(_roomNumber) {
        require(_roundLength >= minRoundTime, "Round length must be more then 30 min.");
        require(_roundLength >= roundChoosingLengthInRoom[_roomNumber] + offsetBeteweenChooseAndEndRound, "Round length must be greather with minimum offset of 15min.");
        roundLengthInRoom[_roomNumber] = _roundLength;
    }

    function setClaimTimePerRoom(
        uint _roomNumber, 
        uint _claimTime
        ) public onlyOwnerOfRoom(_roomNumber) 
                canChangeRoomVariables(_roomNumber) {
        require(_claimTime >= minClaimTime, "Claim time must be more then one day.");
        climeTimePerRoom[_roomNumber] = _claimTime;
    }

    function setRoomSignUpPeriod(
        uint _roomNumber, 
        uint _roomSignUpPeriod
        ) public onlyOwnerOfRoom(_roomNumber) 
                canChangeRoomVariables(_roomNumber) {
        require(_roomSignUpPeriod >= minTimeSignUp, "Sign in period must be greather or equal then 15 min.");
        roomSignUpPeriod[_roomNumber] = _roomSignUpPeriod;
    }

    function setNumberOfRoundsInRoom(
        uint _roomNumber, 
        uint _numberOfRoundsInRoom
        ) public onlyOwnerOfRoom(_roomNumber) 
                canChangeRoomVariables(_roomNumber) {
        require(_numberOfRoundsInRoom > 1, "Must be more then one round");
        numberOfRoundsInRoom[_roomNumber] = _numberOfRoundsInRoom;
    }

    function setRoundChoosingLength(
        uint _roomNumber, 
        uint _roundChoosingLength
        ) public onlyOwnerOfRoom(_roomNumber) 
                canChangeRoomVariables(_roomNumber) {
        require(_roundChoosingLength >= minChooseTime, "Round chosing period must be more then 15min.");
        require(roundLengthInRoom[_roomNumber] >= _roundChoosingLength + offsetBeteweenChooseAndEndRound, "Round length must be greather with minimum offset of 15min.");
        roundChoosingLengthInRoom[_roomNumber] = _roundChoosingLength;
    }

    function setRoundChoosingLengthPerRoom(
        uint _roomNumber, 
        uint _roundChoosingLength
        ) public onlyOwnerOfRoom(_roomNumber) 
                canChangeRoomVariables(_roomNumber) {
        require(_roundChoosingLength >= minChooseTime, "Round chosing period must be more then 15min.");
        require(roundLengthInRoom[_roomNumber] >= _roundChoosingLength + offsetBeteweenChooseAndEndRound, "Round choosing length is more or less then minimal from round length");
        roundChoosingLengthInRoom[_roomNumber] = _roundChoosingLength;
    }

    function setOracleKey(
        uint _roomNumber, 
        bytes32 _oracleKey
        ) public onlyOwnerOfRoom(_roomNumber) 
                canChangeRoomVariables(_roomNumber) {
        require(isAssetAllowed(_oracleKey), "Not allowed assets");
        oracleKeyPerRoom[_roomNumber] = _oracleKey;

    }

    function setAlowedPlayersPerRoomClosedRoom(
        uint _roomNumber, 
        address[] memory _alowedPlayers
        ) public onlyOwnerOfRoom(_roomNumber) 
                canChangeRoomVariables(_roomNumber) {

        alowedPlayersPerRoom[_roomNumber] = _alowedPlayers;
        numberOfAlowedPlayersInRoom[_roomNumber] = _alowedPlayers.length;
    }

    function setAmuontOfPlayersinOpenRoom(
        uint _roomNumber, 
        uint _amuontOfPlayersinRoom
        ) public onlyOwnerOfRoom(_roomNumber) 
                canChangeRoomVariables(_roomNumber) {
        require(roomTypePerRoom[_roomNumber] == RoomType.OPEN);
        numberOfAlowedPlayersInRoom[_roomNumber] = _amuontOfPlayersinRoom;
    }

    /* ========== CONTRACT MANAGEMENT ========== */

    function addAsset(string memory asset) public onlyOwner {
        allowedAssets.push(asset);
    }

    function setPriceFeed(IPriceFeed _priceFeed) public onlyOwner {
        priceFeed = _priceFeed;
    }

    function setMinTimeSignUp(uint _minTimeSignUp) public onlyOwner {
        minTimeSignUp = _minTimeSignUp;
    }

    function setMinRoundTime(uint _minRoundTime) public onlyOwner {
        minRoundTime = _minRoundTime;
    }

    function setMinChooseTime(uint _minChooseTime) public onlyOwner {
        minChooseTime = _minChooseTime;
    }

    function setOffsetBeteweenChooseAndEndRound(uint _offsetBeteweenChooseAndEndRound) public onlyOwner {
        offsetBeteweenChooseAndEndRound = _offsetBeteweenChooseAndEndRound;
    }

    function setMinClaimTime(uint _minClaimTime) public onlyOwner {
        minClaimTime = _minClaimTime;
    }

    function setMaxPlayersInClosedRoom(uint _maxPlayersInClosedRoom) public onlyOwner {
        maxPlayersInClosedRoom = _maxPlayersInClosedRoom;
    }

    function setMinBuyIn(uint _minBuyIn) public onlyOwner {
        minBuyIn = _minBuyIn;
    }

    /* ========== MODIFIERS ========== */

    modifier canChangeRoomVariables(uint _roomNumber) {
        require(!roomStarted[_roomNumber], "Competition is started, can not change");
        require(!roomFinished[_roomNumber], "Competition is finished, can not change");
        _;
    }

    modifier onlyOwnerOfRoom(uint _roomNumber) {
        require(msg.sender == roomOwner[_roomNumber], "You are not owner of room.");
        _;
    }

    modifier onlyRoomParticipantes(uint _roomNumber) {
        require(playerSignedUpPerRoom[_roomNumber][msg.sender] != 0 , "You are not room participante");
        _;
    }

    modifier onlyWinners (uint _roomNumber) {
        require(roomFinished[_roomNumber], "Royale must be finished!");
        require(isPlayerAliveInASpecificRoom(msg.sender, _roomNumber) == true, "Player is not alive");
        _;
    }

    /* ========== EVENTS ========== */

    event RoomCreated(address _owner, uint _roomNumberCounter, RoomType _roomType, GameType _gameType);
    event SignedUpInARoom(address _account, uint _roomNumber);
    event RoyaleStartedForRoom(uint _roomNumber);
    event TookAPosition(address _user, uint _roomNumber, uint _round, uint _position);
    event RoundClosedInRoom(uint _roomNumber, uint _round, uint _result);
    event SplitBetweenLoosers(uint _roomNumber, uint _round, uint _numberOfPlayers);
    event RoyaleFinishedForRoom(uint _roomNumber);
    event BuyIn(address _user, uint _amount, uint _roomNumber);
    event RewardClaimed(uint _roomNumber, address _winner, uint _reward);

}

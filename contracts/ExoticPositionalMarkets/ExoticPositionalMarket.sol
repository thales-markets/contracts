pragma solidity ^0.8.0;

// import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";

contract ExoticPositionalMarket is Initializable, ProxyOwned {
    using SafeMath for uint;

    struct Position {
        bytes32 phrase;
        uint position;
        uint amount;
    }

    struct User {
        address account;
        uint position;
        uint amount;
    }

    enum TicketType{ FIXED_TICKET_PRICE, FLEXIBLE_BID }
    uint constant HUNDRED = 100;

    uint public creationTime;
    bool public disputed;
    bool public outcomeUpdated;

    // from init
    bytes32 public marketQuestion;
    Position[] public positions;
    uint public endOfPositioning;
    uint public marketMaturity;
    TicketType public ticketType;
    uint public fixedTicketPrice;
    bool public withdrawalAllowed;
    uint public withdrawalFeePercentage;
    uint public tag;
    


    function initializeWithTwoParameters(
        bytes32 _marketQuestion, 
        uint _endOfPositioning,
        uint _marketMaturity,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _tag,
        bytes32 _phrase1,
        bytes32 _phrase2
    ) external initializer {
        setOwner(msg.sender);
        _initializeWithTwoParameters(
            _marketQuestion, 
            _endOfPositioning,
            _marketMaturity,
            _fixedTicketPrice,
            _withdrawalFeePercentage,
            _tag,
            _phrase1,
            _phrase2
        );
    }

    function initializeWithThreeParameters(
        bytes32 _marketQuestion, 
        uint _endOfPositioning,
        uint _marketMaturity,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _tag,
        bytes32 _phrase1,
        bytes32 _phrase2,
        bytes32 _phrase3
    ) external initializer {
        setOwner(msg.sender);
        _initializeWithTwoParameters(
            _marketQuestion, 
            _endOfPositioning,
            _marketMaturity,
            _fixedTicketPrice,
            _withdrawalFeePercentage,
            _tag,
            _phrase1,
            _phrase2
        );
        _addPosition(_phrase3);
    }

    function initializeWithFourParameters(
        bytes32 _marketQuestion, 
        uint _endOfPositioning,
        uint _marketMaturity,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _tag,
        bytes32 _phrase1,
        bytes32 _phrase2,
        bytes32 _phrase3,
        bytes32 _phrase4
    ) external initializer {
        setOwner(msg.sender);
        _initializeWithTwoParameters(
            _marketQuestion, 
            _endOfPositioning,
            _marketMaturity,
            _fixedTicketPrice,
            _withdrawalFeePercentage,
            _tag,
            _phrase1,
            _phrase2
        );
        _addPosition(_phrase3);
        _addPosition(_phrase4);
    }

    function initializeWithFiveParameters(
        bytes32 _marketQuestion, 
        uint _endOfPositioning,
        uint _marketMaturity,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _tag,
        bytes32 _phrase1,
        bytes32 _phrase2,
        bytes32 _phrase3,
        bytes32 _phrase4,
        bytes32 _phrase5
    ) external initializer {
        setOwner(msg.sender);
        _initializeWithTwoParameters(
            _marketQuestion, 
            _endOfPositioning,
            _marketMaturity,
            _fixedTicketPrice,
            _withdrawalFeePercentage,
            _tag,
            _phrase1,
            _phrase2
        );
        _addPosition(_phrase3);
        _addPosition(_phrase4);
        _addPosition(_phrase5);
    }

    // market resolved only through the Manager
    function resolveMarket(uint _outcomePosition) external onlyOwner{
        require(canResolveMarket(), "Market can not be resolved");
        require(_outcomePosition < positions.length, "Outcome position exeeds the position");

        if(ticketType == TicketType.FIXED_TICKET_PRICE) {
            // _resolveFixedPrice(_outcomePosition);
        }
        else{
            // _resolveFlexibleBid(_outcomePosition);
        }

    }

    // to be used within the Manager
    function chooseDefaultPosition(uint position, address account) external onlyOwner{
        require(position < positions.length, "Default position exceeds number of positions");
        require(block.timestamp <= creationTime.add(endOfPositioning), "Positioning time finished");
    }


    function takeAPosition(uint position) external {
        require(position < positions.length, "Default position exceeds number of positions");
        require(canPlacePosition(), "Positioning time finished");
        if(ticketType == TicketType.FIXED_TICKET_PRICE) {
            // _resolveFixedPrice(_outcomePosition);
        }
        else{
            // _resolveFlexibleBid(_outcomePosition);
        }
    }

    function openDispute(uint _disputeCode) external {
        require(isMarketCreated(), "Market not created");
        //
        // CODE TO BE ADDED
        //
        disputed = true;
        emit MarketDisputed(true);
    }
    // VIEWS
    function isMarketCreated() public view returns (bool) {
        return creationTime > 0;
    }

    function canResolveMarket() public view returns (bool) {
        return block.timestamp >= creationTime.add(marketMaturity) && creationTime > 0 && disputed;
    }
    function canPlacePosition() public view returns (bool) {
        return block.timestamp <= creationTime.add(endOfPositioning) && creationTime > 0;
    }

    function getPosition(uint index) public view returns (bytes32) {
        if(index < positions.length) {
            return positions[index].phrase;
        }
        else {
            return 0;
        }
    }

    function getAllPositions() public view returns (bytes32[] memory) {
        bytes32[] memory positionPhrases = new bytes32[](positions.length);
        for(uint i=0; i<positions.length; i++) {
            positionPhrases[i] = positions[i].phrase;
        }
        return positionPhrases;
    }
    
    // INTERNAL FUNCTIONS

    function _initializeWithTwoParameters(
        bytes32 _marketQuestion, 
        uint _endOfPositioning,
        uint _marketMaturity,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _tag,
        bytes32 _phrase1,
        bytes32 _phrase2
    ) internal {
        creationTime = block.timestamp;
        marketQuestion = _marketQuestion;
        endOfPositioning = _endOfPositioning;
        marketMaturity = _marketMaturity;
        // Ticket Type can be determined based on ticket price
        ticketType = _fixedTicketPrice > 0 ? TicketType.FIXED_TICKET_PRICE : TicketType.FLEXIBLE_BID;
        fixedTicketPrice = _fixedTicketPrice;
        // Withdrawal allowance determined based on withdrawal percentage, if it is over 100% then it is forbidden
        withdrawalAllowed = _withdrawalFeePercentage < HUNDRED ? true : false;
        withdrawalFeePercentage = _withdrawalFeePercentage;
        // The tag is just a number for now
        tag = _tag;
        _addPosition(_phrase1);
        _addPosition(_phrase2);
    }


    function _addPosition(bytes32 _position) internal {
        positions.push(Position(_position, positions.length, 0));
    }
 
    event MarketDisputed(bool _disputed);

}
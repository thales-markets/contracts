pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "@openzeppelin/upgrades-core/contracts/Initializable.sol";

contract ExoticPositionalMarket is Ownable {
    using SafeMath for uint;

    struct Position {
        bytes32 phrase;
        uint position;
    }
    enum TicketType{ FIXED_TICKET_PRICE, FLEXIBLE_BID }
    uint constant HUNDRED = 100;
    bool private _initialized;

    bytes32 public marketQuestion;
    Position[] public positions;
    uint public endOfPositioning;
    uint public marketMaturityDate;
    TicketType public ticketType;
    uint public fixedTicketPrice;
    bool public withdrawalAllowed;
    uint public withdrawalFeePercentage;
    uint public tag;


    function initializeWithTwoParameters(
        bytes32 marketQuestion, 
        bytes32 phrase1,
        bytes32 phrase2,
        uint endOfPositioning,
        uint marketMaturityDate,
        uint fixedTicketPrice,
        uint withdrawalFeePercentage,
        uint defaultPosition,
        uint tag
    ) external initializer {
        _initializeWithTwoParameters(
            marketQuestion, 
            phrase1,
            phrase2,
            endOfPositioning,
            marketMaturityDate,
            fixedTicketPrice,
            withdrawalFeePercentage,
            tag
        );
        chooseDefaultPosition(defaultPosition, msg.sender);
    }

    function initializeWithThreeParameters(
        bytes32 marketQuestion, 
        bytes32 phrase1,
        bytes32 phrase2,
        bytes32 phrase3,
        uint endOfPositioning,
        uint marketMaturityDate,
        uint fixedTicketPrice,
        uint withdrawalFeePercentage,
        uint defaultPosition,
        uint tag
    ) external initializer {
        _initializeWithTwoParameters(
            marketQuestion, 
            phrase1,
            phrase2,
            endOfPositioning,
            marketMaturityDate,
            fixedTicketPrice,
            withdrawalFeePercentage,
            tag
        );
        _addPosition(_phrase3);
        chooseDefaultPosition(defaultPosition, msg.sender);
    }

    function initializeWithFourParameters(
        bytes32 marketQuestion, 
        bytes32 phrase1,
        bytes32 phrase2,
        bytes32 phrase3,
        bytes32 phrase4,
        uint endOfPositioning,
        uint marketMaturityDate,
        uint fixedTicketPrice,
        uint withdrawalFeePercentage,
        uint defaultPosition,
        uint tag
    ) external initializer {
        _initializeWithTwoParameters(
            marketQuestion, 
            phrase1,
            phrase2,
            endOfPositioning,
            marketMaturityDate,
            fixedTicketPrice,
            withdrawalFeePercentage,
            tag
        );
        _addPosition(_phrase3);
        _addPosition(_phrase4);
        chooseDefaultPosition(defaultPosition, msg.sender);
    }

    function initializeWithFiveParameters(
        bytes32 marketQuestion, 
        bytes32 phrase1,
        bytes32 phrase2,
        bytes32 phrase3,
        bytes32 phrase4,
        bytes32 phrase5,
        uint endOfPositioning,
        uint marketMaturityDate,
        uint fixedTicketPrice,
        uint withdrawalFeePercentage,
        uint defaultPosition,
        uint tag
    ) external initializer {
        _initializeWithTwoParameters(
            marketQuestion, 
            phrase1,
            phrase2,
            endOfPositioning,
            marketMaturityDate,
            fixedTicketPrice,
            withdrawalFeePercentage,
            tag
        );
        _addPosition(_phrase3);
        _addPosition(_phrase4);
        _addPosition(_phrase5);
        chooseDefaultPosition(defaultPosition, msg.sender);
    }

    
    
    function _initializeWithTwoParameters(
        bytes32 _marketQuestion, 
        bytes32 _phrase1,
        bytes32 _phrase2,
        uint _endOfPositioning,
        uint _marketMaturityDate,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _tag
    ) internal {
        require(_endOfPositioning >= now.add(1 hours), "Posiitioning period too low. Minimum 1 hour");
        require(_marketMaturityDate >= now.add(2 hours), "Posiitioning period too low. Minimum 1 hour");
        // Ticket Type can be determined based on ticket price
        ticketType = _fixedTicketPrice > 0 ? TicketType.FIXED_TICKET_PRICE : TicketType.FLEXIBLE_BID;
        fixedTicketPrice = _fixedTicketPrice;
        // Withdrawal allowance determined based on withdrawal percentage, if it is over 100% then it is forbidden
        withdrawalAllowed = _withdrawalFeePercentage < HUNDRED ? true : false;
        withdrawalFeePercentage = _withdrawalFeePercentage;
        marketQuestion = _marketQuestion;
        // The tag is just a number for now
        tag = _tag;
        _addPosition(_phrase1);
        _addPosition(_phrase2);
    }

    function chooseDefaultPosition(uint position, address account) public {
        require(position < positions.length, "Default position exceeds number of positions");
    }

    function _addPosition(bytes32 _position) internal {
        Position newPosition = new Position(_position, positions.length);
        positions.push(newPosition);
    }
 
}
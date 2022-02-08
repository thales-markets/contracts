pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract ExoticPositionalMarket is Initializable, Ownable {
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
        bytes32 _marketQuestion, 
        bytes32 _phrase1,
        bytes32 _phrase2,
        uint _endOfPositioning,
        uint _marketMaturityDate,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _defaultPosition,
        uint _tag
    ) external initializer {
        _initializeWithTwoParameters(
            _marketQuestion, 
            _phrase1,
            _phrase2,
            _endOfPositioning,
            _marketMaturityDate,
            _fixedTicketPrice,
            _withdrawalFeePercentage,
            _tag
        );
        chooseDefaultPosition(_defaultPosition, msg.sender);
    }

    function initializeWithThreeParameters(
        bytes32 _marketQuestion, 
        bytes32 _phrase1,
        bytes32 _phrase2,
        bytes32 _phrase3,
        uint _endOfPositioning,
        uint _marketMaturityDate,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _defaultPosition,
        uint _tag
    ) external initializer {
        _initializeWithTwoParameters(
            _marketQuestion, 
            _phrase1,
            _phrase2,
            _endOfPositioning,
            _marketMaturityDate,
            _fixedTicketPrice,
            _withdrawalFeePercentage,
            _tag
        );
        _addPosition(_phrase3);
        chooseDefaultPosition(_defaultPosition, msg.sender);
    }

    function initializeWithFourParameters(
        bytes32 _marketQuestion, 
        bytes32 _phrase1,
        bytes32 _phrase2,
        bytes32 _phrase3,
        bytes32 _phrase4,
        uint _endOfPositioning,
        uint _marketMaturityDate,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _defaultPosition,
        uint _tag
    ) external initializer {
        _initializeWithTwoParameters(
            _marketQuestion, 
            _phrase1,
            _phrase2,
            _endOfPositioning,
            _marketMaturityDate,
            _fixedTicketPrice,
            _withdrawalFeePercentage,
            _tag
        );
        _addPosition(_phrase3);
        _addPosition(_phrase4);
        chooseDefaultPosition(_defaultPosition, msg.sender);
    }

    function initializeWithFiveParameters(
        bytes32 _marketQuestion, 
        bytes32 _phrase1,
        bytes32 _phrase2,
        bytes32 _phrase3,
        bytes32 _phrase4,
        bytes32 _phrase5,
        uint _endOfPositioning,
        uint _marketMaturityDate,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _defaultPosition,
        uint _tag
    ) external initializer {
        _initializeWithTwoParameters(
            _marketQuestion, 
            _phrase1,
            _phrase2,
            _endOfPositioning,
            _marketMaturityDate,
            _fixedTicketPrice,
            _withdrawalFeePercentage,
            _tag
        );
        _addPosition(_phrase3);
        _addPosition(_phrase4);
        _addPosition(_phrase5);
        chooseDefaultPosition(_defaultPosition, msg.sender);
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
        require(_endOfPositioning >= block.timestamp.add(1 hours), "Posiitioning period too low. Minimum 1 hour");
        require(_marketMaturityDate >= block.timestamp.add(2 hours), "Posiitioning period too low. Minimum 1 hour");
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
        positions.push(Position(_position, positions.length));
    }
 
}
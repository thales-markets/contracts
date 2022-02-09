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
        uint _endOfPositioning,
        uint _marketMaturityDate,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _tag,
        bytes32 _phrase1,
        bytes32 _phrase2
    ) external initializer {
        _initializeWithTwoParameters(
            _marketQuestion, 
            _endOfPositioning,
            _marketMaturityDate,
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
        uint _marketMaturityDate,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _tag,
        bytes32 _phrase1,
        bytes32 _phrase2,
        bytes32 _phrase3
    ) external initializer {
        _initializeWithTwoParameters(
            _marketQuestion, 
            _endOfPositioning,
            _marketMaturityDate,
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
        uint _marketMaturityDate,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _tag,
        bytes32 _phrase1,
        bytes32 _phrase2,
        bytes32 _phrase3,
        bytes32 _phrase4
    ) external initializer {
        _initializeWithTwoParameters(
            _marketQuestion, 
            _endOfPositioning,
            _marketMaturityDate,
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
        uint _marketMaturityDate,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _tag,
        bytes32 _phrase1,
        bytes32 _phrase2,
        bytes32 _phrase3,
        bytes32 _phrase4,
        bytes32 _phrase5
    ) external initializer {
        _initializeWithTwoParameters(
            _marketQuestion, 
            _endOfPositioning,
            _marketMaturityDate,
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

    // to be used within the Manager
    function chooseDefaultPosition(uint position, address account) external {
        require(position < positions.length, "Default position exceeds number of positions");
    }
    
    function _initializeWithTwoParameters(
        bytes32 _marketQuestion, 
        uint _endOfPositioning,
        uint _marketMaturityDate,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _tag,
        bytes32 _phrase1,
        bytes32 _phrase2
    ) internal {
        marketQuestion = _marketQuestion;
        endOfPositioning = _endOfPositioning;
        marketMaturityDate = _marketMaturityDate;
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
        positions.push(Position(_position, positions.length));
    }
 
}
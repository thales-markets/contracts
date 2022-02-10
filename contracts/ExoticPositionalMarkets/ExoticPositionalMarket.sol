pragma solidity ^0.8.0;

// import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";

contract ExoticPositionalMarket is Initializable, ProxyOwned {
    using SafeMath for uint;

    // struct Position {
    //     bytes32 phrase;
    //     uint position;
    //     uint amount;
    // }

    // struct User {
    //     address account;
    //     uint position;
    //     uint amount;
    // }

    enum TicketType{ FIXED_TICKET_PRICE, FLEXIBLE_BID }
    uint constant HUNDRED = 100;

    uint public creationTime;
    bool public disputed;
    bool public outcomeUpdated;

    // from init
    bytes32 public marketQuestion;
    // Position[] public positions;
    uint public positionCount;
    mapping(uint => bytes32) public positionPhrase;
    uint public endOfPositioning;
    uint public marketMaturity;
    TicketType public ticketType;
    uint public fixedTicketPrice;
    bool public withdrawalAllowed;
    uint public withdrawalFeePercentage;
    uint public tag;
    IERC20 public paymentToken;
    
    //stats
    uint public totalTicketHolders;
    mapping(uint => uint) public ticketsPerPosition;
    mapping(address => uint) public ticketHolder;


    function initializeWithTwoParameters(
        bytes32 _marketQuestion, 
        uint _endOfPositioning,
        uint _marketMaturity,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _tag,
        address _paymentToken,
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
            _paymentToken,
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
        address _paymentToken,
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
            _paymentToken,
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
        address _paymentToken,
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
            _paymentToken,
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
        address _paymentToken,
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
            _paymentToken,
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
        require(_outcomePosition < positionCount, "Outcome position exeeds the position");

        if(ticketType == TicketType.FIXED_TICKET_PRICE) {
            // _resolveFixedPrice(_outcomePosition);
        }
        else{
            // _resolveFlexibleBid(_outcomePosition);
        }

    }

    // to be used within the Manager
    function chooseDefaultPosition(uint position, address account) external onlyOwner{
        require(_position > 0, "Position can not be zero. Non-zero position expected");
        require(_position <= positionCount, "Position exceeds number of positions");
        require(block.timestamp <= creationTime.add(endOfPositioning), "Positioning time finished");
    }


    function takeAPosition(uint _position) external {
        require(_position > 0, "Position can not be zero. Non-zero position expected");
        require(_position <= positionCount, "Position exceeds number of positions");
        require(canPlacePosition(), "Positioning time finished");
        require(paymentToken.allowance(msg.sender, address(this)) >=  fixedTicketPrice, "No allowance. Please approve ticket price allowance");
        if(ticketType == TicketType.FIXED_TICKET_PRICE) {
            // _resolveFixedPrice(_outcomePosition);
            paymentToken.transferFrom(msg.sender, address(this), fixedTicketPrice);
            totalTicketHolders = totalTicketHolders.add(1);
            ticketsPerPosition[_position] = ticketsPerPosition[_position].add(1);
            ticketHolder[msg.sender] = _position;
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
    
    function getPositionPhrase(uint index) public view returns (bytes32) {
        return (index <= positionCount && index > 0) ? positionPhrase[index] : "";
    }

    function getAllPositions() public view returns (bytes32[] memory) {
        bytes32[] memory positionPhrases_ = new bytes32[](positionCount);
        for(uint i=1; i <= positionCount; i++) {
            positionPhrases_[i] = positionPhrase[i];
        }
        return positionPhrases_;
    }

    function getTicketHolderPosition(address _account) public view returns (uint) {
        return ticketHolder[_account];
    }
    function getTicketHolderPositionPhrase(address _account) public view returns (uint) {
       return (ticketHolder[_account] > 0) ? positionPhrase[ticketHolder[_account]] : "";
    }

    
    // INTERNAL FUNCTIONS

    function _initializeWithTwoParameters(
        bytes32 _marketQuestion, 
        uint _endOfPositioning,
        uint _marketMaturity,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _tag,
        address _paymentToken,
        bytes32 _phrase1,
        bytes32 _phrase2
    ) internal {
        creationTime = block.timestamp;
        marketQuestion = _marketQuestion;
        endOfPositioning = _endOfPositioning;
        marketMaturity = _marketMaturity;
        paymentToken = IERC20(_paymentToken);
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
        require(_position != "" || _position != " ", "Invalid phrase. Please assign non-zero position");
        positionCount = positionCount.add(1);
        positionPhrase[positionCount] = _position;
    }
 
    event MarketDisputed(bool _disputed);

}
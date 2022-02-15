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

    enum TicketType {FIXED_TICKET_PRICE, FLEXIBLE_BID}

    uint private constant HUNDRED = 100;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant HUNDRED_PERCENT = 1e18;
    uint private constant FIXED_BOND_AMOUNT = 100 * 1e18;
    uint public constant safeBoxPercentage = 1;
    uint public constant creatorPercentage = 1;
    uint public constant resolverPercentage = 1;

    uint public creationTime;
    bool public disputed;
    bool public outcomeUpdated;

    // from init
    string public marketQuestion;
    // Position[] public positions;
    uint public positionCount;
    mapping(uint => string) public positionPhrase;
    uint public endOfPositioning;
    uint public marketMaturity;
    TicketType public ticketType;
    uint public fixedTicketPrice;
    bool public withdrawalAllowed;
    uint public withdrawalFeePercentage;
    uint[] public tag;
    IERC20 public paymentToken;
    address public creatorAddress;
    address public councilAddress;
    address public resolverAddress;

    //stats
    uint public totalTicketHolders;
    mapping(uint => uint) public ticketsPerPosition;
    mapping(address => uint) public ticketHolder;
    bool public resolved;
    bool public finalized;
    uint public winningPosition;
    uint public claimableTicketsCount;

    function initialize(
        address _creatorAddress,
        string memory _marketQuestion,
        uint _endOfPositioning,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint[] memory _tag,
        address _paymentToken,
        string[] memory _phrases,
        address _councilAddress
    ) external initializer {
        require(_phrases.length >= 2 && _phrases.length <= 5, "Invalid number of provided positions");
        setOwner(msg.sender);
        setOracleCouncilAddress(_councilAddress);

        _initializeWithTwoParameters(
            _creatorAddress,
            _marketQuestion,
            _endOfPositioning,
            _fixedTicketPrice,
            _withdrawalFeePercentage,
            _tag,
            _paymentToken,
            _phrases[0],
            _phrases[1]
        );
        if (_phrases.length > 2) {
            for (uint i = 2; i < _phrases.length; i++) {
                _addPosition(_phrases[i]);
            }
        }
    }

    function setOracleCouncilAddress(address _councilAddress) public onlyOwner {
        require(_councilAddress != address(0), "Invalid council address");
        councilAddress = _councilAddress;
    }

    // market resolved only through the Manager
    function resolveMarket(uint _outcomePosition) external onlyOwner{
        require(canMarketBeResolved(), "Market can not be resolved. It is disputed/not matured/resolved");
        require(_outcomePosition < positionCount, "Outcome position exeeds the position");
        if (msg.sender != creatorAddress) {
            require(
                paymentToken.allowance(msg.sender, address(this)) >= FIXED_BOND_AMOUNT,
                "No allowance. Please adjust the allowance for fixed bond"
            );
            paymentToken.transferFrom(msg.sender, address(this), FIXED_BOND_AMOUNT);
        }
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            winningPosition = _outcomePosition;
            claimableTicketsCount = ticketsPerPosition[_outcomePosition];
            resolved = true;
            resolverAddress = msg.sender;
            emit MarketResolved(_outcomePosition, msg.sender);
        } else {
            // _resolveFlexibleBid(_outcomePosition);
        }
    }

    function takeAPosition(uint _position) external {
        require(_position > 0, "Position can not be zero. Non-zero position expected");
        require(_position <= positionCount, "Position exceeds number of positions");
        require(canUsersPlacePosition(), "Not able to position. Positioning time finished or market resolved");
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            if (getTicketHolderPosition(msg.sender) == 0) {
                require(
                    paymentToken.allowance(msg.sender, address(this)) >= fixedTicketPrice,
                    "No allowance. Please approve ticket price allowance"
                );
                paymentToken.transferFrom(msg.sender, address(this), fixedTicketPrice);
                totalTicketHolders = totalTicketHolders.add(1);
            } else {
                ticketsPerPosition[getTicketHolderPosition(msg.sender)] = ticketsPerPosition[
                    getTicketHolderPosition(msg.sender)
                ]
                    .sub(1);
            }
            ticketsPerPosition[_position] = ticketsPerPosition[_position].add(1);
            ticketHolder[msg.sender] = _position;
        } else {
            // _resolveFlexibleBid(_outcomePosition);
        }
    }

    function claimWinningTicket() external {
        require(finalized, "Market not finalized");
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            uint amount = getTicketHolderClaimableAmount(msg.sender);
            if (amount > 0) {
                claimableTicketsCount = claimableTicketsCount.sub(1);
                paymentToken.transfer(msg.sender, amount);
                emit WinningTicketClaimed(msg.sender, amount);
            }
        } else {
            // _resolveFlexibleBid(_outcomePosition);
        }
    }

    function claimToSafeBox(address _safeBox) external onlyOwner {
        require(resolved, "Market not resolved");
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            paymentToken.transfer(_safeBox, getSafeBoxAmount());
            emit TransferredToSafeBox(_safeBox, getSafeBoxAmount());
        } else {
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

    function canUsersPlacePosition() public view returns (bool) {
        return block.timestamp <= creationTime.add(endOfPositioning) && creationTime > 0 && !resolved;
    }

    function canMarketBeResolved() public view returns (bool) {
        return block.timestamp >= creationTime.add(endOfPositioning) && creationTime > 0 && (!disputed) && !resolved;
    }

    function canMarketBeFinished() public view returns (bool) {
        return resolved && (!disputed);
    }

    function getPositionPhrase(uint index) public view returns (string memory) {
        return (index <= positionCount && index > 0) ? positionPhrase[index] : string("");
    }

    function getTicketHolderPosition(address _account) public view returns (uint) {
        return ticketHolder[_account];
    }

    function getTicketHolderPositionPhrase(address _account) public view returns (string memory) {
        return (ticketHolder[_account] > 0) ? positionPhrase[ticketHolder[_account]] : string("");
    }

    function getWinningAmountPerTicket() public view returns (uint) {
        if (totalTicketHolders == 0) {
            return 0;
        }
        if ((finalized || resolved) && winningPosition == 0) {
            return fixedTicketPrice;
        } else {
            return getTotalClaimableAmount().div(ticketsPerPosition[winningPosition]);
        }
    }

    function getTicketHolderClaimableAmount(address _account) public view returns (uint) {
        uint amount = 0;
        amount = (ticketHolder[_account] > 0 && (ticketHolder[_account] == winningPosition || winningPosition == 0))
            ? getWinningAmountPerTicket()
            : 0;
        if (_account == creatorAddress) {
            amount = amount.add(getAdditionalCreatorAmount());
        }
        if (_account == resolverAddress) {
            amount = amount.add(getAdditionalResolverAmount());
        }
        return amount;
    }

    function getAlreadyClaimedTickets() public view returns (uint) {
        return finalized ? ticketsPerPosition[winningPosition].sub(claimableTicketsCount) : 0;
    }

    function getTotalPlacedAmount() public view returns (uint) {
        return fixedTicketPrice.mul(totalTicketHolders);
    }

    function applyDeduction(uint value) internal pure returns (uint) {
        return
            (value).mul(HUNDRED.sub(safeBoxPercentage.add(creatorPercentage).add(resolverPercentage))).mul(ONE_PERCENT).div(
                HUNDRED_PERCENT
            );
    }

    function getTotalClaimableAmount() public view returns (uint) {
        if (totalTicketHolders == 0) {
            return 0;
        } else {
            return applyDeduction(getTotalPlacedAmount());
        }
    }

    function getTagCount() public view returns (uint) {
        return tag.length;
    }

    function getAdditionalCreatorAmount() internal view returns (uint) {
        return getTotalPlacedAmount().mul(creatorPercentage).mul(ONE_PERCENT).div(HUNDRED_PERCENT);
    }

    function getAdditionalResolverAmount() internal view returns (uint) {
        return getTotalPlacedAmount().mul(resolverPercentage).mul(ONE_PERCENT).div(HUNDRED_PERCENT);
    }

    function getSafeBoxAmount() internal view returns (uint) {
        return getTotalPlacedAmount().sub(getAdditionalCreatorAmount()).sub(getTotalClaimableAmount());
    }

    // INTERNAL FUNCTIONS

    function _initializeWithTwoParameters(
        address _creatorAddress,
        string memory _marketQuestion,
        uint _endOfPositioning,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint[] memory _tag,
        address _paymentToken,
        string memory _phrase1,
        string memory _phrase2
    ) internal {
        creatorAddress = _creatorAddress;
        creationTime = block.timestamp;
        marketQuestion = _marketQuestion;
        endOfPositioning = _endOfPositioning;
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

    function _addPosition(string memory _position) internal {
        // require(_position != "" || _position != " ", "Invalid phrase. Please assign non-zero position");
        positionCount = positionCount.add(1);
        positionPhrase[positionCount] = _position;
    }

    event MarketDisputed(bool disputed);
    event MarketCreated(uint creationTime, uint positionCount, bytes32 phrase);
    event MarketResolved(uint winningPosition, address resolverAddress);
    event WinningTicketClaimed(address account, uint amount);
    event TransferredToSafeBox(address account, uint amount);
}

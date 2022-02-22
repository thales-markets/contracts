pragma solidity ^0.8.0;

// import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";

contract ExoticPositionalMarket is Initializable, ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using SafeMath for uint;

    enum TicketType {FIXED_TICKET_PRICE, FLEXIBLE_BID}
    uint private safeBoxAmount;
    uint private constant HUNDRED = 100;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant HUNDRED_PERCENT = 1e18;
    uint private constant FIXED_BOND_AMOUNT = 100 * 1e18;
    uint private constant CANCELED = 0;
    uint public constant claimTimeoutDefaultPeriod = 1 days;
    uint public constant pDAOResolveTimePeriod = 2 days;
    uint public constant safeBoxPercentage = 1;
    uint public constant creatorPercentage = 1;
    uint public constant resolverPercentage = 1;

    uint public creationTime;
    uint public resolvedTime;
    uint public lastDisputeTime;
    uint public claimTimeoutPeriod;
    bool public disputed;
    bool public outcomeUpdated;

    // from init
    string public marketQuestion;
    TicketType public ticketType;
    mapping(uint => string) public positionPhrase;
    uint public positionCount;
    uint public endOfPositioning;
    uint public marketMaturity;
    uint public fixedTicketPrice;
    uint[] public tag;
    uint public backstopTimeout;
    uint public withdrawalFeePercentage;
    bool public withdrawalAllowed;
    IERC20 public paymentToken;
    address public creatorAddress;
    address public councilAddress;
    address public resolverAddress;

    //stats
    uint public totalTicketHolders;
    mapping(uint => uint) public ticketsPerPosition;
    mapping(address => uint) public ticketHolder;
    bool public resolved;
    bool public disputedInPositioningPhase;
    uint public winningPosition;
    uint public claimableTicketsCount;

    uint public totalBondAmount;

    function initialize(
        address _creatorAddress,
        string memory _marketQuestion,
        uint _endOfPositioning,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint[] memory _tag,
        address _paymentToken,
        string[] memory _phrases
    ) external initializer {
        require(_phrases.length >= 2 && _phrases.length <= 5, "Invalid number of provided positions");
        setOwner(msg.sender);
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

    function takeAPosition(uint _position) external notPaused {
        require(_position > 0, "Position can not be zero. Non-zero position expected");
        require(_position <= positionCount, "Position exceeds number of positions");
        require(canUsersPlacePosition(), "Not able to position. Positioning time finished or market resolved");
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            if (ticketHolder[msg.sender] == 0) {
                transferToMarket(msg.sender, fixedTicketPrice);
                totalTicketHolders = totalTicketHolders.add(1);
            } else {
                ticketsPerPosition[ticketHolder[msg.sender]] = ticketsPerPosition[ticketHolder[msg.sender]].sub(1);
            }
            ticketsPerPosition[_position] = ticketsPerPosition[_position].add(1);
            ticketHolder[msg.sender] = _position;
            emit NewPositionTaken(msg.sender, _position, fixedTicketPrice);
        } else {
            // _resolveFlexibleBid(_outcomePosition);
        }
    }

    function withdraw() external notPaused {
        require(withdrawalAllowed, "Withdrawal not allowed");
        require(ticketHolder[msg.sender] > 0, "Not a ticket holder");
        require(canUsersPlacePosition(), "Not able to withdraw. Positioning time finished or market resolved");
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            uint withdrawalFee = fixedTicketPrice.mul(withdrawalFeePercentage).mul(ONE_PERCENT).div(HUNDRED_PERCENT);
            safeBoxAmount = safeBoxAmount.add(withdrawalFee.div(2));
            totalTicketHolders = totalTicketHolders.sub(1);
            ticketsPerPosition[ticketHolder[msg.sender]] = ticketsPerPosition[ticketHolder[msg.sender]].sub(1);
            ticketHolder[msg.sender] = 0;
            paymentToken.transfer(creatorAddress, withdrawalFee.div(2));
            paymentToken.transfer(msg.sender, fixedTicketPrice.sub(withdrawalFee));
            emit TicketWithdrawn(msg.sender, fixedTicketPrice.sub(withdrawalFee));
        } else {
            // _resolveFlexibleBid(_outcomePosition);
        }
    }

    // market resolved only through the Manager
    function resolveMarket(uint _outcomePosition, address _resolverAddress) external onlyOwner {
        require(canMarketBeResolved(), "Market can not be resolved. It is disputed/not matured/resolved");
        require(_outcomePosition < positionCount, "Outcome position exeeds the position");
        if (_resolverAddress != creatorAddress) {
            transferToMarket(_resolverAddress, FIXED_BOND_AMOUNT);
            totalBondAmount = totalBondAmount.add(FIXED_BOND_AMOUNT);
        }
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            winningPosition = _outcomePosition;
            claimableTicketsCount = ticketsPerPosition[_outcomePosition];
            resolved = true;
            resolvedTime = block.timestamp;
            resolverAddress = _resolverAddress;
            emit MarketResolved(_outcomePosition, _resolverAddress);
        } else {
            // Flexible bid
        }
    }

    function resetMarket() external onlyOwner {
        require(resolved, "Market is not resolved");

        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            if (winningPosition == CANCELED) {
                ticketsPerPosition[winningPosition] = 0;
            }
            claimableTicketsCount = 0;
            resolved = false;
            resolvedTime = 0;
            emit MarketReset();
        } else {
            // Flexible bid
        }
    }

    function cancelMarket() external onlyOwner {
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            winningPosition = CANCELED;
            claimableTicketsCount = totalTicketHolders;
            ticketsPerPosition[winningPosition] = totalTicketHolders;
            resolved = true;
            resolvedTime = block.timestamp;
            emit MarketResolved(CANCELED, msg.sender);
        } else {
            // _resolveFlexibleBid(_outcomePosition);
        }
    }

    function claimWinningTicket() external notPaused {
        require(canHoldersClaim(), "Market not finalized");
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            uint amount = getTicketHolderClaimableAmount(msg.sender);
            if (amount > 0) {
                claimableTicketsCount = claimableTicketsCount.sub(1);
                paymentToken.transfer(msg.sender, amount);
                emit WinningTicketClaimed(msg.sender, amount);
            }
        } else {
            // Flexible bid;
        }
    }

    function claimToSafeBox(address _safeBox) external onlyOwner {
        require(resolved, "Market not resolved");
        require(paymentToken.balanceOf(_safeBox) > 0, "Balance is zero");
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            paymentToken.transfer(_safeBox, getSafeBoxAmount());
            emit TransferredToSafeBox(_safeBox, getSafeBoxAmount());
        } else {
            // Flexible bid
        }
    }

    function openDispute() external onlyOwner {
        require(isMarketCreated(), "Market not created");
        require(!disputed, "Market already disputed");
        disputed = true;
        disputedInPositioningPhase = canUsersPlacePosition();
        lastDisputeTime = block.timestamp;
        emit MarketDisputed(true);
    }

    function closeDispute() external onlyOwner {
        require(disputed, "Market not disputed");
        if (disputedInPositioningPhase) {
            disputed = false;
            disputedInPositioningPhase = false;
        } else {
            disputed = false;
        }
    }

    function transferToMarket(address _sender, uint _amount) public notPaused nonReentrant {
        require(_sender != address(0), "Invalid sender address");
        require(paymentToken.balanceOf(_sender) >= _amount, "Sender balance low");
        require(paymentToken.allowance(_sender, address(this)) >= _amount, "No allowance. Please adjust the allowance");
        paymentToken.transferFrom(_sender, address(this), _amount);
    }
    
    function transferBondToMarket(address _sender, uint _amount) external notPaused nonReentrant {
        totalBondAmount = totalBondAmount.add(_amount);
        transferToMarket(_sender, _amount);
    }

    function transferFromBondAmountToRecepient(address _recepient, uint _amount) public onlyOwner {
        require(_amount <= totalBondAmount, "Exceeds the total bond amount");
        require(_recepient != address(0), "Invalid sender address");
        require(paymentToken.balanceOf(address(this)) >= _amount, "Market balance low");
        totalBondAmount = totalBondAmount.sub(_amount);
        paymentToken.transfer(_recepient, _amount);
    }

    // SETTERS ///////////////////////////////////////////////////////

    function setBackstopTimeout(uint _timeoutPeriod) external onlyOwner {
        backstopTimeout = _timeoutPeriod;
        emit BackstopTimeoutPeriodChanged(_timeoutPeriod);
    }

    // VIEWS /////////////////////////////////////////////////////////

    function isMarketCreated() public view returns (bool) {
        return creationTime > 0;
    }

    function canUsersPlacePosition() public view returns (bool) {
        return block.timestamp <= endOfPositioning && creationTime > 0 && !resolved;
    }

    function canMarketBeResolved() public view returns (bool) {
        return block.timestamp >= endOfPositioning && creationTime > 0 && (!disputed) && !resolved;
    }

    function canMarketBeResolvedByPDAO() public view returns (bool) {
        return canMarketBeResolved() && block.timestamp >= endOfPositioning.add(pDAOResolveTimePeriod);
    }

    function canHoldersClaim() public view returns (bool) {
        return (resolvedTime > 0 && block.timestamp > resolvedTime.add(backstopTimeout)) && resolved && (!disputed);
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

    function getTicketHolderClaimableAmount(address _account) public view returns (uint) {
        uint amount = 0;
        amount = (ticketHolder[_account] > 0 && (ticketHolder[_account] == winningPosition || winningPosition == CANCELED))
            ? getWinningAmountPerTicket()
            : 0;
        if (_account == creatorAddress && winningPosition != CANCELED) {
            amount = amount.add(getAdditionalCreatorAmount());
        }
        if (_account == resolverAddress && winningPosition != CANCELED) {
            amount = amount.add(getAdditionalResolverAmount());
        }
        return amount;
    }

    function getWinningAmountPerTicket() public view returns (uint) {
        if (totalTicketHolders == 0) {
            return 0;
        } else {
            return getTotalClaimableAmount().div(ticketsPerPosition[winningPosition]);
        }
    }

    function getAlreadyClaimedTickets() public view returns (uint) {
        return canHoldersClaim() ? ticketsPerPosition[winningPosition].sub(claimableTicketsCount) : 0;
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
        return getTotalPlacedAmount().add(safeBoxAmount).sub(getAdditionalCreatorAmount()).sub(getTotalClaimableAmount());
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
        positionCount = positionCount.add(1);
        positionPhrase[positionCount] = _position;
    }

    event MarketDisputed(bool disputed);
    event MarketCreated(uint creationTime, uint positionCount, bytes32 phrase);
    event MarketResolved(uint winningPosition, address resolverAddress);
    event MarketReset();
    event WinningTicketClaimed(address account, uint amount);
    event TransferredToSafeBox(address account, uint amount);
    event BackstopTimeoutPeriodChanged(uint timeoutPeriod);
    event NewPositionTaken(address account, uint position, uint fixedTicketAmount);
    event TicketWithdrawn(address account, uint amount);
    event BondIncreased(uint amount, uint totalAmount);
    event BondDecreased(uint amount, uint totalAmount);
}

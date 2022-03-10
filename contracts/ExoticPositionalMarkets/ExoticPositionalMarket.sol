pragma solidity ^0.8.0;

// import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "./OraclePausable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../interfaces/IExoticPositionalMarketManager.sol";

contract ExoticPositionalMarket is Initializable, ProxyOwned, OraclePausable, ProxyReentrancyGuard {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    enum TicketType {FIXED_TICKET_PRICE, FLEXIBLE_BID}
    uint private safeBoxAmount;
    uint private constant HUNDRED = 100;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant HUNDRED_PERCENT = 1e18;
    uint private constant FIXED_BOND_AMOUNT = 100 * 1e18;
    uint private constant CANCELED = 0;

    uint public creationTime;
    uint public resolvedTime;
    uint public lastDisputeTime;
    uint public claimTimeoutPeriod;
    bool public disputed;
    bool public outcomeUpdated;

    // from init
    string public marketQuestion;
    string public marketSource;
    TicketType public ticketType;
    mapping(uint => string) public positionPhrase;
    uint public positionCount;
    uint public endOfPositioning;
    uint public marketMaturity;
    uint public fixedTicketPrice;
    uint[] public tags;
    uint public backstopTimeout;
    bool public withdrawalAllowed;
    IExoticPositionalMarketManager public marketManager;
    address public resolverAddress;

    //stats
    uint public totalUserPositions;
    mapping(uint => uint) public ticketsPerPosition;
    mapping(address => uint) public userPosition;

    // open bid parameters
    uint public totalOpenBidAmount;
    uint public claimableOpenBidAmount;
    mapping(uint => uint) public totalOpenBidAmountPerPosition;
    mapping(address => mapping(uint => uint)) public userOpenBidPosition;

    bool public resolved;
    bool public disputedInPositioningPhase;
    bool public firstUserClaimed;
    uint public winningPosition;
    uint public claimableTicketsCount;

    uint public totalBondAmount;

    function initialize(
        string memory _marketQuestion,
        string memory _marketSource,
        uint _endOfPositioning,
        uint _fixedTicketPrice,
        bool _withdrawalAllowed,
        uint[] memory _tags,
        uint _positionCount,
        string[] memory _positionPhrases
    ) external initializer {
        require(
            _positionCount >= 2 && _positionCount <= IExoticPositionalMarketManager(msg.sender).maximumPositionsAllowed(),
            "Invalid number of provided positions"
        );
        require(_tags.length > 0);
        setOwner(msg.sender);
        marketManager = IExoticPositionalMarketManager(msg.sender);
        _initializeWithTwoParameters(
            _marketQuestion,
            _marketSource,
            _endOfPositioning,
            _fixedTicketPrice,
            _withdrawalAllowed,
            _tags,
            _positionPhrases[0],
            _positionPhrases[1]
        );
        if (_positionCount > 2) {
            for (uint i = 2; i < _positionCount; i++) {
                _addPosition(_positionPhrases[i]);
            }
        }
    }

    function takeAPosition(uint _position) external notPaused {
        require(_position > 0, "Position can not be zero. Non-zero position expected");
        require(_position <= positionCount, "Position exceeds number of positions");
        require(canUsersPlacePosition(), "Not able to position. Positioning time finished or market resolved");
        //require(same position)
        require(ticketType == TicketType.FIXED_TICKET_PRICE, "Not a Fixed price market");
            if (userPosition[msg.sender] == 0) {
                transferToMarket(msg.sender, fixedTicketPrice);
                totalUserPositions = totalUserPositions.add(1);
            } else {
                ticketsPerPosition[userPosition[msg.sender]] = ticketsPerPosition[userPosition[msg.sender]].sub(1);
            }
            ticketsPerPosition[_position] = ticketsPerPosition[_position].add(1);
            userPosition[msg.sender] = _position;
            emit NewPositionTaken(msg.sender, _position, fixedTicketPrice);
    }
    
    function takeOpenBidPositions(uint[] memory _positions, uint[] memory _amounts) external notPaused {
        require(_positions.length > 0, "Invalid positions. Please add at least a single position");
        require(_positions.length <= positionCount, "Position exceeds number of positions");
        require(canUsersPlacePosition(), "Not able to position. Positioning time finished or market resolved");
        require(ticketType == TicketType.FLEXIBLE_BID, "Not an Open Bid market type");
        uint totalDepositedAmount = 0;
        for(uint i=0; i<_positions.length; i++) {
            require(_positions[i] > 0, "Position can not be zero. Non-zero position expected");
            require(_positions[i] <= positionCount, "Position exceeds number of positions");
            require(_amounts[i] > 0, "Zero amount for position");
            // add to the amount of the position
            totalOpenBidAmountPerPosition[_positions[i]] = totalOpenBidAmountPerPosition[_positions[i]].add(_amounts[i]);
            // add to the total amount
            totalOpenBidAmount = totalOpenBidAmount.add(_amounts[i]);
            userOpenBidPosition[msg.sender][_positions[i]] = userOpenBidPosition[msg.sender][_positions[i]].add(_amounts[i]);
            totalDepositedAmount = totalDepositedAmount.add(_amounts[i]);
        }
        transferToMarket(msg.sender, totalDepositedAmount);
        emit NewOpenBidsForPositions(msg.sender, _positions, _amounts);   
    }

    function withdraw() external notPaused {
        require(withdrawalAllowed, "Withdrawal not allowed");
        require(userPosition[msg.sender] > 0, "Not a ticket holder");
        require(canUsersPlacePosition(), "Not able to withdraw. Positioning time finished or market resolved");
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            uint withdrawalFee =
                fixedTicketPrice.mul(marketManager.withdrawalPercentage()).mul(ONE_PERCENT).div(HUNDRED_PERCENT);
            safeBoxAmount = safeBoxAmount.add(withdrawalFee.div(2));
            totalUserPositions = totalUserPositions.sub(1);
            ticketsPerPosition[userPosition[msg.sender]] = ticketsPerPosition[userPosition[msg.sender]].sub(1);
            userPosition[msg.sender] = 0;
            IERC20(marketManager.paymentToken()).safeTransfer(
                marketManager.creatorAddress(address(this)),
                withdrawalFee.div(2)
            );
            IERC20(marketManager.paymentToken()).safeTransfer(msg.sender, fixedTicketPrice.sub(withdrawalFee));
            emit TicketWithdrawn(msg.sender, fixedTicketPrice.sub(withdrawalFee));
        } else {
            // _resolveFlexibleBid(_outcomePosition);
        }
    }

    // market resolved only through the Manager
    function resolveMarket(uint _outcomePosition, address _resolverAddress) external onlyOwner {
        require(canMarketBeResolved(), "Market can not be resolved. It is disputed/not matured/resolved");
        require(_outcomePosition <= positionCount, "Outcome position exeeds the position");
        winningPosition = _outcomePosition;
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            if (_outcomePosition == CANCELED) {
                claimableTicketsCount = totalUserPositions;
                ticketsPerPosition[winningPosition] = totalUserPositions;
            } else {
                claimableTicketsCount = ticketsPerPosition[_outcomePosition];
            }
        } else {
            // Flexible bid
            if (_outcomePosition == CANCELED) {
                claimableOpenBidAmount = totalOpenBidAmount;
                totalOpenBidAmountPerPosition[_outcomePosition] = totalOpenBidAmount;
            }
            else {
                claimableOpenBidAmount = totalOpenBidAmountPerPosition[_outcomePosition];
            }
        }
        resolved = true;
        resolvedTime = block.timestamp;
        resolverAddress = _resolverAddress;
        emit MarketResolved(_outcomePosition, _resolverAddress);
    }

    function resetMarket() external onlyOwner {
        require(resolved, "Market is not resolved");
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            if (winningPosition == CANCELED) {
                ticketsPerPosition[winningPosition] = 0;
            }
            claimableTicketsCount = 0;
        } else {
            // Flexible bid
            if (winningPosition == CANCELED) {
                totalOpenBidAmountPerPosition[winningPosition] = 0;
            }
            claimableOpenBidAmount = 0;
        }
        resolved = false;
        resolvedTime = 0;
        emit MarketReset();
    }

    function cancelMarket() external onlyOwner {
        winningPosition = CANCELED;
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            claimableTicketsCount = totalUserPositions;
            ticketsPerPosition[winningPosition] = totalUserPositions;
        } else {
            // _resolveFlexibleBid(_outcomePosition);
            claimableOpenBidAmount = totalOpenBidAmount;
            totalOpenBidAmountPerPosition[winningPosition] = totalOpenBidAmount;
        }
        resolved = true;
        resolvedTime = block.timestamp;
        emit MarketResolved(CANCELED, msg.sender);
    }

    function claimWinningTicket() external notPaused {
        require(canUsersClaim(), "Market not finalized");
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            uint amount = getUserClaimableAmount(msg.sender);
            if (amount > 0) {
                claimableTicketsCount = claimableTicketsCount.sub(1);
                IERC20(marketManager.paymentToken()).safeTransfer(msg.sender, amount);
                if (!firstUserClaimed) {
                    IERC20(marketManager.paymentToken()).safeTransfer(
                        marketManager.creatorAddress(address(this)),
                        getAdditionalCreatorAmount()
                    );
                    IERC20(marketManager.paymentToken()).safeTransfer(
                        marketManager.resolverAddress(address(this)),
                        getAdditionalResolverAmount()
                    );
                    IERC20(marketManager.paymentToken()).safeTransfer(marketManager.safeBoxAddress(), getSafeBoxAmount());
                    firstUserClaimed = true;
                }
                emit WinningTicketClaimed(msg.sender, amount);
            }
        } else {
            // Flexible bid;
        }
    }

    function claimWinningTicketOnBehalf(address _user) external onlyOwner {
        require(canUsersClaim(), "Market not finalized");
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            uint amount = getUserClaimableAmount(_user);
            if (amount > 0) {
                claimableTicketsCount = claimableTicketsCount.sub(1);
                IERC20(marketManager.paymentToken()).safeTransfer(_user, amount);
                if (!firstUserClaimed) {
                    IERC20(marketManager.paymentToken()).safeTransfer(
                        marketManager.creatorAddress(address(this)),
                        getAdditionalCreatorAmount()
                    );
                    IERC20(marketManager.paymentToken()).safeTransfer(
                        marketManager.resolverAddress(address(this)),
                        getAdditionalResolverAmount()
                    );
                    IERC20(marketManager.paymentToken()).safeTransfer(marketManager.safeBoxAddress(), getSafeBoxAmount());
                    firstUserClaimed = true;
                }
                emit WinningTicketClaimed(_user, amount);
            }
        } else {
            // Flexible bid;
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
        require(IERC20(marketManager.paymentToken()).balanceOf(_sender) >= _amount, "Sender balance low");
        require(
            IERC20(marketManager.paymentToken()).allowance(_sender, address(this)) >= _amount,
            "No allowance. Please adjust the allowance"
        );
        IERC20(marketManager.paymentToken()).safeTransferFrom(_sender, address(this), _amount);
    }

    function transferBondToMarket(address _sender, uint _amount) external notPaused {
        totalBondAmount = totalBondAmount.add(_amount);
        transferToMarket(_sender, _amount);
    }

    function transferFromBondAmountToRecepient(address _recepient, uint _amount) public onlyOwner {
        require(_amount <= totalBondAmount, "Exceeds the total bond amount");
        require(_recepient != address(0), "Invalid sender address");
        require(IERC20(marketManager.paymentToken()).balanceOf(address(this)) >= _amount, "Market balance low");
        totalBondAmount = totalBondAmount.sub(_amount);
        IERC20(marketManager.paymentToken()).safeTransfer(_recepient, _amount);
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
        return canMarketBeResolved() && block.timestamp >= endOfPositioning.add(marketManager.pDAOResolveTimePeriod());
    }

    function canUsersClaim() public view returns (bool) {
        return
            resolved &&
            (!disputed) &&
            ((resolvedTime > 0 && block.timestamp > resolvedTime.add(marketManager.claimTimeoutDefaultPeriod())) ||
                (backstopTimeout > 0 && resolvedTime > 0 && block.timestamp > resolvedTime.add(backstopTimeout)));
    }

    function canUserWithdraw(address _account) public view returns (bool) {
        if(ticketType == TicketType.FLEXIBLE_BID) {
            return withdrawalAllowed && canUsersPlacePosition() && getUserOpenBidTotalPlacedAmount(_account) > 0;
        }
        else {
            return withdrawalAllowed && canUsersPlacePosition() && userPosition[_account] > 0;
        }
    }
    
    function getPositionPhrase(uint index) public view returns (string memory) {
        return (index <= positionCount && index > 0) ? positionPhrase[index] : string("");
    }
    
    function getTotalPlacedAmount() public view returns (uint) {
        if(ticketType == TicketType.FLEXIBLE_BID) {
            return totalOpenBidAmount;
        }
        else {
            return fixedTicketPrice.mul(totalUserPositions);
        }
    }

    function getTotalClaimableAmount() public view returns (uint) {
        if (totalUserPositions == 0) {
            return 0;
        } else {
            return applyDeduction(getTotalPlacedAmount());
        }
    }

    function getTotalFeesAmount() public view returns (uint) {
        return getTotalPlacedAmount().sub(getTotalClaimableAmount());
    }

    function getUserClaimableAmount(address _account) public view returns (uint) {
        if(ticketType == TicketType.FLEXIBLE_BID) {
            return getUserOpenBidTotalClaimableAmount(_account);
        }
        else {
            return (userPosition[_account] > 0 && (userPosition[_account] == winningPosition || winningPosition == CANCELED))
            ? getWinningAmountPerTicket()
            : 0;
        }
    }


    /// FLEXIBLE BID FUNCTIONS

    function getUserOpenBidTotalPlacedAmount(address _account) public view returns(uint) {
        uint amount = 0;
        for(uint i = 1; i <= positionCount; i++) {
            amount = amount.add(userOpenBidPosition[_account][i]);
        }
        return amount;
    }
    
    function getUserOpenBidPositionPlacedAmount(address _account, uint _position) public view returns(uint) {
        return userOpenBidPosition[_account][_position];
    }
    
    function getAllUserPositions(address _account) public view returns (uint[] memory) {
        uint[] memory userAllPositions = new uint[](positionCount);
        if(positionCount == 0) {
            return userAllPositions;
        }
        if(ticketType == TicketType.FLEXIBLE_BID) {
            for(uint i=1; i<= positionCount; i++) {
                userAllPositions[i-1] = userOpenBidPosition[_account][i];
            }
            return userAllPositions;
        }
        else {
            userAllPositions[userPosition[_account]] = 1;
            return userAllPositions;
        }
        
    }

    function getUserOpenBidPotentialWinningForPosition(address _account, uint _position) public view returns (uint) {
        if(_position == CANCELED) {
            return 0;
        }
        return userOpenBidPosition[_account][_position].mul(getTotalClaimableAmount()).div(totalOpenBidAmountPerPosition[_position]);
    }

    function getUserOpenBidTotalClaimableAmount(address _account) public view returns (uint) {
        return getUserOpenBidPotentialWinningForPosition(_account, winningPosition);
    }
    

    /// FIXED TICKET FUNCTIONS

    function getUserPosition(address _account) public view returns (uint) {
        return userPosition[_account];
    }

    function getUserPositionPhrase(address _account) public view returns (string memory) {
        return (userPosition[_account] > 0) ? positionPhrase[userPosition[_account]] : string("");
    }


    function getPotentialWinningAmountForPosition(uint _position) public view returns (uint) {
        if (totalUserPositions == 0) {
            return 0;
        } else {
            return getTotalClaimableAmount().div(ticketsPerPosition[_position]);
        }
    }

    function getWinningAmountPerTicket() public view returns (uint) {
        if (totalUserPositions == 0) {
            return 0;
        } else {
            return getTotalClaimableAmount().div(ticketsPerPosition[winningPosition]);
        }
    }

    function getAlreadyClaimedTickets() public view returns (uint) {
        return canUsersClaim() ? ticketsPerPosition[winningPosition].sub(claimableTicketsCount) : 0;
    }

    function applyDeduction(uint value) internal view returns (uint) {
        return
            (value)
                .mul(
                HUNDRED.sub(
                    marketManager.safeBoxPercentage().add(marketManager.creatorPercentage()).add(
                        marketManager.resolverPercentage()
                    )
                )
            )
                .mul(ONE_PERCENT)
                .div(HUNDRED_PERCENT);
    }

    function getTagsCount() public view returns (uint) {
        return tags.length;
    }

    function getAdditionalCreatorAmount() internal view returns (uint) {
        return getTotalPlacedAmount().mul(marketManager.creatorPercentage()).mul(ONE_PERCENT).div(HUNDRED_PERCENT);
    }

    function getAdditionalResolverAmount() internal view returns (uint) {
        return getTotalPlacedAmount().mul(marketManager.resolverPercentage()).mul(ONE_PERCENT).div(HUNDRED_PERCENT);
    }

    function getSafeBoxAmount() internal view returns (uint) {
        return getTotalFeesAmount().add(safeBoxAmount).sub(getAdditionalCreatorAmount()).sub(getAdditionalResolverAmount());
    }

    // INTERNAL FUNCTIONS

    function _initializeWithTwoParameters(
        string memory _marketQuestion,
        string memory _marketSource,
        uint _endOfPositioning,
        uint _fixedTicketPrice,
        bool _withdrawalAllowed,
        uint[] memory _tags,
        string memory _positionPhrase1,
        string memory _positionPhrase2
    ) internal {
        creationTime = block.timestamp;
        marketQuestion = _marketQuestion;
        marketSource = _marketSource;
        endOfPositioning = _endOfPositioning;
        // Ticket Type can be determined based on ticket price
        ticketType = _fixedTicketPrice > 0 ? TicketType.FIXED_TICKET_PRICE : TicketType.FLEXIBLE_BID;
        fixedTicketPrice = _fixedTicketPrice;
        // Withdrawal allowance determined based on withdrawal percentage, if it is over 100% then it is forbidden
        withdrawalAllowed = _withdrawalAllowed;
        // The tag is just a number for now
        tags = _tags;
        _addPosition(_positionPhrase1);
        _addPosition(_positionPhrase2);
    }

    function _addPosition(string memory _position) internal {
        require(keccak256(abi.encode(_position)) != keccak256(abi.encode("")), "Invalid position label (empty string)");
        require(bytes(_position).length < 50, "Position label exceeds length");
        positionCount = positionCount.add(1);
        positionPhrase[positionCount] = _position;
    }

    event MarketDisputed(bool disputed);
    event MarketCreated(uint creationTime, uint positionCount, bytes32 phrase);
    event MarketResolved(uint winningPosition, address resolverAddress);
    event MarketReset();
    event WinningTicketClaimed(address account, uint amount);
    event BackstopTimeoutPeriodChanged(uint timeoutPeriod);
    event NewPositionTaken(address account, uint position, uint fixedTicketAmount);
    event TicketWithdrawn(address account, uint amount);
    event BondIncreased(uint amount, uint totalAmount);
    event BondDecreased(uint amount, uint totalAmount);
    event NewOpenBidsForPositions(address account, uint[] openBidPositions, uint[] openBidAmounts);   
}

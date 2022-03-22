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
    uint private constant HUNDRED = 100;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant HUNDRED_PERCENT = 1e18;
    uint private constant FIXED_BOND_AMOUNT = 100 * 1e18;
    uint private constant CANCELED = 0;

    uint public creationTime;
    uint public resolvedTime;
    uint public lastDisputeTime;
    bool public disputed;

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
    uint public totalUsersTakenPositions;
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
    uint public disputeClosedTime;

    uint public fixedBondAmount;
    uint public disputePrice;
    uint public safeBoxLowAmount;
    uint public arbitraryRewardForDisputor;

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
        fixedBondAmount = marketManager.fixedBondAmount();
        disputePrice = marketManager.disputePrice();
        safeBoxLowAmount = marketManager.safeBoxLowAmount();
        arbitraryRewardForDisputor = marketManager.arbitraryRewardForDisputor();
    }

    function takeAPosition(uint _position) external notPaused {
        require(_position > 0, "Position can not be zero. Non-zero position expected");
        require(_position <= positionCount, "Position exceeds number of positions");
        require(canUsersPlacePosition(), "Not able to position. Positioning time finished or market resolved");
        //require(same position)
        require(ticketType == TicketType.FIXED_TICKET_PRICE, "Not a Fixed price market");
        if (userPosition[msg.sender] == 0) {
            transferToMarket(msg.sender, fixedTicketPrice);
            totalUsersTakenPositions = totalUsersTakenPositions.add(1);
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
        bool firstTime = true;
        for (uint i = 0; i < _positions.length; i++) {
            require(_positions[i] > 0, "Position can not be zero. Non-zero position expected");
            require(_positions[i] <= positionCount, "Position exceeds number of positions");
            require(_amounts[i] > 0, "Zero amount for position");
            // add to the amount of the position
            totalOpenBidAmountPerPosition[_positions[i]] = totalOpenBidAmountPerPosition[_positions[i]].add(_amounts[i]);
            // add to the total amount
            totalOpenBidAmount = totalOpenBidAmount.add(_amounts[i]);
            if (userOpenBidPosition[msg.sender][_positions[i]] > 0) {
                firstTime = false;
            }
            userOpenBidPosition[msg.sender][_positions[i]] = userOpenBidPosition[msg.sender][_positions[i]].add(_amounts[i]);
            totalDepositedAmount = totalDepositedAmount.add(_amounts[i]);
        }
        totalUsersTakenPositions = firstTime ? totalUsersTakenPositions.add(1) : totalUsersTakenPositions;
        transferToMarket(msg.sender, totalDepositedAmount);
        emit NewOpenBidsForPositions(msg.sender, _positions, _amounts);
    }

    function withdraw() external notPaused {
        require(withdrawalAllowed, "Withdrawal not allowed");
        require(canUsersPlacePosition(), "Not able to withdraw. Positioning time finished or market resolved");
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            require(userPosition[msg.sender] > 0, "Not a ticket holder");
            uint withdrawalFee =
                fixedTicketPrice.mul(marketManager.withdrawalPercentage()).mul(ONE_PERCENT).div(HUNDRED_PERCENT);
            totalUsersTakenPositions = totalUsersTakenPositions.sub(1);
            ticketsPerPosition[userPosition[msg.sender]] = ticketsPerPosition[userPosition[msg.sender]].sub(1);
            userPosition[msg.sender] = 0;
            IERC20(marketManager.paymentToken()).safeTransfer(marketManager.safeBoxAddress(), withdrawalFee.div(2));
            IERC20(marketManager.paymentToken()).safeTransfer(
                marketManager.creatorAddress(address(this)),
                withdrawalFee.div(2)
            );
            IERC20(marketManager.paymentToken()).safeTransfer(msg.sender, fixedTicketPrice.sub(withdrawalFee));
            emit TicketWithdrawn(msg.sender, fixedTicketPrice.sub(withdrawalFee));
        } else {
            // withdraw all for open bid
            uint totalToWithdraw;
            for (uint i = 1; i <= positionCount; i++) {
                if (userOpenBidPosition[msg.sender][i] > 0) {
                    totalToWithdraw = totalToWithdraw.add(userOpenBidPosition[msg.sender][i]);
                    userOpenBidPosition[msg.sender][i] = 0;
                }
            }
            totalUsersTakenPositions = totalUsersTakenPositions.sub(1);
            totalOpenBidAmount = totalOpenBidAmount.sub(totalToWithdraw);
            uint withdrawalFee =
                totalToWithdraw.mul(marketManager.withdrawalPercentage()).mul(ONE_PERCENT).div(HUNDRED_PERCENT);
            IERC20(marketManager.paymentToken()).safeTransfer(marketManager.safeBoxAddress(), withdrawalFee.div(2));
            IERC20(marketManager.paymentToken()).safeTransfer(
                marketManager.creatorAddress(address(this)),
                withdrawalFee.div(2)
            );
            IERC20(marketManager.paymentToken()).safeTransfer(msg.sender, totalToWithdraw.sub(withdrawalFee));
            emit OpenBidUserWithdrawn(msg.sender, totalToWithdraw.sub(withdrawalFee), totalOpenBidAmount);
        }
    }

    function withdrawFromOpenBidPosition(uint _openBidPosition) external notPaused {
        require(withdrawalAllowed, "Withdrawal not allowed");
        require(canUsersPlacePosition(), "Not able to withdraw. Positioning time finished or market resolved");
        require(ticketType == TicketType.FLEXIBLE_BID, "Market is not open bid");
        require(userOpenBidPosition[msg.sender][_openBidPosition] > 0, "No amount placed for the position by the user");
        uint totalToWithdraw = userOpenBidPosition[msg.sender][_openBidPosition];
        userOpenBidPosition[msg.sender][_openBidPosition] = 0;
        if (getUserOpenBidTotalPlacedAmount(msg.sender) == 0) {
            totalUsersTakenPositions = totalUsersTakenPositions.sub(1);
        }
        totalOpenBidAmount = totalOpenBidAmount.sub(totalToWithdraw);
        uint withdrawalFee = totalToWithdraw.mul(marketManager.withdrawalPercentage()).mul(ONE_PERCENT).div(HUNDRED_PERCENT);
        IERC20(marketManager.paymentToken()).safeTransfer(marketManager.safeBoxAddress(), withdrawalFee.div(2));
        IERC20(marketManager.paymentToken()).safeTransfer(marketManager.creatorAddress(address(this)), withdrawalFee.div(2));
        IERC20(marketManager.paymentToken()).safeTransfer(msg.sender, totalToWithdraw.sub(withdrawalFee));
        emit OpenBidUserWithdrawn(msg.sender, totalToWithdraw.sub(withdrawalFee), totalOpenBidAmount);
    }

    // market resolved only through the Manager
    function resolveMarket(uint _outcomePosition, address _resolverAddress) external onlyOwner {
        require(canMarketBeResolvedByOwner(), "Market can not be resolved. It is disputed/not matured");
        require(_outcomePosition <= positionCount, "Outcome position exeeds the position");
        winningPosition = _outcomePosition;
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            if (_outcomePosition == CANCELED) {
                claimableTicketsCount = totalUsersTakenPositions;
                ticketsPerPosition[winningPosition] = totalUsersTakenPositions;
            } else {
                claimableTicketsCount = ticketsPerPosition[_outcomePosition];
            }
        } else {
            // Flexible bid
            if (_outcomePosition == CANCELED) {
                claimableOpenBidAmount = totalOpenBidAmount;
                totalOpenBidAmountPerPosition[_outcomePosition] = totalOpenBidAmount;
            } else {
                claimableOpenBidAmount = getTotalClaimableAmount();
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
        resolverAddress = address(0);
        emit MarketReset();
    }

    function cancelMarket() external onlyOwner {
        winningPosition = CANCELED;
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            claimableTicketsCount = totalUsersTakenPositions;
            ticketsPerPosition[winningPosition] = totalUsersTakenPositions;
        } else {
            // _resolveFlexibleBid(_outcomePosition);
            claimableOpenBidAmount = totalOpenBidAmount;
            totalOpenBidAmountPerPosition[winningPosition] = totalOpenBidAmount;
        }
        resolved = true;
        resolvedTime = block.timestamp;
        resolverAddress = marketManager.safeBoxAddress();
        emit MarketResolved(CANCELED, msg.sender);
    }

    function claimWinningTicket() external notPaused {
        require(canUsersClaim(), "Market not finalized");
        uint amount = getUserClaimableAmount(msg.sender);
        require(amount > 0, "Claimable amount is zero.");
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            claimableTicketsCount = claimableTicketsCount.sub(1);
            userPosition[msg.sender] = 0;
        } else {
            claimableOpenBidAmount = claimableOpenBidAmount.sub(amount);
            resetForUserAllPositionsToZero(msg.sender);
        }
        IERC20(marketManager.paymentToken()).safeTransfer(msg.sender, amount);
        if (!firstUserClaimed && winningPosition != CANCELED) {
            IERC20(marketManager.paymentToken()).safeTransfer(
                marketManager.creatorAddress(address(this)),
                getAdditionalCreatorAmount()
            );
            IERC20(marketManager.paymentToken()).safeTransfer(
                marketManager.resolverAddress(address(this)),
                getAdditionalResolverAmount()
            );
            IERC20(marketManager.paymentToken()).safeTransfer(marketManager.safeBoxAddress(), getSafeBoxAmount());
            marketManager.issueBondsBackToCreatorAndResolver(address(this));
            firstUserClaimed = true;
        }
        emit WinningTicketClaimed(msg.sender, amount);
    }

    function claimWinningTicketOnBehalf(address _user) external onlyOwner {
        require(canUsersClaim(), "Market not finalized");
        uint amount = getUserClaimableAmount(_user);
        require(amount > 0, "Claimable amount is zero.");
        if (ticketType == TicketType.FIXED_TICKET_PRICE) {
            claimableTicketsCount = claimableTicketsCount.sub(1);
            userPosition[_user] = 0;
        } else {
            claimableOpenBidAmount = claimableOpenBidAmount.sub(amount);
            resetForUserAllPositionsToZero(_user);
        }
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
            marketManager.issueBondsBackToCreatorAndResolver(address(this));
            firstUserClaimed = true;
        }
        emit WinningTicketClaimed(msg.sender, amount);
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
        disputeClosedTime = block.timestamp;
        if (disputedInPositioningPhase) {
            disputed = false;
            disputedInPositioningPhase = false;
        } else {
            disputed = false;
        }
        emit MarketDisputed(false);
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

    function isMarketCancelled() public view returns (bool) {
        return resolved && winningPosition == CANCELED;
    }

    function canUsersPlacePosition() public view returns (bool) {
        return block.timestamp <= endOfPositioning && creationTime > 0 && !resolved;
    }

    function canMarketBeResolved() public view returns (bool) {
        return block.timestamp >= endOfPositioning && creationTime > 0 && (!disputed) && !resolved;
    }

    function canMarketBeResolvedByOwner() public view returns (bool) {
        return block.timestamp >= endOfPositioning && creationTime > 0 && (!disputed);
    }

    function canMarketBeResolvedByPDAO() public view returns (bool) {
        return
            canMarketBeResolvedByOwner() && block.timestamp >= endOfPositioning.add(marketManager.pDAOResolveTimePeriod());
    }

    function canCreatorCancelMarket() external view returns (bool) {
        if (totalUsersTakenPositions != 1) {
            return totalUsersTakenPositions > 1 ? false : true;
        }
        return
            (fixedTicketPrice == 0 &&
                totalOpenBidAmount == getUserOpenBidTotalPlacedAmount(marketManager.creatorAddress(address(this)))) ||
                userPosition[marketManager.creatorAddress(address(this))] > 0
                ? true
                : false;
    }

    function canUsersClaim() public view returns (bool) {
        return
            resolved &&
            (!disputed) &&
            ((resolvedTime > 0 && block.timestamp > resolvedTime.add(marketManager.claimTimeoutDefaultPeriod())) ||
                (backstopTimeout > 0 &&
                    resolvedTime > 0 &&
                    disputeClosedTime > 0 &&
                    block.timestamp > disputeClosedTime.add(backstopTimeout)));
    }

    function canUserClaim(address _user) external view returns (bool) {
        return canUsersClaim() && getUserClaimableAmount(_user) > 0;
    }

    function canUserWithdraw(address _account) public view returns (bool) {
        if (ticketType == TicketType.FLEXIBLE_BID) {
            return withdrawalAllowed && canUsersPlacePosition() && getUserOpenBidTotalPlacedAmount(_account) > 0;
        } else {
            return withdrawalAllowed && canUsersPlacePosition() && userPosition[_account] > 0;
        }
    }

    function getPositionPhrase(uint index) public view returns (string memory) {
        return (index <= positionCount && index > 0) ? positionPhrase[index] : string("");
    }

    function getTotalPlacedAmount() public view returns (uint) {
        if (ticketType == TicketType.FLEXIBLE_BID) {
            return totalOpenBidAmount;
        } else {
            return totalUsersTakenPositions > 0 ? fixedTicketPrice.mul(totalUsersTakenPositions) : 0;
        }
    }

    function getTotalClaimableAmount() public view returns (uint) {
        if (totalUsersTakenPositions == 0) {
            return 0;
        } else {
            return winningPosition == CANCELED ? getTotalPlacedAmount() : applyDeduction(getTotalPlacedAmount());
        }
    }

    function getTotalFeesAmount() public view returns (uint) {
        return getTotalPlacedAmount().sub(getTotalClaimableAmount());
    }

    function getPlacedAmountPerPosition(uint _position) public view returns (uint) {
        if (ticketType == TicketType.FLEXIBLE_BID) {
            return totalOpenBidAmountPerPosition[_position];
        } else {
            return fixedTicketPrice.mul(ticketsPerPosition[_position]);
        }
    }

    function getUserClaimableAmount(address _account) public view returns (uint) {
        if (ticketType == TicketType.FLEXIBLE_BID) {
            return getUserOpenBidTotalClaimableAmount(_account);
        } else {
            return
                (userPosition[_account] > 0 && (userPosition[_account] == winningPosition || winningPosition == CANCELED))
                    ? getWinningAmountPerTicket()
                    : 0;
        }
    }

    /// FLEXIBLE BID FUNCTIONS

    function getUserOpenBidTotalPlacedAmount(address _account) public view returns (uint) {
        uint amount = 0;
        for (uint i = 1; i <= positionCount; i++) {
            amount = amount.add(userOpenBidPosition[_account][i]);
        }
        return amount;
    }

    function getUserOpenBidPositionPlacedAmount(address _account, uint _position) external view returns (uint) {
        return userOpenBidPosition[_account][_position];
    }

    function getAllUserPositions(address _account) external view returns (uint[] memory) {
        uint[] memory userAllPositions = new uint[](positionCount);
        if (positionCount == 0) {
            return userAllPositions;
        }
        if (ticketType == TicketType.FLEXIBLE_BID) {
            for (uint i = 1; i <= positionCount; i++) {
                userAllPositions[i - 1] = userOpenBidPosition[_account][i];
            }
            return userAllPositions;
        } else {
            userAllPositions[userPosition[_account]] = 1;
            return userAllPositions;
        }
    }

    function getUserOpenBidPotentialWinningForPosition(address _account, uint _position) public view returns (uint) {
        if (_position == CANCELED) {
            return getUserOpenBidTotalPlacedAmount(_account);
        }
        return
            userOpenBidPosition[_account][_position].mul(getTotalClaimableAmount()).div(
                totalOpenBidAmountPerPosition[_position]
            );
    }

    function getUserOpenBidTotalClaimableAmount(address _account) public view returns (uint) {
        return getUserOpenBidPotentialWinningForPosition(_account, winningPosition);
    }

    /// FIXED TICKET FUNCTIONS

    function getUserPosition(address _account) external view returns (uint) {
        return userPosition[_account];
    }

    function getUserPositionPhrase(address _account) external view returns (string memory) {
        return (userPosition[_account] > 0) ? positionPhrase[userPosition[_account]] : string("");
    }

    function getPotentialWinningAmountForAllPosition(bool forNewUserView, uint userAlreadyTakenPosition)
        external
        view
        returns (uint[] memory)
    {
        uint[] memory potentialWinning = new uint[](positionCount);
        for (uint i = 1; i <= positionCount; i++) {
            potentialWinning[i - 1] = getPotentialWinningAmountForPosition(i, forNewUserView, userAlreadyTakenPosition == i);
        }
        return potentialWinning;
    }

    function getUserPotentialWinningAmount(address _account) external view returns(uint) {
        return userPosition[_account] > 0 ? getPotentialWinningAmountForPosition(userPosition[_account], false, true) : 0;
    }

    function getPotentialWinningAmountForPosition(
        uint _position,
        bool forNewUserView,
        bool userHasAlreadyTakenThisPosition
    ) internal view returns (uint) {
        if (totalUsersTakenPositions == 0) {
            return 0;
        } else if (ticketsPerPosition[_position] == 0) {
            return
                forNewUserView
                    ? applyDeduction(getTotalPlacedAmount().add(fixedTicketPrice))
                    : applyDeduction(getTotalPlacedAmount());
        } else {
            if (forNewUserView) {
                return
                    applyDeduction(getTotalPlacedAmount().add(fixedTicketPrice)).div(ticketsPerPosition[_position].add(1));
            } else {
                uint calculatedPositions =
                    userHasAlreadyTakenThisPosition && ticketsPerPosition[_position] > 0
                        ? ticketsPerPosition[_position]
                        : ticketsPerPosition[_position].add(1);
                return applyDeduction(getTotalPlacedAmount()).div(calculatedPositions);
            }
        }
    }

    function getWinningAmountPerTicket() public view returns (uint) {
        if (totalUsersTakenPositions == 0 || !resolved || (ticketsPerPosition[winningPosition] == 0)) {
            return 0;
        } else {
            return
                winningPosition == CANCELED
                    ? fixedTicketPrice
                    : getTotalClaimableAmount().div(ticketsPerPosition[winningPosition]);
        }
    }

    function getAlreadyClaimedTickets() external view returns (uint) {
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

    function getTagsCount() external view returns (uint) {
        return tags.length;
    }

    function getTags() external view returns (uint[] memory) {
        return tags;
    }

    function getTicketType() external view returns (uint) {
        return uint(ticketType);
    }

    function getAllAmounts()
        external
        view
        returns (
            uint,
            uint,
            uint,
            uint
        )
    {
        return (fixedBondAmount, disputePrice, safeBoxLowAmount, arbitraryRewardForDisputor);
    }

    function resetForUserAllPositionsToZero(address _account) internal nonReentrant {
        if (positionCount > 0) {
            for (uint i = 1; i <= positionCount; i++) {
                userOpenBidPosition[_account][i] = 0;
            }
        }
    }

    function getAdditionalCreatorAmount() internal view returns (uint) {
        return getTotalPlacedAmount().mul(marketManager.creatorPercentage()).mul(ONE_PERCENT).div(HUNDRED_PERCENT);
    }

    function getAdditionalResolverAmount() internal view returns (uint) {
        return getTotalPlacedAmount().mul(marketManager.resolverPercentage()).mul(ONE_PERCENT).div(HUNDRED_PERCENT);
    }

    function getSafeBoxAmount() internal view returns (uint) {
        return getTotalFeesAmount().sub(getAdditionalCreatorAmount()).sub(getAdditionalResolverAmount());
    }

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
    event OpenBidUserWithdrawn(address account, uint withdrawnAmount, uint totalOpenBidAmountLeft);
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "./OraclePausable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../interfaces/IExoticPositionalMarketManager.sol";
import "../interfaces/IThalesBonds.sol";

contract ExoticPositionalFixedMarket is Initializable, ProxyOwned, OraclePausable, ProxyReentrancyGuard {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    enum TicketType {FIXED_TICKET_PRICE, FLEXIBLE_BID}
    uint private constant HUNDRED = 100;
    uint private constant ONE_PERCENT = 1e16;
    uint private constant HUNDRED_PERCENT = 1e18;
    uint private constant CANCELED = 0;

    uint public creationTime;
    uint public resolvedTime;
    uint public lastDisputeTime;
    uint public positionCount;
    uint public endOfPositioning;
    uint public marketMaturity;
    uint public fixedTicketPrice;
    uint public backstopTimeout;
    uint public totalUsersTakenPositions;
    uint public claimableTicketsCount;
    uint public winningPosition;
    uint public disputeClosedTime;
    uint public fixedBondAmount;
    uint public disputePrice;
    uint public safeBoxLowAmount;
    uint public arbitraryRewardForDisputor;
    uint public withdrawalPeriod;

    bool public noWinners;
    bool public disputed;
    bool public resolved;
    bool public disputedInPositioningPhase;
    bool public feesAndBondsClaimed;
    bool public withdrawalAllowed;

    address public resolverAddress;
    TicketType public ticketType;
    IExoticPositionalMarketManager public marketManager;
    IThalesBonds public thalesBonds;

    mapping(address => uint) public userPosition;
    mapping(address => uint) public userAlreadyClaimed;
    mapping(uint => uint) public ticketsPerPosition;
    mapping(uint => string) public positionPhrase;
    uint[] public tags;
    string public marketQuestion;
    string public marketSource;

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
            "Invalid num of positions"
        );
        require(_tags.length > 0);
        setOwner(msg.sender);
        marketManager = IExoticPositionalMarketManager(msg.sender);
        thalesBonds = IThalesBonds(marketManager.thalesBonds());
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
        withdrawalPeriod = _endOfPositioning.sub(marketManager.withdrawalTimePeriod());
    }

    function takeCreatorInitialPosition(uint _position) external onlyOwner {
        require(_position > 0 && _position <= positionCount, "Value invalid");
        require(ticketType == TicketType.FIXED_TICKET_PRICE, "Not Fixed type");
        address creatorAddress = marketManager.creatorAddress(address(this));
        totalUsersTakenPositions = totalUsersTakenPositions.add(1);
        ticketsPerPosition[_position] = ticketsPerPosition[_position].add(1);
        userPosition[creatorAddress] = _position;
        transferToMarket(creatorAddress, fixedTicketPrice);
        emit NewPositionTaken(creatorAddress, _position, fixedTicketPrice);
    }

    function takeAPosition(uint _position) external notPaused nonReentrant {
        require(_position > 0, "Invalid position");
        require(_position <= positionCount, "Position value invalid");
        require(canUsersPlacePosition(), "Positioning finished/market resolved");
        //require(same position)
        require(ticketType == TicketType.FIXED_TICKET_PRICE, "Not Fixed type");
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

    function withdraw() external notPaused nonReentrant {
        require(withdrawalAllowed, "Not allowed");
        require(canUsersPlacePosition(), "Market resolved");
        require(block.timestamp <= withdrawalPeriod, "Withdrawal expired");
        require(userPosition[msg.sender] > 0, "Not a ticket holder");
        require(msg.sender != marketManager.creatorAddress(address(this)), "Can not withdraw");
        uint withdrawalFee =
            fixedTicketPrice.mul(marketManager.withdrawalPercentage()).mul(ONE_PERCENT).div(HUNDRED_PERCENT);
        totalUsersTakenPositions = totalUsersTakenPositions.sub(1);
        ticketsPerPosition[userPosition[msg.sender]] = ticketsPerPosition[userPosition[msg.sender]].sub(1);
        userPosition[msg.sender] = 0;
        thalesBonds.transferFromMarket(marketManager.safeBoxAddress(), withdrawalFee.div(2));
        thalesBonds.transferFromMarket(marketManager.creatorAddress(address(this)), withdrawalFee.div(2));
        thalesBonds.transferFromMarket(msg.sender, fixedTicketPrice.sub(withdrawalFee));
        emit TicketWithdrawn(msg.sender, fixedTicketPrice.sub(withdrawalFee));
    }

    function issueFees() external notPaused nonReentrant {
        require(canUsersClaim(), "Not finalized");
        require(!feesAndBondsClaimed, "Fees claimed");
        if (winningPosition != CANCELED) {
            thalesBonds.transferFromMarket(marketManager.creatorAddress(address(this)), getAdditionalCreatorAmount());
            thalesBonds.transferFromMarket(resolverAddress, getAdditionalResolverAmount());
            thalesBonds.transferFromMarket(marketManager.safeBoxAddress(), getSafeBoxAmount());
        }
        marketManager.issueBondsBackToCreatorAndResolver(address(this));
        feesAndBondsClaimed = true;
        emit FeesIssued(getTotalFeesAmount());
    }

    // market resolved only through the Manager
    function resolveMarket(uint _outcomePosition, address _resolverAddress) external onlyOwner {
        require(canMarketBeResolvedByOwner(), "Not resolvable. Disputed/not matured");
        require(_outcomePosition <= positionCount, "Outcome exeeds positionNum");
        winningPosition = _outcomePosition;
        if (_outcomePosition == CANCELED) {
            claimableTicketsCount = totalUsersTakenPositions;
            ticketsPerPosition[winningPosition] = totalUsersTakenPositions;
        } else {
            if (ticketsPerPosition[_outcomePosition] == 0) {
                claimableTicketsCount = totalUsersTakenPositions;
                noWinners = true;
            } else {
                claimableTicketsCount = ticketsPerPosition[_outcomePosition];
                noWinners = false;
            }
        }
        resolved = true;
        resolvedTime = block.timestamp;
        resolverAddress = _resolverAddress;
        emit MarketResolved(_outcomePosition, _resolverAddress, noWinners);
    }

    function resetMarket() external onlyOwner {
        require(resolved, "Not resolved");
        if (winningPosition == CANCELED) {
            ticketsPerPosition[winningPosition] = 0;
        }
        winningPosition = 0;
        claimableTicketsCount = 0;
        resolved = false;
        noWinners = false;
        resolvedTime = 0;
        resolverAddress = marketManager.safeBoxAddress();
        emit MarketReset();
    }

    function cancelMarket() external onlyOwner {
        winningPosition = CANCELED;
        claimableTicketsCount = totalUsersTakenPositions;
        ticketsPerPosition[winningPosition] = totalUsersTakenPositions;
        resolved = true;
        noWinners = false;
        resolvedTime = block.timestamp;
        resolverAddress = marketManager.safeBoxAddress();
        emit MarketResolved(CANCELED, msg.sender, noWinners);
    }

    function claimWinningTicket() external notPaused nonReentrant {
        require(canUsersClaim(), "Not finalized.");
        uint amount = getUserClaimableAmount(msg.sender);
        require(amount > 0, "Zero claimable.");
        claimableTicketsCount = claimableTicketsCount.sub(1);
        userPosition[msg.sender] = 0;
        thalesBonds.transferFromMarket(msg.sender, amount);
        if (!feesAndBondsClaimed) {
            if (winningPosition != CANCELED) {
                thalesBonds.transferFromMarket(marketManager.creatorAddress(address(this)), getAdditionalCreatorAmount());
                thalesBonds.transferFromMarket(resolverAddress, getAdditionalResolverAmount());
                thalesBonds.transferFromMarket(marketManager.safeBoxAddress(), getSafeBoxAmount());
            }
            marketManager.issueBondsBackToCreatorAndResolver(address(this));
            feesAndBondsClaimed = true;
            emit FeesIssued(getTotalFeesAmount());
        }
        userAlreadyClaimed[msg.sender] = userAlreadyClaimed[msg.sender].add(amount);
        emit WinningTicketClaimed(msg.sender, amount);
    }

    function claimWinningTicketOnBehalf(address _user) external onlyOwner {
        require(canUsersClaim() || marketManager.cancelledByCreator(address(this)), "Not finalized.");
        uint amount = getUserClaimableAmount(_user);
        require(amount > 0, "Zero claimable.");
        claimableTicketsCount = claimableTicketsCount.sub(1);
        userPosition[_user] = 0;
        thalesBonds.transferFromMarket(_user, amount);
        if (
            winningPosition == CANCELED &&
            marketManager.cancelledByCreator(address(this)) &&
            thalesBonds.getCreatorBondForMarket(address(this)) > 0
        ) {
            marketManager.issueBondsBackToCreatorAndResolver(address(this));
            feesAndBondsClaimed = true;
        } else if (!feesAndBondsClaimed) {
            if (winningPosition != CANCELED) {
                thalesBonds.transferFromMarket(marketManager.creatorAddress(address(this)), getAdditionalCreatorAmount());
                thalesBonds.transferFromMarket(resolverAddress, getAdditionalResolverAmount());
                thalesBonds.transferFromMarket(marketManager.safeBoxAddress(), getSafeBoxAmount());
            }
            marketManager.issueBondsBackToCreatorAndResolver(address(this));
            feesAndBondsClaimed = true;
            emit FeesIssued(getTotalFeesAmount());
        }
        userAlreadyClaimed[msg.sender] = userAlreadyClaimed[msg.sender].add(amount);
        emit WinningTicketClaimed(_user, amount);
    }

    function openDispute() external onlyOwner {
        require(isMarketCreated(), "Not created");
        require(!disputed, "Already disputed");
        disputed = true;
        disputedInPositioningPhase = canUsersPlacePosition();
        lastDisputeTime = block.timestamp;
        emit MarketDisputed(true);
    }

    function closeDispute() external onlyOwner {
        require(disputed, "Not disputed");
        disputeClosedTime = block.timestamp;
        if (disputedInPositioningPhase) {
            disputed = false;
            disputedInPositioningPhase = false;
        } else {
            disputed = false;
        }
        emit MarketDisputed(false);
    }

    function transferToMarket(address _sender, uint _amount) internal notPaused {
        require(_sender != address(0), "Invalid sender");
        require(IERC20(marketManager.paymentToken()).balanceOf(_sender) >= _amount, "Sender balance low");
        require(
            IERC20(marketManager.paymentToken()).allowance(_sender, marketManager.thalesBonds()) >= _amount,
            "No allowance."
        );
        IThalesBonds(marketManager.thalesBonds()).transferToMarket(_sender, _amount);
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
        if (disputed) {
            return false;
        }
        else if (totalUsersTakenPositions != 1) {
            return totalUsersTakenPositions > 1 ? false : true;
        }
        else {
            return userPosition[marketManager.creatorAddress(address(this))] > 0 ? true : false;
        }
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

    function canIssueFees() external view returns (bool) {
        return
            !feesAndBondsClaimed &&
            (thalesBonds.getCreatorBondForMarket(address(this)) > 0 ||
                thalesBonds.getResolverBondForMarket(address(this)) > 0);
    }

    function canUserWithdraw(address _account) public view returns (bool) {
        if (_account == marketManager.creatorAddress(address(this))) {
            return false;
        }
        return
            withdrawalAllowed &&
            canUsersPlacePosition() &&
            userPosition[_account] > 0 &&
            block.timestamp <= withdrawalPeriod;
    }

    function getPositionPhrase(uint index) public view returns (string memory) {
        return (index <= positionCount && index > 0) ? positionPhrase[index] : string("");
    }

    function getTotalPlacedAmount() public view returns (uint) {
        return totalUsersTakenPositions > 0 ? fixedTicketPrice.mul(totalUsersTakenPositions) : 0;
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
        return fixedTicketPrice.mul(ticketsPerPosition[_position]);
    }

    function getUserClaimableAmount(address _account) public view returns (uint) {
        return
            userPosition[_account] > 0 &&
                (noWinners || userPosition[_account] == winningPosition || winningPosition == CANCELED)
                ? getWinningAmountPerTicket()
                : 0;
    }

    /// FLEXIBLE BID FUNCTIONS

    function getAllUserPositions(address _account) external view returns (uint[] memory) {
        uint[] memory userAllPositions = new uint[](positionCount);
        if (positionCount == 0) {
            return userAllPositions;
        }
        userAllPositions[userPosition[_account]] = 1;
        return userAllPositions;
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

    function getUserPotentialWinningAmount(address _account) external view returns (uint) {
        return userPosition[_account] > 0 ? getPotentialWinningAmountForPosition(userPosition[_account], false, true) : 0;
    }

    function getPotentialWinningAmountForPosition(
        uint _position,
        bool forNewUserView,
        bool userHasAlreadyTakenThisPosition
    ) internal view returns (uint) {
        if (totalUsersTakenPositions == 0) {
            return 0;
        }
        if (ticketsPerPosition[_position] == 0) {
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
        if (totalUsersTakenPositions == 0 || !resolved || (!noWinners && (ticketsPerPosition[winningPosition] == 0))) {
            return 0;
        }
        if (noWinners) {
            return getTotalClaimableAmount().div(totalUsersTakenPositions);
        } else {
            return
                winningPosition == CANCELED
                    ? fixedTicketPrice
                    : getTotalClaimableAmount().div(ticketsPerPosition[winningPosition]);
        }
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

    function getAllFees()
        external
        view
        returns (
            uint,
            uint,
            uint,
            uint
        )
    {
        return (getAdditionalCreatorAmount(), getAdditionalResolverAmount(), getSafeBoxAmount(), getTotalFeesAmount());
    }

    function getAdditionalCreatorAmount() internal view returns (uint) {
        return getTotalPlacedAmount().mul(marketManager.creatorPercentage()).mul(ONE_PERCENT).div(HUNDRED_PERCENT);
    }

    function getAdditionalResolverAmount() internal view returns (uint) {
        return getTotalPlacedAmount().mul(marketManager.resolverPercentage()).mul(ONE_PERCENT).div(HUNDRED_PERCENT);
    }

    function getSafeBoxAmount() internal view returns (uint) {
        return getTotalPlacedAmount().mul(marketManager.safeBoxPercentage()).mul(ONE_PERCENT).div(HUNDRED_PERCENT);
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
        // require(bytes(_position).length < marketManager.marketPositionStringLimit(), "Position label exceeds length");
        positionCount = positionCount.add(1);
        positionPhrase[positionCount] = _position;
    }

    event MarketDisputed(bool disputed);
    event MarketCreated(uint creationTime, uint positionCount, bytes32 phrase);
    event MarketResolved(uint winningPosition, address resolverAddress, bool noWinner);
    event MarketReset();
    event WinningTicketClaimed(address account, uint amount);
    event BackstopTimeoutPeriodChanged(uint timeoutPeriod);
    event NewPositionTaken(address account, uint position, uint fixedTicketAmount);
    event TicketWithdrawn(address account, uint amount);
    event BondIncreased(uint amount, uint totalAmount);
    event BondDecreased(uint amount, uint totalAmount);
    event FeesIssued(uint totalFees);
}

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "./OraclePausable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../interfaces/IExoticPositionalMarketManager.sol";
import "../interfaces/IThalesBonds.sol";


contract ExoticPositionalOpenBidMarket is Initializable, ProxyOwned, OraclePausable, ProxyReentrancyGuard {
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
    uint public totalOpenBidAmount;
    uint public claimableOpenBidAmount;
    uint public winningPosition;
    uint public disputeClosedTime;
    uint public fixedBondAmount;
    uint public disputePrice;
    uint public safeBoxLowAmount;
    uint public arbitraryRewardForDisputor;
    uint public withdrawalPeriod;
    uint public maxAmountForOpenBidPosition;
    uint public maxWithdrawPercentage;
    uint public minPosAmount;

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

    mapping(address => uint) public totalUserPlacedAmount;
    mapping(address => mapping(uint => uint)) public userOpenBidPosition;
    mapping(address => uint) public userAlreadyClaimed;
    mapping(uint => uint) public totalOpenBidAmountPerPosition;
    mapping(uint => string) public positionPhrase;
    mapping(address => bool) public withrawalRestrictedForUser;
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
            "Invalid num pos"
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
        maxAmountForOpenBidPosition = marketManager.maxAmountForOpenBidPosition();
        maxWithdrawPercentage = marketManager.maxFinalWithdrawPercentage();
        fixedBondAmount = marketManager.fixedBondAmount();
        disputePrice = marketManager.disputePrice();
        safeBoxLowAmount = marketManager.safeBoxLowAmount();
        arbitraryRewardForDisputor = marketManager.arbitraryRewardForDisputor();
        withdrawalPeriod = block.timestamp.add(_endOfPositioning).sub(marketManager.withdrawalTimePeriod());
        minPosAmount = marketManager.minFixedTicketPrice();
    }

    function takeCreatorInitialOpenBidPositions(uint[] memory _positions, uint[] memory _amounts) external onlyOwner {
        require(_positions.length > 0 && _positions.length <= positionCount, "Invalid posNum");
        require(ticketType == TicketType.FLEXIBLE_BID, "Not OpenBid");
        uint totalDepositedAmount = 0;
        address creatorAddress = marketManager.creatorAddress(address(this));
        for (uint i = 0; i < _positions.length; i++) {
            require(_positions[i] > 0, "Non-zero expected");
            require(_positions[i] <= positionCount, "Value invalid");
            require(_amounts[i] == 0 || (_amounts[i] >= minPosAmount && _amounts[i] <= maxAmountForOpenBidPosition),"Amounts exceed");
                totalOpenBidAmountPerPosition[_positions[i]] = totalOpenBidAmountPerPosition[_positions[i]].add(_amounts[i]);
                userOpenBidPosition[creatorAddress][_positions[i]] = userOpenBidPosition[creatorAddress][_positions[i]].add(
                    _amounts[i]
                );
                totalDepositedAmount = totalDepositedAmount.add(_amounts[i]);
        }
        require(totalUserPlacedAmount[creatorAddress].add(totalDepositedAmount) >= minPosAmount &&
            totalUserPlacedAmount[creatorAddress].add(totalDepositedAmount) <= maxAmountForOpenBidPosition,
            "Amounts exceed"
        );
        totalOpenBidAmount = totalOpenBidAmount.add(totalDepositedAmount);
        totalUserPlacedAmount[creatorAddress] = totalUserPlacedAmount[creatorAddress].add(totalDepositedAmount);
        totalUsersTakenPositions = totalUsersTakenPositions.add(1);
        transferToMarket(creatorAddress, totalDepositedAmount);
        emit NewOpenBidsForPositions(creatorAddress, _positions, _amounts);
    }

    function takeOpenBidPositions(uint[] memory _positions, uint[] memory _amounts) external notPaused nonReentrant {
        require(_positions.length > 0, "Invalid posNum");
        require(_positions.length <= positionCount, "Exceeds count");
        require(canUsersPlacePosition(), "Market resolved");
        require(ticketType == TicketType.FLEXIBLE_BID, "Not OpenBid");
        if(block.timestamp.add(1 days) > endOfPositioning) {
            if(totalUserPlacedAmount[msg.sender] > 0) {
                require(
                    totalUserPlacedAmount[msg.sender] <=
                    totalOpenBidAmount.mul(maxWithdrawPercentage.mul(ONE_PERCENT)).div(HUNDRED_PERCENT),
                    "Exceeds reposition"
                );
            }
        }
        uint totalDepositedAmount = 0;
        bool firstTime = true;
        for (uint i = 0; i < _positions.length; i++) {
            require(_positions[i] > 0, "Non-zero expected");
            require(_positions[i] <= positionCount, "Value invalid");
            require(_amounts[i] == 0 || (_amounts[i] >= minPosAmount && _amounts[i] <= maxAmountForOpenBidPosition), "Amounts exceed");
                if (userOpenBidPosition[msg.sender][_positions[i]] > 0) {
                        totalOpenBidAmountPerPosition[_positions[i]] = totalOpenBidAmountPerPosition[_positions[i]].sub(userOpenBidPosition[msg.sender][_positions[i]]);
                        firstTime = false;
                }
                totalOpenBidAmountPerPosition[_positions[i]] = totalOpenBidAmountPerPosition[_positions[i]].add(_amounts[i]);
                userOpenBidPosition[msg.sender][_positions[i]] = _amounts[i];
                totalDepositedAmount = totalDepositedAmount.add(_amounts[i]);
        }
        require(totalDepositedAmount >= minPosAmount && totalDepositedAmount >= totalUserPlacedAmount[msg.sender], "Bellow init amounts");
        uint amountToBeAdded = totalDepositedAmount.sub(totalUserPlacedAmount[msg.sender]);
        require(
            amountToBeAdded <= maxAmountForOpenBidPosition,
            "Amounts exceed"
        );
        if(amountToBeAdded > 0) {
            totalOpenBidAmount = totalOpenBidAmount.add(amountToBeAdded);
            totalUserPlacedAmount[msg.sender] = totalUserPlacedAmount[msg.sender].add(amountToBeAdded);
            totalUsersTakenPositions = firstTime ? totalUsersTakenPositions.add(1) : totalUsersTakenPositions;
            transferToMarket(msg.sender, amountToBeAdded);
        }
        emit NewOpenBidsForPositions(msg.sender, _positions, _amounts);
    }

    function withdraw(uint _openBidPosition) external notPaused nonReentrant {
        require(withdrawalAllowed, "Not allowed");
        require(canUsersPlacePosition(), "Market resolved");
        require(block.timestamp <= withdrawalPeriod, "Withdrawal expired");
        require(msg.sender != marketManager.creatorAddress(address(this)), "Creator forbidden");
        uint totalToWithdraw;
        if (_openBidPosition == 0) {
            for (uint i = 1; i <= positionCount; i++) {
                if (userOpenBidPosition[msg.sender][i] > 0) {
                    totalToWithdraw = totalToWithdraw.add(userOpenBidPosition[msg.sender][i]);
                    totalOpenBidAmountPerPosition[i] = totalOpenBidAmountPerPosition[i].sub(userOpenBidPosition[msg.sender][i]);
                    userOpenBidPosition[msg.sender][i] = 0;
                }
            }
        } else {
            require(userOpenBidPosition[msg.sender][_openBidPosition] > 0, "No amount for position");
            totalOpenBidAmountPerPosition[_openBidPosition] = totalOpenBidAmountPerPosition[_openBidPosition].sub(userOpenBidPosition[msg.sender][_openBidPosition]);
            totalToWithdraw = userOpenBidPosition[msg.sender][_openBidPosition];
            userOpenBidPosition[msg.sender][_openBidPosition] = 0;
        }
        if (block.timestamp.add(1 days) > endOfPositioning && block.timestamp <= endOfPositioning) {
            require(!withrawalRestrictedForUser[msg.sender], "Already withdrawn");
            require(
                totalToWithdraw <=
                    totalUserPlacedAmount[msg.sender].mul(maxWithdrawPercentage.mul(ONE_PERCENT)).div(HUNDRED_PERCENT),
                "Exceeds withdraw limit"
            );
            withrawalRestrictedForUser[msg.sender] = true;
        }
        if (getUserOpenBidTotalPlacedAmount(msg.sender) == 0) {
            totalUsersTakenPositions = totalUsersTakenPositions.sub(1);
        }
        totalOpenBidAmount = totalOpenBidAmount.sub(totalToWithdraw);
        totalUserPlacedAmount[msg.sender] = totalUserPlacedAmount[msg.sender].sub(totalToWithdraw);
        uint withdrawalFee = totalToWithdraw.mul(marketManager.withdrawalPercentage()).mul(ONE_PERCENT).div(HUNDRED_PERCENT);
        thalesBonds.transferFromMarket(marketManager.safeBoxAddress(), withdrawalFee.div(2));
        thalesBonds.transferFromMarket(marketManager.creatorAddress(address(this)), withdrawalFee.div(2));
        thalesBonds.transferFromMarket(msg.sender, totalToWithdraw.sub(withdrawalFee));
        emit OpenBidUserWithdrawn(msg.sender, _openBidPosition, totalToWithdraw.sub(withdrawalFee), totalOpenBidAmount);
    }

    function resolveMarket(uint _outcomePosition, address _resolverAddress) external onlyOwner {
        require(canMarketBeResolvedByOwner(), "Disputed/not matured");
        require(_outcomePosition <= positionCount, "Outcome exeeds positionNum");
        winningPosition = _outcomePosition;
        if (_outcomePosition == CANCELED) {
            claimableOpenBidAmount = totalOpenBidAmount;
            totalOpenBidAmountPerPosition[_outcomePosition] = totalOpenBidAmount;
        } else {
            claimableOpenBidAmount = getTotalClaimableAmount();
            if (totalOpenBidAmountPerPosition[_outcomePosition] == 0) {
                noWinners = true;
            } else {
                noWinners = false;
            }
        }
        resolved = true;
        resolvedTime = block.timestamp;
        resolverAddress = _resolverAddress;
        emit MarketResolved(_outcomePosition, _resolverAddress, noWinners);
    }

    function resetMarket() external onlyOwner {
        require(resolved, "Market is not resolved");
        if (winningPosition == CANCELED) {
            totalOpenBidAmountPerPosition[winningPosition] = 0;
        }
        winningPosition = 0;
        claimableOpenBidAmount = 0;
        resolved = false;
        noWinners = false;
        resolvedTime = 0;
        resolverAddress = marketManager.safeBoxAddress();
        emit MarketReset();
    }

    function cancelMarket() external onlyOwner {
        winningPosition = CANCELED;
        claimableOpenBidAmount = totalOpenBidAmount;
        totalOpenBidAmountPerPosition[winningPosition] = totalOpenBidAmount;
        resolved = true;
        resolvedTime = block.timestamp;
        resolverAddress = marketManager.safeBoxAddress();
        emit MarketResolved(CANCELED, msg.sender, noWinners);
    }

    function claimWinningTicket() external notPaused nonReentrant {
        require(canUsersClaim(), "Market not finalized");
        uint amount = getUserClaimableAmount(msg.sender);
        require(amount > 0, "Claimable amount is zero.");
        claimableOpenBidAmount = claimableOpenBidAmount.sub(amount);
        resetForUserAllPositionsToZero(msg.sender);
        thalesBonds.transferFromMarket(msg.sender, amount);
        _issueFees();
        userAlreadyClaimed[msg.sender] = userAlreadyClaimed[msg.sender].add(amount);
        emit WinningOpenBidAmountClaimed(msg.sender, amount);
    }

    function claimWinningTicketOnBehalf(address _user) external onlyOwner {
        require(canUsersClaim() || marketManager.cancelledByCreator(address(this)), "Market not finalized");
        uint amount = getUserClaimableAmount(_user);
        require(amount > 0, "Claimable amount is zero.");
        claimableOpenBidAmount = claimableOpenBidAmount.sub(amount);
        resetForUserAllPositionsToZero(_user);
        thalesBonds.transferFromMarket(_user, amount);
        _issueFees();
        userAlreadyClaimed[msg.sender] = userAlreadyClaimed[msg.sender].add(amount);
        emit WinningOpenBidAmountClaimed(_user, amount);
    }

    function issueFees() external notPaused nonReentrant {
        _issueFees();
    }

    function _issueFees() internal {
        require(canUsersClaim() || marketManager.cancelledByCreator(address(this)), "Not finalized");
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

    function transferToMarket(address _sender, uint _amount) internal notPaused {
        require(_sender != address(0), "Invalid sender address");
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
        else if (totalUsersTakenPositions == 1) {
            return true;
        }
        else {
            return false;
            // return totalOpenBidAmount == getUserOpenBidTotalPlacedAmount(marketManager.creatorAddress(address(this)))
            //         ? true
            //         : false;
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

    function canUserWithdraw(address _account) public view returns (bool) {
        if (_account == marketManager.creatorAddress(address(this))) {
            return false;
        }
        return
            withdrawalAllowed &&
            canUsersPlacePosition() &&
            getUserOpenBidTotalPlacedAmount(_account) > 0 &&
            !withrawalRestrictedForUser[_account] &&
            block.timestamp <= withdrawalPeriod;
    }

    function canIssueFees() external view returns (bool) {
        return
            !feesAndBondsClaimed &&
            (thalesBonds.getCreatorBondForMarket(address(this)) > 0 ||
                thalesBonds.getResolverBondForMarket(address(this)) > 0);
    }

    function getPositionPhrase(uint index) public view returns (string memory) {
        return (index <= positionCount && index > 0) ? positionPhrase[index] : string("");
    }

    function getTotalPlacedAmount() public view returns (uint) {
        return totalOpenBidAmount;
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
        return totalOpenBidAmountPerPosition[_position];
    }

    function getUserClaimableAmount(address _account) public view returns (uint) {
        return getUserOpenBidTotalClaimableAmount(_account);
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
        for (uint i = 1; i <= positionCount; i++) {
            userAllPositions[i - 1] = userOpenBidPosition[_account][i];
        }
        return userAllPositions;
    }

    function getUserOpenBidPotentialWinningForPosition(address _account, uint _position) public view returns (uint) {
        if (_position == CANCELED) {
            return getUserOpenBidTotalPlacedAmount(_account);
        }
        return
            totalOpenBidAmountPerPosition[_position] > 0
                ? userOpenBidPosition[_account][_position].mul(getTotalClaimableAmount()).div(
                    totalOpenBidAmountPerPosition[_position]
                )
                : 0;
    }

    function getUserOpenBidTotalClaimableAmount(address _account) public view returns (uint) {
        if (noWinners) {
            return applyDeduction(getUserOpenBidTotalPlacedAmount(_account));
        }
        return getUserOpenBidPotentialWinningForPosition(_account, winningPosition);
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

    function getUserPotentialWinningAmountForAllPosition(address _account) external view returns (uint[] memory) {
        uint[] memory potentialWinning = new uint[](positionCount);
        bool forNewUserView = getUserOpenBidTotalPlacedAmount(_account) > 0;
        for (uint i = 1; i <= positionCount; i++) {
            potentialWinning[i - 1] = getPotentialWinningAmountForPosition(
                i,
                forNewUserView,
                userOpenBidPosition[_account][i] > 0
            );
        }
        return potentialWinning;
    }

    function getUserPotentialWinningAmount(address _account) external view returns (uint) {
        uint maxWin;
        uint amount;
        for (uint i = 1; i <= positionCount; i++) {
            amount = getPotentialWinningAmountForPosition(userOpenBidPosition[_account][i], false, true);
            if (amount > maxWin) {
                maxWin = amount;
            }
        }
        return maxWin;
    }

    function getPotentialWinningAmountForPosition(
        uint _position,
        bool forNewUserView,
        bool userHasAlreadyTakenThisPosition
    ) internal view returns (uint) {
        if (totalUsersTakenPositions == 0) {
            return 0;
        }
        if (totalOpenBidAmountPerPosition[_position] == 0) {
            return forNewUserView ? applyDeduction(totalOpenBidAmount.add(minPosAmount)) : applyDeduction(totalOpenBidAmount);
        } else {
            if (forNewUserView) {
                return applyDeduction(totalOpenBidAmount.add(minPosAmount)).div(totalOpenBidAmountPerPosition[_position].add(minPosAmount));
            } else {
                uint calculatedPositions =
                    userHasAlreadyTakenThisPosition && totalOpenBidAmountPerPosition[_position] > 0
                        ? totalOpenBidAmountPerPosition[_position]
                        : totalOpenBidAmountPerPosition[_position].add(minPosAmount);
                return applyDeduction(totalOpenBidAmount).div(calculatedPositions);
            }
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

    function resetForUserAllPositionsToZero(address _account) internal {
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
        ticketType = _fixedTicketPrice > 0 ? TicketType.FIXED_TICKET_PRICE : TicketType.FLEXIBLE_BID;
        withdrawalAllowed = _withdrawalAllowed;
        tags = _tags;
        _addPosition(_positionPhrase1);
        _addPosition(_positionPhrase2);
    }

    function _addPosition(string memory _position) internal {
        require(keccak256(abi.encode(_position)) != keccak256(abi.encode("")), "Invalid position label (empty string)");
        positionCount = positionCount.add(1);
        positionPhrase[positionCount] = _position;
    }

    event MarketDisputed(bool disputed);
    event MarketCreated(uint creationTime, uint positionCount, bytes32 phrase);
    event MarketResolved(uint winningPosition, address resolverAddress, bool noWinner);
    event MarketReset();
    event WinningOpenBidAmountClaimed(address account, uint amount);
    event BackstopTimeoutPeriodChanged(uint timeoutPeriod);
    event TicketWithdrawn(address account, uint amount);
    event BondIncreased(uint amount, uint totalAmount);
    event BondDecreased(uint amount, uint totalAmount);
    event NewOpenBidsForPositions(address account, uint[] openBidPositions, uint[] openBidAmounts);
    event OpenBidUserWithdrawn(address account, uint position, uint withdrawnAmount, uint totalOpenBidAmountLeft);
    event FeesIssued(uint totalFees);
}

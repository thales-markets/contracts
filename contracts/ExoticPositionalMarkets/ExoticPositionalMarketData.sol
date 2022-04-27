pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../interfaces/IExoticPositionalMarketManager.sol";
import "../interfaces/IExoticPositionalMarket.sol";

contract ExoticPositionalMarketData is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    using SafeMathUpgradeable for uint;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct MarketData {
        string marketQuestion;
        string marketSource;
        uint ticketType;
        uint endOfPositioning;
        uint fixedTicketPrice;
        uint creationTime;
        bool withdrawalAllowed;
        bool disputed;
        bool resolved;
        uint resolvedTime;
        string[] positionPhrasesList;
        uint[] tags;
        uint totalPlacedAmount;
        uint totalClaimableAmount;
        uint[] amountsPerPosition;
        bool canUsersPlacePosition;
        bool canMarketBeResolved;
        bool canMarketBeResolvedByPDAO;
        bool canUsersClaim;
        bool isCancelled;
        bool paused;
        uint winningPosition;
        address creatorAddress;
        address resolverAddress;
        uint fixedBondAmount;
        uint disputePrice;
        uint safeBoxLowAmount;
        uint arbitraryRewardForDisputor;
        uint backstopTimeout;
        uint disputeClosedTime;
        bool canCreatorCancelMarket;
        uint totalUsersTakenPositions;
        bool noWinners;
        bool canIssueFees;
        uint creatorFee;
        uint resolverFee;
        uint safeBoxFee;
        uint totalFee;
    }

    address public marketManagerAddress;

    function initialize(address _owner, address _marketManagerAddress) public initializer {
        setOwner(_owner);
        initNonReentrant();
        marketManagerAddress = _marketManagerAddress;
    }

    function setMarketManager(address _marketManagerAddress) external onlyOwner {
        require(_marketManagerAddress != address(0), "Invalid address");
        marketManagerAddress = _marketManagerAddress;
        emit NewMarketManagerAddress(_marketManagerAddress);
    }

    function getAllMarketData(address _market) external view returns (MarketData memory) {
        uint positionCount = IExoticPositionalMarket(_market).positionCount();
        IExoticPositionalMarket market = IExoticPositionalMarket(_market);
        MarketData memory marketData;
        marketData.marketQuestion = market.marketQuestion();
        marketData.marketSource = market.marketSource();
        marketData.ticketType = market.getTicketType();
        marketData.endOfPositioning = market.endOfPositioning();
        marketData.fixedTicketPrice = market.fixedTicketPrice();
        marketData.creationTime = market.creationTime();
        marketData.withdrawalAllowed = market.withdrawalAllowed();
        marketData.disputed = market.disputed();
        marketData.resolved = market.resolved();
        marketData.resolvedTime = market.resolvedTime();
        marketData.paused = market.paused();
        marketData.winningPosition = market.winningPosition();
        marketData.fixedBondAmount = market.fixedBondAmount();
        marketData.disputePrice = market.disputePrice();
        marketData.safeBoxLowAmount = market.safeBoxLowAmount();
        marketData.arbitraryRewardForDisputor = market.arbitraryRewardForDisputor();
        marketData.backstopTimeout = market.backstopTimeout();
        marketData.disputeClosedTime = market.disputeClosedTime();
        marketData.totalPlacedAmount = market.getTotalPlacedAmount();
        marketData.totalClaimableAmount = market.getTotalClaimableAmount();
        marketData.canUsersPlacePosition = market.canUsersPlacePosition();
        marketData.canMarketBeResolved = market.canMarketBeResolved();
        marketData.canMarketBeResolvedByPDAO = market.canMarketBeResolvedByPDAO();
        marketData.canUsersClaim = market.canUsersClaim();
        marketData.isCancelled = market.isMarketCancelled();
        marketData.creatorAddress = IExoticPositionalMarketManager(marketManagerAddress).creatorAddress(_market);
        marketData.resolverAddress = IExoticPositionalMarketManager(marketManagerAddress).resolverAddress(_market);
        marketData.canCreatorCancelMarket = market.canCreatorCancelMarket();
        marketData.tags = market.getTags();
        marketData.totalUsersTakenPositions = market.totalUsersTakenPositions();
        marketData.noWinners = market.noWinners();
        (marketData.creatorFee, marketData.resolverFee, marketData.safeBoxFee, marketData.totalFee) = market.getAllFees();
        marketData.canIssueFees = market.canIssueFees();

        string[] memory positionPhrasesList = new string[](positionCount);
        uint[] memory amountsPerPosition = new uint[](positionCount);
        if (positionCount > 0) {
            for (uint i = 1; i <= positionCount; i++) {
                positionPhrasesList[i - 1] = market.positionPhrase(i);
                amountsPerPosition[i - 1] = market.getPlacedAmountPerPosition(i);
            }
        }
        marketData.positionPhrasesList = positionPhrasesList;
        marketData.amountsPerPosition = amountsPerPosition;
        return marketData;
    }

    event NewMarketManagerAddress(address _marketManagerAddress);
}

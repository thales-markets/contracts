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
        string[] memory positionPhrasesList = new string[](positionCount);
        uint[] memory amountsPerPosition = new uint[](positionCount);
        if (positionCount > 0) {
            for (uint i = 1; i <= positionCount; i++) {
                positionPhrasesList[i - 1] = IExoticPositionalMarket(_market).positionPhrase(i);
                amountsPerPosition[i - 1] = IExoticPositionalMarket(_market).getPlacedAmountPerPosition(i);
            }
        }
        MarketData memory marketData;
        marketData.marketQuestion = IExoticPositionalMarket(_market).marketQuestion();
        marketData.marketSource = IExoticPositionalMarket(_market).marketSource();
        marketData.ticketType = IExoticPositionalMarket(_market).getTicketType();
        marketData.endOfPositioning = IExoticPositionalMarket(_market).endOfPositioning();
        marketData.fixedTicketPrice = IExoticPositionalMarket(_market).fixedTicketPrice();
        marketData.creationTime = IExoticPositionalMarket(_market).creationTime();
        marketData.withdrawalAllowed = IExoticPositionalMarket(_market).withdrawalAllowed();
        marketData.disputed = IExoticPositionalMarket(_market).disputed();
        marketData.resolved = IExoticPositionalMarket(_market).resolved();
        marketData.resolvedTime = IExoticPositionalMarket(_market).resolvedTime();
        marketData.positionPhrasesList = positionPhrasesList;
        marketData.tags = IExoticPositionalMarket(_market).tags();
        marketData.totalPlacedAmount = IExoticPositionalMarket(_market).getTotalPlacedAmount();
        marketData.totalClaimableAmount = IExoticPositionalMarket(_market).getTotalClaimableAmount();
        marketData.amountsPerPosition = amountsPerPosition;
        marketData.canUsersPlacePosition = IExoticPositionalMarket(_market).canUsersPlacePosition();
        marketData.canMarketBeResolved = IExoticPositionalMarket(_market).canMarketBeResolved();
        marketData.canMarketBeResolvedByPDAO = IExoticPositionalMarket(_market).canMarketBeResolvedByPDAO();
        marketData.canUsersClaim = IExoticPositionalMarket(_market).canUsersClaim();
        marketData.isCancelled = IExoticPositionalMarket(_market).isMarketCancelled();
        marketData.paused = IExoticPositionalMarket(_market).paused();
        marketData.winningPosition = IExoticPositionalMarket(_market).winningPosition();
        marketData.creatorAddress = IExoticPositionalMarketManager(marketManagerAddress).creatorAddress(address(this));
        marketData.resolverAddress = IExoticPositionalMarketManager(marketManagerAddress).resolverAddress(address(this));
        marketData.fixedBondAmount = IExoticPositionalMarket(_market).fixedBondAmount();
        marketData.disputePrice = IExoticPositionalMarket(_market).disputePrice();
        marketData.safeBoxLowAmount = IExoticPositionalMarket(_market).safeBoxLowAmount();
        marketData.arbitraryRewardForDisputor = IExoticPositionalMarket(_market).arbitraryRewardForDisputor();
        marketData.backstopTimeout = IExoticPositionalMarket(_market).backstopTimeout();
        marketData.disputeClosedTime = IExoticPositionalMarket(_market).disputeClosedTime();
        marketData.canCreatorCancelMarket = IExoticPositionalMarket(_market).canCreatorCancelMarket();
        return marketData;
    }

    event NewMarketManagerAddress(address _marketManagerAddress);
}

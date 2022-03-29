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

contract ThalesBonds is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    using SafeMathUpgradeable for uint;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IExoticPositionalMarketManager public marketManager;
    struct MarketBond {
        uint totalDepositedMarketBond;
        uint totalMarketBond;
        uint creatorBond;
        uint resolverBond;
        uint disputorsTotalBond;
        uint disputorsCount;
        mapping(address => uint) disputorBond;
    }

    mapping(address => MarketBond) public marketBond;
    mapping(address => uint) public marketFunds;

    uint private constant CREATOR_BOND = 101;
    uint private constant RESOLVER_BOND = 102;
    uint private constant DISPUTOR_BOND = 103;
    uint private constant CREATOR_AND_DISPUTOR = 104;
    uint private constant RESOLVER_AND_DISPUTOR = 105;

    function initialize(address _owner) public initializer {
        setOwner(_owner);
        initNonReentrant();
    }

    function getTotalDepositedBondAmountForMarket(address _market) external view returns (uint) {
        return marketBond[_market].totalDepositedMarketBond;
    }

    function getClaimedBondAmountForMarket(address _market) external view returns (uint) {
        return marketBond[_market].totalDepositedMarketBond.sub(marketBond[_market].totalMarketBond);
    }

    function getClaimableBondAmountForMarket(address _market) external view returns (uint) {
        return marketBond[_market].totalMarketBond;
    }

    function getDisputorBondForMarket(address _market, address _disputorAddress) external view returns (uint) {
        return marketBond[_market].disputorBond[_disputorAddress];
    }

    function getCreatorBondForMarket(address _market) external view returns (uint) {
        return marketBond[_market].creatorBond;
    }

    function getResolverBondForMarket(address _market) external view returns (uint) {
        return marketBond[_market].resolverBond;
    }

    // different deposit functions to flag the bond amount : creator
    function sendCreatorBondToMarket(
        address _market,
        address _creatorAddress,
        uint _amount
    ) external onlyOracleCouncilManagerAndOwner nonReentrant {
        require(_amount > 0, "Bond Amount can not be zero");
        require(_market != address(0), "Invalid market address");
        marketBond[_market].creatorBond = _amount;
        marketBond[_market].totalMarketBond = marketBond[_market].totalMarketBond.add(_amount);
        marketBond[_market].totalDepositedMarketBond = marketBond[_market].totalDepositedMarketBond.add(_amount);
        transferToMarketBond(_creatorAddress, _amount);
        emit CreatorBondSent(_market, _creatorAddress, _amount);
    }

    // different deposit functions to flag the bond amount : resolver
    function sendResolverBondToMarket(
        address _market,
        address _resolverAddress,
        uint _amount
    ) external onlyOracleCouncilManagerAndOwner nonReentrant {
        require(_amount > 0, "Bond Amount can not be zero");
        require(_market != address(0), "Invalid market address");
        // in case the creator is the resolver, move the bond to the resolver
        if (marketManager.creatorAddress(_market) == _resolverAddress) {
            marketBond[_market].resolverBond = marketBond[_market].creatorBond;
            marketBond[_market].creatorBond = 0;
        } else {
            marketBond[_market].resolverBond = _amount;
            marketBond[_market].totalMarketBond = marketBond[_market].totalMarketBond.add(_amount);
            marketBond[_market].totalDepositedMarketBond = marketBond[_market].totalDepositedMarketBond.add(_amount);
            transferToMarketBond(_resolverAddress, _amount);
        }
        emit ResolverBondSent(_market, _resolverAddress, _amount);
    }

    // different deposit functions to flag the bond amount : disputor
    function sendDisputorBondToMarket(
        address _market,
        address _disputorAddress,
        uint _amount
    ) external onlyOracleCouncilManagerAndOwner nonReentrant {
        require(_amount > 0, "Bond Amount can not be zero");
        require(_market != address(0), "Invalid market address");

        // if it is first dispute for the disputor, the counter is increased
        if (marketBond[_market].disputorBond[_disputorAddress] == 0) {
            marketBond[_market].disputorsCount = marketBond[_market].disputorsCount.add(1);
        }
        marketBond[_market].disputorBond[_disputorAddress] = marketBond[_market].disputorBond[_disputorAddress].add(_amount);
        marketBond[_market].disputorsTotalBond = marketBond[_market].disputorsTotalBond.add(_amount);
        marketBond[_market].totalMarketBond = marketBond[_market].totalMarketBond.add(_amount);
        marketBond[_market].totalDepositedMarketBond = marketBond[_market].totalDepositedMarketBond.add(_amount);
        transferToMarketBond(_disputorAddress, _amount);
        emit DisputorBondSent(_market, _disputorAddress, _amount);
    }

    // universal claiming amount function to adapt for different scenarios, e.g. SafeBox
    function sendBondFromMarketToUser(
        address _market,
        address _account,
        uint _amount,
        uint _bondToReduce,
        address _disputorAddress
    ) external onlyOracleCouncilManagerAndOwner nonReentrant {
        require(_amount <= marketBond[_market].totalMarketBond, "Exceeds total market bond");
        require(_bondToReduce >= CREATOR_BOND && _bondToReduce <= RESOLVER_AND_DISPUTOR, "Invalid bondToReduce");
        if (_bondToReduce == CREATOR_BOND && _amount <= marketBond[_market].creatorBond) {
            marketBond[_market].creatorBond = marketBond[_market].creatorBond.sub(_amount);
        } else if (_bondToReduce == RESOLVER_BOND && _amount <= marketBond[_market].resolverBond) {
            marketBond[_market].resolverBond = marketBond[_market].resolverBond.sub(_amount);
        } else if (
            _bondToReduce == DISPUTOR_BOND &&
            marketBond[_market].disputorBond[_disputorAddress] >= 0 &&
            _amount <= IExoticPositionalMarket(_market).disputePrice()
        ) {
            marketBond[_market].disputorBond[_disputorAddress] = marketBond[_market].disputorBond[_disputorAddress].sub(
                _amount
            );
            marketBond[_market].disputorsCount = marketBond[_market].disputorBond[_account] > 0
                ? marketBond[_market].disputorsCount
                : marketBond[_market].disputorsCount.sub(1);
        } else if (
            _bondToReduce == CREATOR_AND_DISPUTOR &&
            _amount <= marketBond[_market].creatorBond.add(IExoticPositionalMarket(_market).disputePrice()) &&
            _amount > marketBond[_market].creatorBond
        ) {
            marketBond[_market].disputorBond[_disputorAddress] = marketBond[_market].disputorBond[_disputorAddress].sub(
                _amount.sub(marketBond[_market].creatorBond)
            );
            marketBond[_market].creatorBond = 0;
            marketBond[_market].disputorsCount = marketBond[_market].disputorBond[_account] > 0
                ? marketBond[_market].disputorsCount
                : marketBond[_market].disputorsCount.sub(1);
        } else if (
            _bondToReduce == RESOLVER_AND_DISPUTOR &&
            _amount <= marketBond[_market].resolverBond.add(IExoticPositionalMarket(_market).disputePrice()) &&
            _amount > marketBond[_market].resolverBond
        ) {
            marketBond[_market].disputorBond[_disputorAddress] = marketBond[_market].disputorBond[_disputorAddress].sub(
                _amount.sub(marketBond[_market].resolverBond)
            );
            marketBond[_market].resolverBond = 0;
            marketBond[_market].disputorsCount = marketBond[_market].disputorBond[_account] > 0
                ? marketBond[_market].disputorsCount
                : marketBond[_market].disputorsCount.sub(1);
        }
        marketBond[_market].totalMarketBond = marketBond[_market].totalMarketBond.sub(_amount);
        transferBondFromMarket(_account, _amount);
        emit BondTransferredFromMarketBondToUser(_market, _account, _amount);
    }

    function sendOpenDisputeBondFromMarketToDisputor(
        address _market,
        address _account,
        uint _amount
    ) external onlyOracleCouncilManagerAndOwner nonReentrant {
        require(_amount <= marketBond[_market].totalMarketBond, "Exceeds total market bond");
        marketBond[_market].totalMarketBond = marketBond[_market].totalMarketBond.sub(_amount);
        require(
            marketBond[_market].disputorsCount > 0 && marketBond[_market].disputorBond[_account] >= _amount,
            "Disputor already claimed its funds"
        );
        marketBond[_market].disputorBond[_account] = marketBond[_market].disputorBond[_account].sub(_amount);
        marketBond[_market].disputorsCount = marketBond[_market].disputorsCount.sub(1);
        transferBondFromMarket(_account, _amount);
        emit BondTransferredFromMarketBondToUser(_market, _account, _amount);
    }

    function issueBondsBackToCreatorAndResolver(address _market) external onlyOracleCouncilManagerAndOwner nonReentrant {
        uint totalIssuedBack;
        if (marketBond[_market].totalMarketBond >= marketBond[_market].creatorBond.add(marketBond[_market].resolverBond)) {
            marketBond[_market].totalMarketBond = marketBond[_market].totalMarketBond.sub(
                marketBond[_market].creatorBond.add(marketBond[_market].resolverBond)
            );
            if (
                marketManager.creatorAddress(_market) != marketManager.resolverAddress(_market) &&
                marketBond[_market].creatorBond > 0
            ) {
                totalIssuedBack = marketBond[_market].creatorBond;
                marketBond[_market].creatorBond = 0;
                transferBondFromMarket(marketManager.creatorAddress(_market), totalIssuedBack);
                emit BondTransferredFromMarketBondToUser(_market, marketManager.creatorAddress(_market), totalIssuedBack);
            }
            if (marketBond[_market].resolverBond > 0) {
                totalIssuedBack = marketBond[_market].resolverBond;
                marketBond[_market].resolverBond = 0;
                transferBondFromMarket(marketManager.resolverAddress(_market), totalIssuedBack);
                emit BondTransferredFromMarketBondToUser(_market, marketManager.resolverAddress(_market), totalIssuedBack);
            }
        }
    }

    function transferToMarket(address _account, uint _amount) external whenNotPaused {
        require(marketManager.isActiveMarket(msg.sender), "Caller is not an active market.");
        marketFunds[msg.sender] = marketFunds[msg.sender].add(_amount);
        transferToMarketBond(_account, _amount);
    }

    function transferFromMarket(address _account, uint _amount) external whenNotPaused {
        require(marketFunds[msg.sender] >= _amount, "insufficient market funds");
        marketFunds[msg.sender] = marketFunds[msg.sender].sub(_amount);
        transferBondFromMarket(_account, _amount);
    }

    function transferToMarketBond(address _account, uint _amount) internal whenNotPaused {
        IERC20Upgradeable(marketManager.paymentToken()).safeTransferFrom(_account, address(this), _amount);
    }

    function transferBondFromMarket(address _account, uint _amount) internal whenNotPaused {
        IERC20Upgradeable(marketManager.paymentToken()).safeTransfer(_account, _amount);
    }

    function setMarketManager(address _managerAddress) external onlyOwner {
        require(_managerAddress != address(0), "Invalid OracleCouncil address");
        marketManager = IExoticPositionalMarketManager(_managerAddress);
        emit NewManagerAddress(_managerAddress);
    }

    modifier onlyOracleCouncilManagerAndOwner() {
        require(
            msg.sender == marketManager.oracleCouncilAddress() ||
                msg.sender == address(marketManager) ||
                msg.sender == owner,
            "Not OracleCouncil Address, not Manager or Owner address"
        );
        require(address(marketManager) != address(0), "Not Manager address. Please update valid Manager address");
        require(
            marketManager.oracleCouncilAddress() != address(0),
            "Not OracleCouncil address. Please update valid Oracle address"
        );
        _;
    }

    event CreatorBondSent(address market, address creator, uint amount);
    event ResolverBondSent(address market, address resolver, uint amount);
    event DisputorBondSent(address market, address disputor, uint amount);
    event BondTransferredFromMarketBondToUser(address market, address account, uint amount);
    event NewOracleCouncilAddress(address oracleCouncil);
    event NewManagerAddress(address managerAddress);
}

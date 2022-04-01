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

contract ExoticRewards is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    using SafeMathUpgradeable for uint;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IExoticPositionalMarketManager public marketManager;
    IERC20Upgradeable public paymentToken;
    mapping(address => uint) public marketIssuedReward;

    
    function initialize(address _owner, address _managerAddress) public initializer {
        setOwner(_owner);
        initNonReentrant();
        marketManager = IExoticPositionalMarketManager(_managerAddress);
    }

    function sendRewardToDisputoraddress(
        address _market,
        address _disputorAddress,
        uint _amount
    ) external onlyOracleCouncilManagerAndOwner {
        require(_amount > 0, "Zero amount");
        require(_amount <= paymentToken.balanceOf(address(this)), "Amount exceeds balance");
        require(_disputorAddress != address(0), "Invalid disputor");
        marketIssuedReward[_market] = marketIssuedReward[_market].add(_amount);
        paymentToken.transfer(_disputorAddress, _amount);
        emit RewardIssued(_market, _disputorAddress, _amount);
    }

    function setMarketManager(address _managerAddress) external onlyOwner {
        require(_managerAddress != address(0), "Invalid Manager");
        marketManager = IExoticPositionalMarketManager(_managerAddress);
        emit NewManagerAddress(_managerAddress);
    }
    
    function setPaymentToken(address _paymentToken) external onlyOwner {
        require(_paymentToken != address(0), "Invalid address");
        paymentToken = IERC20Upgradeable(_paymentToken);
        emit NewPaymentToken(_paymentToken);
    }

    modifier onlyOracleCouncilManagerAndOwner() {
        require(
            msg.sender == marketManager.oracleCouncilAddress() ||
                msg.sender == address(marketManager) ||
                msg.sender == owner,
            "Not OC/Manager/Owner"
        );
        require(address(marketManager) != address(0), "Invalid Manager");
        require(
            marketManager.oracleCouncilAddress() != address(0),
            "Invalid OC"
        );
        _;
    }

    receive() external payable {}

    fallback() external payable {}

    event NewPaymentToken(address paymentTokenAddress);
    event NewManagerAddress(address managerAddress);
    event RewardIssued(address market, address disputorAddress, uint amount);
}

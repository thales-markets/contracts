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

contract ExoticPositionalMarketManager is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    using SafeMathUpgradeable for uint;

    uint public minimumPositioningDuration;
    uint public minimumMarketMaturityDuration;

    function initialize(
        address _owner,
        uint _minimumPositioningDuration,
        uint _minimumMarketMaturityDuration
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        minimumPositioningDuration = _minimumPositioningDuration;
        minimumMarketMaturityDuration = _minimumMarketMaturityDuration;
    }




    // Create Exotic market with 2 phrase options
    function createExoticMarket(
        bytes32 _marketQuestion, 
        uint _endOfPositioning,
        uint _marketMaturityDate,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _tag,
        bytes32 _phrase1,
        bytes32 _phrase2
    ) external checkMarketRequirements(_endOfPositioning, _marketMaturityDate) {
        
    }   

    // Create Exotic market with 3 phrase options
    function createExoticMarket(
        bytes32 _marketQuestion, 
        uint _endOfPositioning,
        uint _marketMaturityDate,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _tag,
        bytes32 _phrase1,
        bytes32 _phrase2,
        bytes32 _phrase3
    ) external checkMarketRequirements(_endOfPositioning, _marketMaturityDate) {

    }

    // Create Exotic market with 4 phrase options
    function createExoticMarket(
        bytes32 _marketQuestion, 
        uint _endOfPositioning,
        uint _marketMaturityDate,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _tag,
        bytes32 _phrase1,
        bytes32 _phrase2,
        bytes32 _phrase3,
        bytes32 _phrase4
    ) external checkMarketRequirements(_endOfPositioning, _marketMaturityDate) {

    }

    // Create Exotic market with 5 phrase options
    function createExoticMarket(
        bytes32 _marketQuestion, 
        uint _endOfPositioning,
        uint _marketMaturityDate,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint _tag,
        bytes32 _phrase1,
        bytes32 _phrase2,
        bytes32 _phrase3,
        bytes32 _phrase4,
        bytes32 _phrase5
    ) external checkMarketRequirements(_endOfPositioning, _marketMaturityDate) {

    }



    function setMinimumPositioningDuration(uint _duration) external onlyOwner {
        minimumPositioningDuration = _duration;
        emit MinimumPositionDurationChanged(_duration);
    }
    function setMinimumMarketMaturityDuration(uint _duration) external onlyOwner {
        minimumMarketMaturityDuration = _duration;
        emit MinimumMarketMaturityDurationChanged(_duration);
    }

    modifier checkMarketRequirements(uint _endOfPositioning, uint _marketMaturityDate) {
        require(_endOfPositioning >= block.timestamp.add(minimumPositioningDuration), "Posiitioning period too low. Increase the endOfPositioning");
        require(_marketMaturityDate >= block.timestamp.add(minimumMarketMaturityDuration), "Market Maturity period too low. Increase the maturityDuration");
        _;
    }

    event MinimumPositionDurationChanged(uint duration);
    event MinimumMarketMaturityDurationChanged(uint duration);
}
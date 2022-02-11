pragma solidity ^0.8.0;


// external
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "@openzeppelin/contracts-4.4.1/proxy/Clones.sol";
import "./ExoticPositionalMarket.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";

contract ExoticPositionalMarketManager is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    using SafeMathUpgradeable for uint;

    uint public minimumPositioningDuration;
    uint public minimumMarketMaturityDuration;

    address public exoticMarketMastercopy;

    function initialize(
        address _owner,
        uint _minimumPositioningDuration,
        uint _minimumMarketMaturityDuration,
        address _exoticMarketMastercopy
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        minimumPositioningDuration = _minimumPositioningDuration;
        minimumMarketMaturityDuration = _minimumMarketMaturityDuration;
        exoticMarketMastercopy = _exoticMarketMastercopy;
    }




    // Create Exotic market with 2 phrase options
    function createExoticMarket(
        string memory _marketQuestion, 
        uint _endOfPositioning,
        uint _marketMaturity,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint[] memory _tag,
        address _paymentToken,
        string memory _phrase1,
        string memory _phrase2
    ) external checkMarketRequirements(_endOfPositioning, _marketMaturity) {
        
    }   

    // Create Exotic market with 3 phrase options
    function createExoticMarketThree(
        string memory _marketQuestion, 
        uint _endOfPositioning,
        uint _marketMaturity,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint[] memory _tag,
        address _paymentToken,
        string memory _phrase1,
        string memory _phrase2,
        string memory _phrase3
    ) external checkMarketRequirements(_endOfPositioning, _marketMaturity) {
        ExoticPositionalMarket exoticMarket = ExoticPositionalMarket(
            Clones.clone(exoticMarketMastercopy)
        );

        exoticMarket.initializeWithThreeParameters(
            _marketQuestion, 
            _endOfPositioning, 
            _marketMaturity, 
            _fixedTicketPrice, 
            _withdrawalFeePercentage, 
            _tag, 
            _paymentToken, 
            _phrase1, 
            _phrase2, 
            _phrase3);

        emit MarketCreated(address(exoticMarket), _marketQuestion);
    }

    // Create Exotic market with 4 phrase options
    function createExoticMarket(
        string memory _marketQuestion, 
        uint _endOfPositioning,
        uint _marketMaturity,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint[] memory _tag,
        address _paymentToken,
        string memory _phrase1,
        string memory _phrase2,
        string memory _phrase3,
        string memory _phrase4
    ) external checkMarketRequirements(_endOfPositioning, _marketMaturity) {

    }

    // Create Exotic market with 5 phrase options
    function createExoticMarket(
        string memory _marketQuestion, 
        uint _endOfPositioning,
        uint _marketMaturity,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint[] memory _tag,
        address _paymentToken,
        string memory _phrase1,
        string memory _phrase2,
        string memory _phrase3,
        string memory _phrase4,
        string memory _phrase5
    ) external checkMarketRequirements(_endOfPositioning, _marketMaturity) {

    }

    function setExoticMarketMastercopy(address _exoticMastercopy) external onlyOwner {
        require(_exoticMastercopy != address(0), "Exotic market invalid");
        exoticMarketMastercopy = _exoticMastercopy;
        emit ExoticMarketMastercopyChanged(_exoticMastercopy);
    }

    function setMinimumPositioningDuration(uint _duration) external onlyOwner {
        minimumPositioningDuration = _duration;
        emit MinimumPositionDurationChanged(_duration);
    }
    function setMinimumMarketMaturityDuration(uint _duration) external onlyOwner {
        minimumMarketMaturityDuration = _duration;
        emit MinimumMarketMaturityDurationChanged(_duration);
    }

    modifier checkMarketRequirements(uint _endOfPositioning, uint _marketMaturity) {
        require(exoticMarketMastercopy != address(0), "No ExoticMarket mastercopy present. Please update the mastercopy");
        // require(_endOfPositioning >= block.timestamp.add(minimumPositioningDuration), "Posiitioning period too low. Increase the endOfPositioning");
        // require(_marketMaturity >= block.timestamp.add(minimumMarketMaturityDuration), "Market Maturity period too low. Increase the maturityDuration");
        _;
    }

    event MinimumPositionDurationChanged(uint duration);
    event MinimumMarketMaturityDurationChanged(uint duration);
    event MarketCreated(address marketAddress, string marketQuestion);
    event ExoticMarketMastercopyChanged(address _exoticMastercopy);
}
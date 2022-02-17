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

    address public exoticMarketMastercopy;
    address public oracleCouncilAddress;

    mapping (uint => address) public activeMarkets;
    uint public numOfActiveMarkets;


    function initialize(
        address _owner,
        uint _minimumPositioningDuration,
        address _exoticMarketMastercopy
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        minimumPositioningDuration = _minimumPositioningDuration;
        exoticMarketMastercopy = _exoticMarketMastercopy;
    }



    // Create Exotic market with 3 phrase options
    function createExoticMarket(
        string memory _marketQuestion, 
        uint _endOfPositioning,
        uint _fixedTicketPrice,
        uint _withdrawalFeePercentage,
        uint[] memory _tag,
        address _paymentToken,
        string[] memory _phrases
     ) external checkMarketRequirements(_endOfPositioning) {
        ExoticPositionalMarket exoticMarket = ExoticPositionalMarket(
            Clones.clone(exoticMarketMastercopy)
        );

        exoticMarket.initialize(
            msg.sender,
            _marketQuestion, 
            _endOfPositioning, 
            _fixedTicketPrice, 
            _withdrawalFeePercentage, 
            _tag, 
            _paymentToken, 
            _phrases,
            oracleCouncilAddress
            );

        activeMarkets[numOfActiveMarkets] = address(exoticMarket);
        numOfActiveMarkets = numOfActiveMarkets.add(1);
        emit MarketCreated(address(exoticMarket), _marketQuestion, msg.sender);
    }

    function resolveMarket(address _marketAddress, uint _outcomePosition) external {
        require(isActiveMarket(_marketAddress), "Market is not active");
        // require(ExoticPositionalMarket(_marketAddress).creatorAddress() == msg.sender, "Invalid market owner. Market owner mismatch");
        
        ExoticPositionalMarket(_marketAddress).resolveMarket(_outcomePosition, msg.sender);
        removeActiveMarket(_marketAddress);
        emit MarketResolved(_marketAddress);
    }

    function disputeMarket(address _marketAddress) external {
        // require(ExoticPositionalMarket(_marketAddress).creatorAddress() == msg.sender, "Invalid market owner. Market owner mismatch");
        require(msg.sender == oracleCouncilAddress, "Invalid call. Use OracleCouncil to dispute a market");
        require(!ExoticPositionalMarket(_marketAddress).disputed(), "Market already disputed");
        if(isActiveMarket(_marketAddress)) {
            ExoticPositionalMarket(_marketAddress).openDispute();
        }
        else {
            require(!ExoticPositionalMarket(_marketAddress).canHoldersClaim(), "Can not dispute! Market already claimable");
            ExoticPositionalMarket(_marketAddress).openDispute();
        }
        
    }
    
    function getMarketAddress(uint _index) external view returns(address){
        return activeMarkets[_index];
    }

    function getMarketIndex(address _marketAddress) public view returns(uint) {
        for(uint i=0; i<numOfActiveMarkets; i++) {
            if(activeMarkets[i] == _marketAddress) {
                return i;
            }
        }
        return numOfActiveMarkets;
    }

    function isActiveMarket(address _marketAddress) public view returns(bool) {
        return getMarketIndex(_marketAddress) < numOfActiveMarkets;

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
  
    function setOracleCouncilAddress(address _councilAddress) external onlyOwner {
        require(_councilAddress != address(0), "Invalid address");
        oracleCouncilAddress = _councilAddress;
        emit NewOracleCouncilAddress(_councilAddress);
    }

    function removeActiveMarket(address _marketAddress) internal {
        activeMarkets[getMarketIndex(_marketAddress)] = activeMarkets[numOfActiveMarkets.sub(1)];
        numOfActiveMarkets = numOfActiveMarkets.sub(1);
        activeMarkets[numOfActiveMarkets] = address(0);
    }

    modifier checkMarketRequirements(uint _endOfPositioning) {
        require(exoticMarketMastercopy != address(0), "No ExoticMarket mastercopy present. Please update the mastercopy");
        // require(_endOfPositioning >= block.timestamp.add(minimumPositioningDuration), "Posiitioning period too low. Increase the endOfPositioning");
        // require(_marketMaturity >= block.timestamp.add(minimumMarketMaturityDuration), "Market Maturity period too low. Increase the maturityDuration");
        _;
    }

    event MinimumPositionDurationChanged(uint duration);
    event MinimumMarketMaturityDurationChanged(uint duration);
    event ExoticMarketMastercopyChanged(address _exoticMastercopy);
    event MarketCreated(address marketAddress, string marketQuestion, address marketOwner);
    event MarketResolved(address marketAddress);
    event NewOracleCouncilAddress(address oracleCouncilAddress);
}
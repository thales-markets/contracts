pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";

contract ExoticManagerData is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    using SafeMathUpgradeable for uint;

    uint public fixedBondAmount;
    uint public backstopTimeout;
    uint public minimumPositioningDuration;
    uint public claimTimeoutDefaultPeriod;
    uint public pDAOResolveTimePeriod;
    uint public safeBoxPercentage;
    uint public creatorPercentage;
    uint public resolverPercentage;
    uint public withdrawalPercentage;
    uint public maximumPositionsAllowed;
    uint public disputePrice;
    uint public maxOracleCouncilMembers;
    uint public maxNumberOfTags;
    uint public safeBoxLowAmount;
    uint public arbitraryRewardForDisputor;
    uint public minFixedTicketPrice;
    uint public disputeStringLengthLimit;
    uint public marketQuestionStringLimit;
    uint public marketSourceStringLimit;
    uint public marketPositionStringLimit;
    uint public withdrawalTimePeriod;
    uint public maxAmountForOpenBidPosition;
    uint public maxFinalWithdrawPercentage;

    bool public creationRestrictedToOwner;
    bool public openBidAllowed;
    
    address public exoticMarketMastercopy;
    address public exoticMarketOpenBidMastercopy;
    address public oracleCouncilAddress;
    address public safeBoxAddress;
    address public paymentToken;
    address public tagsAddress;
    address public theRundownConsumerAddress;
    address public marketDataAddress;
    address public exoticRewards;
    // address public thalesBonds;

    struct DummyStruct {
        uint fixedBondAmount;
        uint backstopTimeout;
        uint minimumPositioningDuration;
    }
    
    struct ManagerData {
        uint fixedBondAmount;
        uint backstopTimeout;
        uint minimumPositioningDuration;
        uint claimTimeoutDefaultPeriod;
        uint pDAOResolveTimePeriod;
        uint safeBoxPercentage;
        uint creatorPercentage;
        uint resolverPercentage;
        uint withdrawalPercentage;
        uint maximumPositionsAllowed;
        uint disputePrice;
        uint maxOracleCouncilMembers;
        uint maxNumberOfTags;
        uint safeBoxLowAmount;
        uint arbitraryRewardForDisputor;
        uint minFixedTicketPrice;
        uint disputeStringLengthLimit;
        uint marketQuestionStringLimit;
        uint marketSourceStringLimit;
        uint marketPositionStringLimit;
        uint withdrawalTimePeriod;
        uint maxAmountForOpenBidPosition;
        uint maxFinalWithdrawPercentage;
        bool creationRestrictedToOwner;
        bool openBidAllowed;
        address exoticMarketMastercopy;
        address exoticMarketOpenBidMastercopy;
        address oracleCouncilAddress;
        address safeBoxAddress;
        // address thalesBonds;
        address paymentToken;
        address tagsAddress;
        address theRundownConsumerAddress;
        address marketDataAddress;
        address exoticRewards;
    }

    function initialize(address _owner) public initializer {
        setOwner(_owner);
        initNonReentrant();
    }

    function setSafeBoxAddress(address _safeBoxAddress) external onlyOwner {
        require(_safeBoxAddress != address(0), "Invalid address");
        safeBoxAddress = _safeBoxAddress;
        emit NewSafeBoxAddress(_safeBoxAddress);
    }

    function setExoticMarketMastercopy(address _exoticMastercopy) external onlyOwner {
        require(_exoticMastercopy != address(0), "Exotic market invalid");
        exoticMarketMastercopy = _exoticMastercopy;
        emit ExoticMarketMastercopyChanged(_exoticMastercopy);
    }

    function setExoticMarketOpenBidMastercopy(address _exoticOpenBidMastercopy) external onlyOwner {
        require(_exoticOpenBidMastercopy != address(0), "Exotic market invalid");
        exoticMarketOpenBidMastercopy = _exoticOpenBidMastercopy;
        emit ExoticMarketOpenBidMastercopyChanged(_exoticOpenBidMastercopy);
    }

    function setExoticRewards(address _exoticRewards) external onlyOwner {
        require(_exoticRewards != address(0), "Exotic rewards invalid");
        exoticRewards = _exoticRewards;
        emit ExoticRewardsChanged(_exoticRewards);
    }

    function setMinimumPositioningDuration(uint _duration) external onlyOwner {
        minimumPositioningDuration = _duration;
        emit MinimumPositionDurationChanged(_duration);
    }

    function setSafeBoxPercentage(uint _safeBoxPercentage) external onlyOwner {
        safeBoxPercentage = _safeBoxPercentage;
        emit SafeBoxPercentageChanged(_safeBoxPercentage);
    }

    function setCreatorPercentage(uint _creatorPercentage) external onlyOwner {
        creatorPercentage = _creatorPercentage;
        emit CreatorPercentageChanged(_creatorPercentage);
    }

    function setResolverPercentage(uint _resolverPercentage) external onlyOwner {
        resolverPercentage = _resolverPercentage;
        emit ResolverPercentageChanged(_resolverPercentage);
    }

    function setWithdrawalPercentage(uint _withdrawalPercentage) external onlyOwner {
        withdrawalPercentage = _withdrawalPercentage;
        emit WithdrawalPercentageChanged(_withdrawalPercentage);
    }

    function setWithdrawalTimePeriod(uint _withdrawalTimePeriod) external onlyOwner {
        withdrawalTimePeriod = _withdrawalTimePeriod;
        emit WithdrawalTimePeriodChanged(_withdrawalTimePeriod);
    }

    function setMarketQuestionStringLimit(uint _marketQuestionStringLimit) external onlyOwner {
        marketQuestionStringLimit = _marketQuestionStringLimit;
        emit MarketQuestionStringLimitChanged(_marketQuestionStringLimit);
    }

    function setMarketSourceStringLimit(uint _marketSourceStringLimit) external onlyOwner {
        marketSourceStringLimit = _marketSourceStringLimit;
        emit MarketSourceStringLimitChanged(_marketSourceStringLimit);
    }

    function setMarketPositionStringLimit(uint _marketPositionStringLimit) external onlyOwner {
        marketPositionStringLimit = _marketPositionStringLimit;
        emit MarketSourceStringLimitChanged(_marketPositionStringLimit);
    }

    function setPDAOResolveTimePeriod(uint _pDAOResolveTimePeriod) external onlyOwner {
        pDAOResolveTimePeriod = _pDAOResolveTimePeriod;
        emit PDAOResolveTimePeriodChanged(_pDAOResolveTimePeriod);
    }

    function setOracleCouncilAddress(address _councilAddress) external onlyOwner {
        require(_councilAddress != address(0), "Invalid address");
        oracleCouncilAddress = _councilAddress;
        emit NewOracleCouncilAddress(_councilAddress);
    }

    function setMarketDataAddress(address _marketDataAddress) external onlyOwner {
        require(_marketDataAddress != address(0), "Invalid address");
        marketDataAddress = _marketDataAddress;
        emit NewMarketDataAddress(_marketDataAddress);
    }

    function setTheRundownConsumerAddress(address _theRundownConsumerAddress) external onlyOwner {
        require(_theRundownConsumerAddress != address(0), "Invalid address");
        theRundownConsumerAddress = _theRundownConsumerAddress;
        emit NewTheRundownConsumerAddress(_theRundownConsumerAddress);
    }

    function setMaximumPositionsAllowed(uint _maximumPositionsAllowed) external onlyOwner {
        require(_maximumPositionsAllowed > 2, "Invalid ");
        maximumPositionsAllowed = _maximumPositionsAllowed;
        emit NewMaximumPositionsAllowed(_maximumPositionsAllowed);
    }

    function setMinimumFixedTicketAmount(uint _minFixedTicketPrice) external onlyOwner {
        require(_minFixedTicketPrice != minFixedTicketPrice, "Invalid");
        minFixedTicketPrice = _minFixedTicketPrice;
        emit NewMinimumFixedTicketAmount(_minFixedTicketPrice);
    }

    function setMaxNumberOfTags(uint _maxNumberOfTags) external onlyOwner {
        require(_maxNumberOfTags > 2, "Invalid");
        maxNumberOfTags = _maxNumberOfTags;
        emit NewMaxNumberOfTags(_maxNumberOfTags);
    }

    function setDisputePrice(uint _disputePrice) external onlyOwner {
        require(_disputePrice > 0, "Invalid price");
        require(_disputePrice != disputePrice, "Equal to last");
        disputePrice = _disputePrice;
        emit NewDisputePrice(_disputePrice);
    }

    function setDefaultBackstopTimeout(uint _timeout) external onlyOwner {
        require(_timeout > 0, "Invalid timeout");
        require(_timeout != backstopTimeout, "Equal to last");
        backstopTimeout = _timeout;
        emit NewDefaultBackstopTimeout(_timeout);
    }

    function setFixedBondAmount(uint _bond) external onlyOwner {
        require(_bond > 0, "Invalid bond");
        require(_bond != fixedBondAmount, "Equal to last");
        fixedBondAmount = _bond;
        emit NewFixedBondAmount(_bond);
    }

    function setSafeBoxLowAmount(uint _safeBoxLowAmount) external onlyOwner {
        require(_safeBoxLowAmount > 0, "Invalid amount");
        require(_safeBoxLowAmount != safeBoxLowAmount, "Equal to last");
        require(_safeBoxLowAmount < disputePrice, "Higher than dispute price.");
        safeBoxLowAmount = _safeBoxLowAmount;
        emit NewSafeBoxLowAmount(_safeBoxLowAmount);
    }

    function setDisputeStringLengthLimit(uint _disputeStringLengthLimit) external onlyOwner {
        require(_disputeStringLengthLimit > 0, "Invalid amount");
        require(_disputeStringLengthLimit != disputeStringLengthLimit, "Equal to last");
        disputeStringLengthLimit = _disputeStringLengthLimit;
        emit NewDisputeStringLengthLimit(_disputeStringLengthLimit);
    }

    function setArbitraryRewardForDisputor(uint _arbitraryRewardForDisputor) external onlyOwner {
        require(_arbitraryRewardForDisputor > 0, "Invalid amount");
        require(_arbitraryRewardForDisputor != arbitraryRewardForDisputor, "Equal to last");
        arbitraryRewardForDisputor = _arbitraryRewardForDisputor;
        emit NewArbitraryRewardForDisputor(_arbitraryRewardForDisputor);
    }

    function setClaimTimeoutDefaultPeriod(uint _claimTimeout) external onlyOwner {
        require(_claimTimeout > 0, "Invalid timeout");
        require(_claimTimeout != claimTimeoutDefaultPeriod, "Equal to last");
        claimTimeoutDefaultPeriod = _claimTimeout;
        emit NewClaimTimeoutDefaultPeriod(_claimTimeout);
    }

    function setMaxOracleCouncilMembers(uint _maxOracleCouncilMembers) external onlyOwner {
        require(_maxOracleCouncilMembers > 3, "Number too low");
        maxOracleCouncilMembers = _maxOracleCouncilMembers;
        emit NewMaxOracleCouncilMembers(_maxOracleCouncilMembers);
    }

    function setCreationRestrictedToOwner(bool _creationRestrictedToOwner) external onlyOwner {
        require(_creationRestrictedToOwner != creationRestrictedToOwner, "Number too low");
        creationRestrictedToOwner = _creationRestrictedToOwner;
        emit CreationRestrictedToOwnerChanged(_creationRestrictedToOwner);
    }

    function setOpenBidAllowed(bool _openBidAllowed) external onlyOwner {
        openBidAllowed = _openBidAllowed;
        emit OpenBidAllowedChanged(_openBidAllowed);
    }

    function setPaymentToken(address _paymentToken) external onlyOwner {
        require(_paymentToken != address(0), "Invalid address");
        paymentToken = _paymentToken;
        emit NewPaymentToken(_paymentToken);
    }


    function setTagsAddress(address _tagsAddress) external onlyOwner {
        require(_tagsAddress != address(0), "Invalid address");
        tagsAddress = _tagsAddress;
        emit NewTagsAddress(_tagsAddress);
    }

    function setMaxAmountForOpenBidPosition(uint _maxAmountForOpenBidPosition)
        external
        onlyOwner
    {
        require(_maxAmountForOpenBidPosition != maxAmountForOpenBidPosition, "Same value");
        maxAmountForOpenBidPosition = _maxAmountForOpenBidPosition;
        emit NewMaxAmountForOpenBidPosition(_maxAmountForOpenBidPosition);
    }
    
    function setMaxFinalWithdrawPercentage(uint _maxFinalWithdrawPercentage)
        external
        onlyOwner
    {
        require(maxFinalWithdrawPercentage != _maxFinalWithdrawPercentage, "Same value");
        maxFinalWithdrawPercentage = _maxFinalWithdrawPercentage;
        emit NewMaxFinalWithdrawPercentage(_maxFinalWithdrawPercentage);
    }

    function setManagerDummyData(DummyStruct memory _data) external {
        if(_data.fixedBondAmount != fixedBondAmount) {
            fixedBondAmount = _data.fixedBondAmount;
            emit NewFixedBondAmount(_data.fixedBondAmount);
        }
        if(_data.backstopTimeout != backstopTimeout) {
            backstopTimeout = _data.backstopTimeout;
            emit NewDefaultBackstopTimeout(_data.backstopTimeout);
        }
        
        if(_data.minimumPositioningDuration != minimumPositioningDuration) {
            minimumPositioningDuration = _data.minimumPositioningDuration;
            emit MinimumPositionDurationChanged(_data.minimumPositioningDuration);
        }
    }

    function setManagerData(ManagerData memory _data) external {
        if(_data.fixedBondAmount != fixedBondAmount) {
            fixedBondAmount = _data.fixedBondAmount;
            emit NewFixedBondAmount(_data.fixedBondAmount);
        }
        if(_data.backstopTimeout != backstopTimeout) {
            backstopTimeout = _data.backstopTimeout;
            emit NewDefaultBackstopTimeout(_data.backstopTimeout);
        }
        
        if(_data.minimumPositioningDuration != minimumPositioningDuration) {
            minimumPositioningDuration = _data.minimumPositioningDuration;
            emit MinimumPositionDurationChanged(_data.minimumPositioningDuration);
        }
       
        if(_data.claimTimeoutDefaultPeriod != claimTimeoutDefaultPeriod) {
            claimTimeoutDefaultPeriod = _data.claimTimeoutDefaultPeriod;
            emit NewClaimTimeoutDefaultPeriod(_data.claimTimeoutDefaultPeriod);
        }
        
        if(_data.pDAOResolveTimePeriod != pDAOResolveTimePeriod) {
            pDAOResolveTimePeriod = _data.pDAOResolveTimePeriod;
            emit PDAOResolveTimePeriodChanged(_data.pDAOResolveTimePeriod);
        }
        if(_data.safeBoxPercentage != safeBoxPercentage) {
            safeBoxPercentage = _data.safeBoxPercentage;
            emit SafeBoxPercentageChanged(_data.safeBoxPercentage);
        }
        
        if(_data.creatorPercentage != creatorPercentage) {
            creatorPercentage = _data.creatorPercentage;
            emit CreatorPercentageChanged(_data.creatorPercentage);
        }
        
        if(_data.resolverPercentage != resolverPercentage) {
            resolverPercentage = _data.resolverPercentage;
            emit ResolverPercentageChanged(_data.resolverPercentage);
        }
        
        if(_data.withdrawalPercentage != withdrawalPercentage) {
            withdrawalPercentage = _data.withdrawalPercentage;
            emit WithdrawalPercentageChanged(_data.withdrawalPercentage);
        }
        
        if(_data.maximumPositionsAllowed != maximumPositionsAllowed) {
            maximumPositionsAllowed = _data.maximumPositionsAllowed;
            emit NewMaximumPositionsAllowed(_data.maximumPositionsAllowed);
        }
        
        if(_data.disputePrice != disputePrice) {
            disputePrice = _data.disputePrice;
            emit NewDisputePrice(_data.disputePrice);
        }
       
        if(_data.maxOracleCouncilMembers != maxOracleCouncilMembers) {
            maxOracleCouncilMembers = _data.maxOracleCouncilMembers;
            emit NewMaxOracleCouncilMembers(_data.maxOracleCouncilMembers);
        }
        
        if(_data.maxNumberOfTags != maxNumberOfTags) {
            maxNumberOfTags = _data.maxNumberOfTags;
            emit NewMaxNumberOfTags(_data.maxNumberOfTags);
        }
        
        if(_data.maxNumberOfTags != maxNumberOfTags) {
            maxNumberOfTags = _data.maxNumberOfTags;
            emit NewMaxNumberOfTags(_data.maxNumberOfTags);
        }
        
        if(_data.safeBoxLowAmount != safeBoxLowAmount) {
            safeBoxLowAmount = _data.safeBoxLowAmount;
            emit NewSafeBoxLowAmount(_data.safeBoxLowAmount);
        }
        
        if(_data.arbitraryRewardForDisputor != arbitraryRewardForDisputor) {
            arbitraryRewardForDisputor = _data.arbitraryRewardForDisputor;
            emit NewArbitraryRewardForDisputor(_data.arbitraryRewardForDisputor);
        }
        
        if(_data.minFixedTicketPrice != minFixedTicketPrice) {
            minFixedTicketPrice = _data.minFixedTicketPrice;
            emit NewMinimumFixedTicketAmount(_data.minFixedTicketPrice);
        }
        
        if(_data.disputeStringLengthLimit != disputeStringLengthLimit) {
            disputeStringLengthLimit = _data.disputeStringLengthLimit;
            emit NewDisputeStringLengthLimit(_data.disputeStringLengthLimit);
        }
        
        if(_data.marketQuestionStringLimit != marketQuestionStringLimit) {
            marketQuestionStringLimit = _data.marketQuestionStringLimit;
            emit MarketQuestionStringLimitChanged(_data.marketQuestionStringLimit);
        }
        
        if(_data.marketSourceStringLimit != marketSourceStringLimit) {
            marketSourceStringLimit = _data.marketSourceStringLimit;
            emit MarketSourceStringLimitChanged(_data.marketSourceStringLimit);
        }
       
        if(_data.marketPositionStringLimit != marketPositionStringLimit) {
            marketPositionStringLimit = _data.marketPositionStringLimit;
            emit MarketPositionStringLimitChanged(_data.marketPositionStringLimit);
        }
        
        if(_data.withdrawalTimePeriod != withdrawalTimePeriod) {
            withdrawalTimePeriod = _data.withdrawalTimePeriod;
            emit WithdrawalTimePeriodChanged(_data.withdrawalTimePeriod);
        }
       
        if(_data.maxAmountForOpenBidPosition != maxAmountForOpenBidPosition) {
            maxAmountForOpenBidPosition = _data.maxAmountForOpenBidPosition;
            emit NewMaxAmountForOpenBidPosition(_data.maxAmountForOpenBidPosition);
        }
        
        if(_data.maxFinalWithdrawPercentage != maxFinalWithdrawPercentage) {
            maxFinalWithdrawPercentage = _data.maxFinalWithdrawPercentage;
            emit NewMaxFinalWithdrawPercentage(_data.maxFinalWithdrawPercentage);
        }
        
        if(_data.creationRestrictedToOwner != creationRestrictedToOwner) {
            creationRestrictedToOwner = _data.creationRestrictedToOwner;
            emit CreationRestrictedToOwnerChanged(_data.creationRestrictedToOwner);
        }
        
        if(_data.openBidAllowed != openBidAllowed) {
            openBidAllowed = _data.openBidAllowed;
            emit OpenBidAllowedChanged(_data.openBidAllowed);
        }
        
        if(_data.exoticMarketMastercopy != exoticMarketMastercopy && _data.exoticMarketMastercopy != address(0)) {
            exoticMarketMastercopy = _data.exoticMarketMastercopy;
            emit ExoticMarketMastercopyChanged(_data.exoticMarketMastercopy);
        }
        
        if(_data.exoticMarketOpenBidMastercopy != exoticMarketOpenBidMastercopy && _data.exoticMarketOpenBidMastercopy != address(0)) {
            exoticMarketOpenBidMastercopy = _data.exoticMarketOpenBidMastercopy;
            emit ExoticMarketOpenBidMastercopyChanged(_data.exoticMarketOpenBidMastercopy);
        }
        
        if(_data.oracleCouncilAddress != oracleCouncilAddress && _data.oracleCouncilAddress != address(0)) {
            oracleCouncilAddress = _data.oracleCouncilAddress;
            emit NewOracleCouncilAddress(_data.oracleCouncilAddress);
        }
        
        if(_data.paymentToken != paymentToken && _data.paymentToken != address(0)) {
            paymentToken = _data.paymentToken;
            emit NewPaymentToken(_data.paymentToken);
        }
        
        if(_data.tagsAddress != tagsAddress && _data.tagsAddress != address(0)) {
            tagsAddress = _data.tagsAddress;
            emit NewTagsAddress(_data.tagsAddress);
        }
        
        if(_data.theRundownConsumerAddress != theRundownConsumerAddress && _data.theRundownConsumerAddress != address(0)) {
            theRundownConsumerAddress = _data.theRundownConsumerAddress;
            emit NewTheRundownConsumerAddress(_data.theRundownConsumerAddress);
        }
        
        if(_data.exoticRewards != exoticRewards && _data.exoticRewards != address(0)) {
            exoticRewards = _data.exoticRewards;
            emit ExoticRewardsChanged(_data.exoticRewards);
        }
        
        if(_data.marketDataAddress != marketDataAddress && _data.marketDataAddress != address(0)) {
            marketDataAddress = _data.marketDataAddress;
            emit NewMarketDataAddress(_data.marketDataAddress);
        }
    
    }

    event NewFixedBondAmount(uint fixedBond);
    event NewDefaultBackstopTimeout(uint timeout);
    event MinimumPositionDurationChanged(uint duration);
    event NewClaimTimeoutDefaultPeriod(uint claimTimeout);
    event PDAOResolveTimePeriodChanged(uint pDAOResolveTimePeriod);
    event SafeBoxPercentageChanged(uint safeBoxPercentage);
    event CreatorPercentageChanged(uint creatorPercentage);
    event ResolverPercentageChanged(uint resolverPercentage);
    event WithdrawalPercentageChanged(uint withdrawalPercentage);
    event NewMaximumPositionsAllowed(uint maximumPositionsAllowed);
    event NewDisputePrice(uint disputePrice);
    event NewMaxOracleCouncilMembers(uint maxOracleCouncilMembers);
    event NewMaxNumberOfTags(uint maxNumberOfTags);
    event NewSafeBoxLowAmount(uint safeBoxLowAmount);
    event NewArbitraryRewardForDisputor(uint arbitraryRewardForDisputor);
    event NewMinimumFixedTicketAmount(uint minFixedTicketPrice);
    event NewDisputeStringLengthLimit(uint disputeStringLengthLimit);
    event MarketQuestionStringLimitChanged(uint marketQuestionStringLimit);
    event MarketSourceStringLimitChanged(uint marketSourceStringLimit);
    event MarketPositionStringLimitChanged(uint marketPositionStringLimit);
    event WithdrawalTimePeriodChanged(uint withdrawalTimePeriod);
    event NewMaxAmountForOpenBidPosition(uint maxAmountForOpenBidPosition);
    event NewMaxFinalWithdrawPercentage(uint maxFinalWithdrawPercentage);
    event CreationRestrictedToOwnerChanged(bool creationRestrictedToOwner);
    event OpenBidAllowedChanged(bool openBidAllowed);
    event ExoticMarketMastercopyChanged(address _exoticMastercopy);
    event ExoticMarketOpenBidMastercopyChanged(address exoticOpenBidMastercopy);
    event NewOracleCouncilAddress(address oracleCouncilAddress);
    event NewSafeBoxAddress(address safeBox);
    event NewTagsAddress(address tagsAddress);
    event NewPaymentToken(address paymentTokenAddress);
    event NewTheRundownConsumerAddress(address theRundownConsumerAddress);
    event ExoticRewardsChanged(address exoticRewards);
    event NewMarketDataAddress(address marketDataAddress);

    // event NewThalesBonds(address thalesBondsAddress);
    // event PauserAddressAdded(address pauserAddress);
    // event PauserAddressRemoved(address pauserAddress);
    // event MarketPaused(address marketAddress);
    // // event RewardSentToDisputorForMarket(address market, address disputorAddress, uint amount);
}
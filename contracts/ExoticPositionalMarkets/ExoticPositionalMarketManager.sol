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
import "./ExoticPositionalFixedMarket.sol";
import "./ExoticPositionalOpenBidMarket.sol";
import "../interfaces/IThalesBonds.sol";
import "../interfaces/IExoticPositionalTags.sol";
import "../interfaces/IThalesOracleCouncil.sol";
import "../interfaces/IExoticPositionalMarket.sol";
import "../interfaces/IExoticRewards.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/libraries/AddressSetLib.sol";

contract ExoticPositionalMarketManager is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    using SafeMathUpgradeable for uint;
    using AddressSetLib for AddressSetLib.AddressSet;
    
    AddressSetLib.AddressSet private _activeMarkets;
    // AddressSetLib.AddressSet private _maturedMarkets;

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
    uint public pausersCount;
    uint public maxNumberOfTags;
    uint public backstopTimeoutGeneral;
    uint public safeBoxLowAmount;
    uint public arbitraryRewardForDisputor;
    uint public minFixedTicketPrice;
    uint public disputeStringLengthLimit;
    uint public marketQuestionStringLimit;
    uint public marketSourceStringLimit;
    uint public marketPositionStringLimit;
    uint public withdrawalTimePeriod;
    bool public creationRestrictedToOwner;
    bool public openBidAllowed;

    address public exoticMarketMastercopy;
    address public oracleCouncilAddress;
    address public safeBoxAddress;
    address public thalesBonds;
    address public paymentToken;
    address public tagsAddress;
    address public theRundownConsumerAddress;
    address public marketDataAddress;
    address public exoticMarketOpenBidMastercopy;
    address public exoticRewards;

    mapping(uint => address) public pauserAddress;
    mapping(address => uint) public pauserIndex;

    mapping(address => address) public creatorAddress;
    mapping(address => address) public resolverAddress;
    mapping(address => bool) public isChainLinkMarket;
    mapping(address => bool) public cancelledByCreator;

    function initialize(
        address _owner
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
    }

    // Create Exotic market
    function createExoticMarket(
        string memory _marketQuestion,
        string memory _marketSource,
        uint _endOfPositioning,
        uint _fixedTicketPrice,
        bool _withdrawalAllowed,
        uint[] memory _tags,
        uint _positionCount,
        uint _positionOfCreator,
        string[] memory _positionPhrases
    ) external nonReentrant {
        require(_endOfPositioning >= block.timestamp.add(minimumPositioningDuration), "endOfPositioning too low.");
        require(!creationRestrictedToOwner || msg.sender == owner, "Creation is restricted. ");
        require(
            (openBidAllowed && _fixedTicketPrice == 0) || _fixedTicketPrice >= minFixedTicketPrice,
            "Exceeds min tickPrice"
        );
        require(
            IERC20(paymentToken).balanceOf(msg.sender) >= fixedBondAmount.add(_fixedTicketPrice),
            "Low amount for creation."
        );
        require(
            IERC20(paymentToken).allowance(msg.sender, thalesBonds) >= fixedBondAmount.add(_fixedTicketPrice),
            "No allowance."
        );
        require(_tags.length > 0 && _tags.length <= maxNumberOfTags);
        require(_positionOfCreator > 0 && _positionOfCreator <= _positionCount);
        require(keccak256(abi.encode(_marketQuestion)) != keccak256(abi.encode("")), "Invalid question.");
        require(keccak256(abi.encode(_marketSource)) != keccak256(abi.encode("")), "Invalid source");
        require(_positionCount == _positionPhrases.length, "Invalid posCount.");
        require(bytes(_marketQuestion).length < marketQuestionStringLimit, "mQuestion exceeds length");
        require(bytes(_marketSource).length < marketSourceStringLimit, "mSource exceeds length");
        require(thereAreNonEqualPositions(_positionPhrases), "Equal positional phrases");
        for (uint i = 0; i < _tags.length; i++) {
            require(IExoticPositionalTags(tagsAddress).isValidTagNumber(_tags[i]), "Not valid tag.");
        }

        if (_fixedTicketPrice > 0) {
            ExoticPositionalFixedMarket exoticMarket = ExoticPositionalFixedMarket(Clones.clone(exoticMarketMastercopy));

            exoticMarket.initialize(
                _marketQuestion,
                _marketSource,
                _endOfPositioning,
                _fixedTicketPrice,
                _withdrawalAllowed,
                _tags,
                _positionCount,
                _positionPhrases
            );
            creatorAddress[address(exoticMarket)] = msg.sender;
            IThalesBonds(thalesBonds).sendCreatorBondToMarket(address(exoticMarket), msg.sender, fixedBondAmount);
            _activeMarkets.add(address(exoticMarket));
            exoticMarket.takeCreatorInitialPosition(_positionOfCreator);
            emit MarketCreated(
                address(exoticMarket),
                _marketQuestion,
                _marketSource,
                _endOfPositioning,
                _fixedTicketPrice,
                _withdrawalAllowed,
                _tags,
                _positionCount,
                _positionPhrases,
                msg.sender
            );
        } else {
            ExoticPositionalOpenBidMarket exoticMarket =
                ExoticPositionalOpenBidMarket(Clones.clone(exoticMarketOpenBidMastercopy));

            exoticMarket.initialize(
                _marketQuestion,
                _marketSource,
                _endOfPositioning,
                _fixedTicketPrice,
                _withdrawalAllowed,
                _tags,
                _positionCount,
                _positionPhrases
            );
            creatorAddress[address(exoticMarket)] = msg.sender;
            IThalesBonds(thalesBonds).sendCreatorBondToMarket(address(exoticMarket), msg.sender, fixedBondAmount);
            _activeMarkets.add(address(exoticMarket));
            uint[] memory positions = new uint[](1);
            uint[] memory amounts = new uint[](1);
            positions[0] = _positionOfCreator;
            amounts[0] = minFixedTicketPrice;
            exoticMarket.takeCreatorInitialOpenBidPositions(positions, amounts);
            emit MarketCreated(
                address(exoticMarket),
                _marketQuestion,
                _marketSource,
                _endOfPositioning,
                _fixedTicketPrice,
                _withdrawalAllowed,
                _tags,
                _positionCount,
                _positionPhrases,
                msg.sender
            );
        }
    }

    function createCLMarket(
        string memory _marketQuestion,
        string memory _marketSource,
        uint _endOfPositioning,
        uint _fixedTicketPrice,
        bool _withdrawalAllowed,
        uint[] memory _tags,
        uint _positionCount,
        string[] memory _positionPhrases
    ) external nonReentrant {
        require(_endOfPositioning >= block.timestamp.add(minimumPositioningDuration), "endOfPositioning too low");
        require(theRundownConsumerAddress != address(0), "Invalid theRundownConsumer");
        require(msg.sender == theRundownConsumerAddress, "Invalid creator");
        require(_tags.length > 0 && _tags.length <= maxNumberOfTags);
        require(IERC20(paymentToken).balanceOf(msg.sender) >= fixedBondAmount, "Low amount for creation");
        require(IERC20(paymentToken).allowance(msg.sender, thalesBonds) >= fixedBondAmount, "No allowance.");
        require(keccak256(abi.encode(_marketQuestion)) != keccak256(abi.encode("")), "Invalid question");
        require(keccak256(abi.encode(_marketSource)) != keccak256(abi.encode("")), "Invalid source");
        require(_positionCount == _positionPhrases.length, "Invalid posCount");
        require(bytes(_marketQuestion).length < 110, "Question exceeds length");
        require(thereAreNonEqualPositions(_positionPhrases), "Equal positional phrases");

        ExoticPositionalOpenBidMarket exoticMarket =
            ExoticPositionalOpenBidMarket(Clones.clone(exoticMarketOpenBidMastercopy));
        exoticMarket.initialize(
            _marketQuestion,
            _marketSource,
            _endOfPositioning,
            _fixedTicketPrice,
            _withdrawalAllowed,
            _tags,
            _positionCount,
            _positionPhrases
        );
        isChainLinkMarket[address(exoticMarket)] = true;
        creatorAddress[address(exoticMarket)] = msg.sender;
        IThalesBonds(thalesBonds).sendCreatorBondToMarket(address(exoticMarket), msg.sender, exoticMarket.fixedBondAmount());
        _activeMarkets.add(address(exoticMarket));
        emit CLMarketCreated(
            address(exoticMarket),
            _marketQuestion,
            _marketSource,
            _endOfPositioning,
            _fixedTicketPrice,
            _withdrawalAllowed,
            _tags,
            _positionCount,
            _positionPhrases,
            msg.sender
        );
    }

    function resolveMarket(address _marketAddress, uint _outcomePosition) external {
        require(isActiveMarket(_marketAddress), "NotActive");
        if (isChainLinkMarket[_marketAddress]) {
            require(msg.sender == theRundownConsumerAddress, "Only theRundownConsumer");
        }
        require(!IThalesOracleCouncil(oracleCouncilAddress).isOracleCouncilMember(msg.sender), "OC mem can not resolve");
        if (msg.sender != owner && msg.sender != oracleCouncilAddress) {
            require(IExoticPositionalMarket(_marketAddress).canMarketBeResolved(), "Resolved");
        }
        if (IExoticPositionalMarket(_marketAddress).paused()) {
            require(msg.sender == owner, "Only pDAO while paused");
        }
        if (
            (msg.sender == creatorAddress[_marketAddress] &&
                IThalesBonds(thalesBonds).getCreatorBondForMarket(_marketAddress) > 0) ||
            msg.sender == owner ||
            msg.sender == oracleCouncilAddress
        ) {
            require(oracleCouncilAddress != address(0), "Invalid OC");
            require(creatorAddress[_marketAddress] != address(0), "Invalid creator");
            require(owner != address(0), "Invalid owner");
            if (msg.sender == creatorAddress[_marketAddress]) {
                IThalesBonds(thalesBonds).transferCreatorToResolverBonds(_marketAddress);
            }
        } else {
            require(
                IERC20(paymentToken).balanceOf(msg.sender) >= IExoticPositionalMarket(_marketAddress).fixedBondAmount(),
                "Low amount for creation"
            );
            require(
                IERC20(paymentToken).allowance(msg.sender, thalesBonds) >=
                    IExoticPositionalMarket(_marketAddress).fixedBondAmount(),
                "No allowance."
            );
            IThalesBonds(thalesBonds).sendResolverBondToMarket(
                _marketAddress,
                msg.sender,
                IExoticPositionalMarket(_marketAddress).fixedBondAmount()
            );
        }
        resolverAddress[_marketAddress] = msg.sender != oracleCouncilAddress ? msg.sender : safeBoxAddress;
        IExoticPositionalMarket(_marketAddress).resolveMarket(_outcomePosition, resolverAddress[_marketAddress]);
        emit MarketResolved(_marketAddress, _outcomePosition);
    }

    function cancelMarket(address _marketAddress) external {
        require(isActiveMarket(_marketAddress), "NotActive");
        require(
            msg.sender == oracleCouncilAddress || msg.sender == owner || msg.sender == creatorAddress[_marketAddress],
            "Invalid address"
        );
        if (msg.sender != owner) {
            require(oracleCouncilAddress != address(0), "Invalid address");
        }
        // Creator can cancel if it is the only ticket holder or only one that placed open bid
        if (msg.sender == creatorAddress[_marketAddress]) {
            require(
                IExoticPositionalMarket(_marketAddress).canCreatorCancelMarket(),
                "Market can not be cancelled by creator"
            );
            cancelledByCreator[_marketAddress] = true;
        }
        if (IExoticPositionalMarket(_marketAddress).paused()) {
            require(msg.sender == owner, "only pDAO");
        }
        IExoticPositionalMarket(_marketAddress).cancelMarket();
        resolverAddress[msg.sender] = safeBoxAddress;
        if (cancelledByCreator[_marketAddress]) {
            IExoticPositionalMarket(_marketAddress).claimWinningTicketOnBehalf(creatorAddress[_marketAddress]);
        }
        emit MarketCanceled(_marketAddress);
    }

    function resetMarket(address _marketAddress) external onlyOracleCouncilAndOwner {
        require(isActiveMarket(_marketAddress), "NotActive");
        if (IExoticPositionalMarket(_marketAddress).paused()) {
            require(msg.sender == owner, "only pDAO");
        }
        IExoticPositionalMarket(_marketAddress).resetMarket();
        emit MarketReset(_marketAddress);
    }

    function sendRewardToDisputor(
        address _market,
        address _disputorAddress,
        uint _amount
    ) external onlyOracleCouncilAndOwner {
        require(isActiveMarket(_market), "NotActive");
        IExoticRewards(exoticRewards).sendRewardToDisputoraddress(_market, _disputorAddress, _amount);
        // emit RewardSentToDisputorForMarket(_market, _disputorAddress, _amount);
    }

    function issueBondsBackToCreatorAndResolver(address _marketAddress) external nonReentrant {
        require(isActiveMarket(_marketAddress), "NotActive");
        require(
            IExoticPositionalMarket(_marketAddress).canUsersClaim() || cancelledByCreator[_marketAddress],
            "Not claimable"
        );
        require(
            IThalesBonds(thalesBonds).getCreatorBondForMarket(_marketAddress) > 0 ||
                IThalesBonds(thalesBonds).getResolverBondForMarket(_marketAddress) > 0,
            "Bonds already claimed"
        );
        IThalesBonds(thalesBonds).issueBondsBackToCreatorAndResolver(_marketAddress);
    }

    function disputeMarket(address _marketAddress, address _disputor) external onlyOracleCouncil {
        require(isActiveMarket(_marketAddress), "NotActive");
        IThalesBonds(thalesBonds).sendDisputorBondToMarket(
            _marketAddress,
            _disputor,
            IExoticPositionalMarket(_marketAddress).disputePrice()
        );
        require(!IExoticPositionalMarket(_marketAddress).paused(), "Market paused");
        if (!IExoticPositionalMarket(_marketAddress).disputed()) {
            IExoticPositionalMarket(_marketAddress).openDispute();
        }
    }

    function closeDispute(address _marketAddress) external onlyOracleCouncilAndOwner {
        require(isActiveMarket(_marketAddress), "NotActive");
        if (IExoticPositionalMarket(_marketAddress).paused()) {
            require(msg.sender == owner, "Only pDAO");
        }
        require(IExoticPositionalMarket(_marketAddress).disputed(), "Market not disputed");
        IExoticPositionalMarket(_marketAddress).closeDispute();
    }

    function isActiveMarket(address _marketAddress) public view returns (bool) {
        return _activeMarkets.contains(_marketAddress);
    }
    
    function numberOfActiveMarkets() external view returns (uint) {
        return _activeMarkets.elements.length;
    }

    function getActiveMarketAddress(uint _index) external view returns(address) {
        return _activeMarkets.elements[_index];
    }


    function isPauserAddress(address _pauser) external view returns (bool) {
        return pauserIndex[_pauser] > 0;
    }

    // SETTERS ///////////////////////////////////////////////////////////////////////////

    function setSafeBoxAddress(address _safeBoxAddress) external onlyOwner {
        require(_safeBoxAddress != address(0), "Invalid address");
        safeBoxAddress = _safeBoxAddress;
        emit NewSafeBoxAddress(_safeBoxAddress);
    }

    function setBackstopTimeout(address _market) external onlyOracleCouncilAndOwner {
        IExoticPositionalMarket(_market).setBackstopTimeout(backstopTimeout);
    }

    function setCustomBackstopTimeout(address _market, uint _timeout) external onlyOracleCouncilAndOwner {
        require(_timeout > 0, "Invalid timeout");
        require(IExoticPositionalMarket(_market).backstopTimeout() != _timeout, "Equal to last");
        IExoticPositionalMarket(_market).setBackstopTimeout(_timeout);
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
        emit setPDAOResolveTimePeriodChanged(_pDAOResolveTimePeriod);
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

    function setThalesBonds(address _thalesBonds) external onlyOwner {
        require(_thalesBonds != address(0), "Invalid address");
        if (thalesBonds != address(0)) {
            IERC20(paymentToken).approve(address(thalesBonds), 0);
        }
        thalesBonds = _thalesBonds;
        IERC20(paymentToken).approve(address(thalesBonds), type(uint256).max);
        emit NewThalesBonds(_thalesBonds);
    }

    function setTagsAddress(address _tagsAddress) external onlyOwner {
        require(_tagsAddress != address(0), "Invalid address");
        tagsAddress = _tagsAddress;
        emit NewTagsAddress(_tagsAddress);
    }

    function addPauserAddress(address _pauserAddress) external onlyOracleCouncilAndOwner {
        require(_pauserAddress != address(0), "Invalid address");
        require(pauserIndex[_pauserAddress] == 0, "Exists as pauser");
        pausersCount = pausersCount.add(1);
        pauserIndex[_pauserAddress] = pausersCount;
        pauserAddress[pausersCount] = _pauserAddress;
        emit PauserAddressAdded(_pauserAddress);
    }

    function removePauserAddress(address _pauserAddress) external onlyOracleCouncilAndOwner {
        require(_pauserAddress != address(0), "Invalid address");
        require(pauserIndex[_pauserAddress] != 0, "Not exists");
        pauserAddress[pauserIndex[_pauserAddress]] = pauserAddress[pausersCount];
        pauserIndex[pauserAddress[pausersCount]] = pauserIndex[_pauserAddress];
        pausersCount = pausersCount.sub(1);
        pauserIndex[_pauserAddress] = 0;
        emit PauserAddressRemoved(_pauserAddress);
    }

    // INTERNAL FUNCTIONS

    // function removeActiveMarket(address _marketAddress) internal {
    //     _activeMarkets.remove(_marketAddress);
    //     _maturedMarkets.add(_marketAddress);
    // }

    function thereAreNonEqualPositions(string[] memory positionPhrases) internal view returns (bool) {
        for (uint i = 0; i < positionPhrases.length - 1; i++) {
            if (
                keccak256(abi.encode(positionPhrases[i])) == keccak256(abi.encode(positionPhrases[i + 1])) ||
                bytes(positionPhrases[i]).length > marketPositionStringLimit
            ) {
                return false;
            }
        }
        return true;
    }

    event MinimumPositionDurationChanged(uint duration);
    event MinimumMarketMaturityDurationChanged(uint duration);
    event ExoticMarketMastercopyChanged(address _exoticMastercopy);
    event ExoticMarketOpenBidMastercopyChanged(address exoticOpenBidMastercopy);
    event MarketResolved(address marketAddress, uint outcomePosition);
    event MarketCanceled(address marketAddress);
    event MarketReset(address marketAddress);
    event NewOracleCouncilAddress(address oracleCouncilAddress);
    event NewFixedBondAmount(uint fixedBond);
    event NewSafeBoxAddress(address safeBox);
    event NewTagsAddress(address tagsAddress);
    event NewMaximumPositionsAllowed(uint maximumPositionsAllowed);
    event NewPaymentToken(address paymentTokenAddress);
    event NewThalesBonds(address thalesBondsAddress);
    event ResolverPercentageChanged(uint resolverPercentage);
    event CreatorPercentageChanged(uint creatorPercentage);
    event SafeBoxPercentageChanged(uint safeBoxPercentage);
    event WithdrawalPercentageChanged(uint withdrawalPercentage);
    event setPDAOResolveTimePeriodChanged(uint pDAOResolveTimePeriod);
    event NewMaxOracleCouncilMembers(uint maxOracleCouncilMembers);
    event PauserAddressAdded(address pauserAddress);
    event PauserAddressRemoved(address pauserAddress);
    event MarketPaused(address marketAddress);
    event NewDisputePrice(uint disputePrice);
    event NewMaxNumberOfTags(uint maxNumberOfTags);
    event NewArbitraryRewardForDisputor(uint arbitraryRewardForDisputor);
    event NewClaimTimeoutDefaultPeriod(uint claimTimeout);
    event NewDefaultBackstopTimeout(uint timeout);
    event NewSafeBoxLowAmount(uint safeBoxLowAmount);
    // event RewardSentToDisputorForMarket(address market, address disputorAddress, uint amount);
    event NewTheRundownConsumerAddress(address theRundownConsumerAddress);
    event NewMarketDataAddress(address marketDataAddress);
    event CreationRestrictedToOwnerChanged(bool creationRestrictedToOwner);
    event NewMinimumFixedTicketAmount(uint minFixedTicketPrice);
    event NewDisputeStringLengthLimit(uint disputeStringLengthLimit);
    event ExoticRewardsChanged(address exoticRewards);
    event MarketSourceStringLimitChanged(uint marketSourceStringLimit);
    event MarketQuestionStringLimitChanged(uint marketQuestionStringLimit);
    event MarketPositionStringLimitChanged(uint marketPositionStringLimit);
    event OpenBidAllowedChanged(bool openBidAllowed);
    event WithdrawalTimePeriodChanged(uint withdrawalTimePeriod);


    event MarketCreated(
        address marketAddress,
        string marketQuestion,
        string marketSource,
        uint endOfPositioning,
        uint fixedTicketPrice,
        bool withdrawalAllowed,
        uint[] tags,
        uint positionCount,
        string[] positionPhrases,
        address marketOwner
    );

    event CLMarketCreated(
        address marketAddress,
        string marketQuestion,
        string marketSource,
        uint endOfPositioning,
        uint fixedTicketPrice,
        bool withdrawalAllowed,
        uint[] tags,
        uint positionCount,
        string[] positionPhrases,
        address marketOwner
    );

    modifier onlyOracleCouncil() {
        require(msg.sender == oracleCouncilAddress, "Not OracleCouncil address");
        require(oracleCouncilAddress != address(0), "Not OracleCouncil address. Please update valid Oracle address");
        _;
    }
    modifier onlyOracleCouncilAndOwner() {
        require(msg.sender == oracleCouncilAddress || msg.sender == owner, "Not OracleCouncil Address or Owner address");
        if (msg.sender != owner) {
            require(oracleCouncilAddress != address(0), "Not OracleCouncil address. Please update valid Oracle address");
        }
        _;
    }
}

// SPDX-License-Identifier: MIT

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
    uint public maxAmountForOpenBidPosition;
    uint public maxFinalWithdrawPercentage;
    uint public maxFixedTicketPrice;

    function initialize(address _owner) public initializer {
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
    ) external nonReentrant whenNotPaused {
        require(_endOfPositioning >= block.timestamp.add(minimumPositioningDuration), "endOfPositioning too low.");
        require(!creationRestrictedToOwner || msg.sender == owner, "Restricted creation");
        require(
            (openBidAllowed && _fixedTicketPrice == 0) ||
                (_fixedTicketPrice >= minFixedTicketPrice && _fixedTicketPrice <= maxFixedTicketPrice),
            "Exc min/max"
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
            require(IExoticPositionalTags(tagsAddress).isValidTagNumber(_tags[i]), "Invalid tag.");
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
        uint[] memory _positionsOfCreator,
        string[] memory _positionPhrases
    ) external nonReentrant whenNotPaused {
        require(_endOfPositioning >= block.timestamp.add(minimumPositioningDuration), "endOfPositioning too low");
        require(theRundownConsumerAddress != address(0), "Invalid theRundownConsumer");
        require(msg.sender == theRundownConsumerAddress, "Invalid creator");
        require(_tags.length > 0 && _tags.length <= maxNumberOfTags);
        require(keccak256(abi.encode(_marketQuestion)) != keccak256(abi.encode("")), "Invalid question");
        require(keccak256(abi.encode(_marketSource)) != keccak256(abi.encode("")), "Invalid source");
        require(_positionCount == _positionPhrases.length, "Invalid posCount");
        require(bytes(_marketQuestion).length < 110, "Q exceeds length");
        require(thereAreNonEqualPositions(_positionPhrases), "Equal pos phrases");
        require(_positionsOfCreator.length == _positionCount, "Creator deposits wrong");
        uint totalCreatorDeposit;
        uint[] memory creatorPositions = new uint[](_positionCount);
        for (uint i = 0; i < _positionCount; i++) {
            totalCreatorDeposit = totalCreatorDeposit.add(_positionsOfCreator[i]);
            creatorPositions[i] = i + 1;
        }
        require(IERC20(paymentToken).balanceOf(msg.sender) >= totalCreatorDeposit, "Low creation amount");
        require(IERC20(paymentToken).allowance(msg.sender, thalesBonds) >= totalCreatorDeposit, "No allowance.");

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
        // IThalesBonds(thalesBonds).sendCreatorBondToMarket(address(exoticMarket), msg.sender, exoticMarket.fixedBondAmount());
        _activeMarkets.add(address(exoticMarket));
        exoticMarket.takeCreatorInitialOpenBidPositions(creatorPositions, _positionsOfCreator);
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

    function resolveMarket(address _marketAddress, uint _outcomePosition) external whenNotPaused {
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

    function cancelMarket(address _marketAddress) external whenNotPaused {
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
    ) external onlyOracleCouncilAndOwner whenNotPaused {
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
        if (
            IThalesBonds(thalesBonds).getCreatorBondForMarket(_marketAddress) > 0 ||
            IThalesBonds(thalesBonds).getResolverBondForMarket(_marketAddress) > 0
        ) {
            IThalesBonds(thalesBonds).issueBondsBackToCreatorAndResolver(_marketAddress);
        }
    }

    function disputeMarket(address _marketAddress, address _disputor) external onlyOracleCouncil whenNotPaused {
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

    function closeDispute(address _marketAddress) external onlyOracleCouncilAndOwner whenNotPaused {
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

    function getActiveMarketAddress(uint _index) external view returns (address) {
        return _activeMarkets.elements[_index];
    }

    function isPauserAddress(address _pauser) external view returns (bool) {
        return pauserIndex[_pauser] > 0;
    }

    // SETTERS ///////////////////////////////////////////////////////////////////////////

    function setBackstopTimeout(address _market) external onlyOracleCouncilAndOwner {
        IExoticPositionalMarket(_market).setBackstopTimeout(backstopTimeout);
    }

    function setCustomBackstopTimeout(address _market, uint _timeout) external onlyOracleCouncilAndOwner {
        require(_timeout > 0, "Invalid timeout");
        if (IExoticPositionalMarket(_market).backstopTimeout() != _timeout) {
            IExoticPositionalMarket(_market).setBackstopTimeout(_timeout);
        }
    }

    function setAddresses(
        address _exoticMarketMastercopy,
        address _exoticMarketOpenBidMastercopy,
        address _oracleCouncilAddress,
        address _paymentToken,
        address _tagsAddress,
        address _theRundownConsumerAddress,
        address _marketDataAddress,
        address _exoticRewards,
        address _safeBoxAddress
    ) external onlyOwner {
        if (_paymentToken != paymentToken) {
            paymentToken = _paymentToken;
        }
        if (_exoticMarketMastercopy != exoticMarketMastercopy) {
            exoticMarketMastercopy = _exoticMarketMastercopy;
        }
        if (_exoticMarketOpenBidMastercopy != exoticMarketOpenBidMastercopy) {
            exoticMarketOpenBidMastercopy = _exoticMarketOpenBidMastercopy;
        }
        if (_oracleCouncilAddress != oracleCouncilAddress) {
            oracleCouncilAddress = _oracleCouncilAddress;
        }
        if (_tagsAddress != tagsAddress) {
            tagsAddress = _tagsAddress;
        }

        if (_theRundownConsumerAddress != theRundownConsumerAddress) {
            theRundownConsumerAddress = _theRundownConsumerAddress;
        }

        if (_marketDataAddress != marketDataAddress) {
            marketDataAddress = _marketDataAddress;
        }
        if (_exoticRewards != exoticRewards) {
            exoticRewards = _exoticRewards;
        }

        if (_safeBoxAddress != safeBoxAddress) {
            safeBoxAddress = _safeBoxAddress;
        }
        emit AddressesUpdated(
            _paymentToken,
            _exoticMarketMastercopy,
            _exoticMarketOpenBidMastercopy,
            _oracleCouncilAddress,
            _tagsAddress,
            _theRundownConsumerAddress,
            _marketDataAddress,
            _exoticRewards,
            _safeBoxAddress
        );
    }

    function setPercentages(
        uint _safeBoxPercentage,
        uint _creatorPercentage,
        uint _resolverPercentage,
        uint _withdrawalPercentage,
        uint _maxFinalWithdrawPercentage
    ) external onlyOwner {
        if (_safeBoxPercentage != safeBoxPercentage) {
            safeBoxPercentage = _safeBoxPercentage;
        }
        if (_creatorPercentage != creatorPercentage) {
            creatorPercentage = _creatorPercentage;
        }
        if (_resolverPercentage != resolverPercentage) {
            resolverPercentage = _resolverPercentage;
        }
        if (_withdrawalPercentage != withdrawalPercentage) {
            withdrawalPercentage = _withdrawalPercentage;
        }
        if (_maxFinalWithdrawPercentage != maxFinalWithdrawPercentage) {
            maxFinalWithdrawPercentage = _maxFinalWithdrawPercentage;
        }
        emit PercentagesUpdated(
            _safeBoxPercentage,
            _creatorPercentage,
            _resolverPercentage,
            _withdrawalPercentage,
            _maxFinalWithdrawPercentage
        );
    }

    function setDurations(
        uint _backstopTimeout,
        uint _minimumPositioningDuration,
        uint _withdrawalTimePeriod,
        uint _pDAOResolveTimePeriod,
        uint _claimTimeoutDefaultPeriod
    ) external onlyOwner {
        if (_backstopTimeout != backstopTimeout) {
            backstopTimeout = _backstopTimeout;
        }

        if (_minimumPositioningDuration != minimumPositioningDuration) {
            minimumPositioningDuration = _minimumPositioningDuration;
        }

        if (_withdrawalTimePeriod != withdrawalTimePeriod) {
            withdrawalTimePeriod = _withdrawalTimePeriod;
        }

        if (_pDAOResolveTimePeriod != pDAOResolveTimePeriod) {
            pDAOResolveTimePeriod = _pDAOResolveTimePeriod;
        }

        if (_claimTimeoutDefaultPeriod != claimTimeoutDefaultPeriod) {
            claimTimeoutDefaultPeriod = _claimTimeoutDefaultPeriod;
        }

        emit DurationsUpdated(
            _backstopTimeout,
            _minimumPositioningDuration,
            _withdrawalTimePeriod,
            _pDAOResolveTimePeriod,
            _claimTimeoutDefaultPeriod
        );
    }

    function setLimits(
        uint _marketQuestionStringLimit,
        uint _marketSourceStringLimit,
        uint _marketPositionStringLimit,
        uint _disputeStringLengthLimit,
        uint _maximumPositionsAllowed,
        uint _maxNumberOfTags,
        uint _maxOracleCouncilMembers
    ) external onlyOwner {
        if (_marketQuestionStringLimit != marketQuestionStringLimit) {
            marketQuestionStringLimit = _marketQuestionStringLimit;
        }

        if (_marketSourceStringLimit != marketSourceStringLimit) {
            marketSourceStringLimit = _marketSourceStringLimit;
        }

        if (_marketPositionStringLimit != marketPositionStringLimit) {
            marketPositionStringLimit = _marketPositionStringLimit;
        }

        if (_disputeStringLengthLimit != disputeStringLengthLimit) {
            disputeStringLengthLimit = _disputeStringLengthLimit;
        }

        if (_maximumPositionsAllowed != maximumPositionsAllowed) {
            maximumPositionsAllowed = _maximumPositionsAllowed;
        }

        if (_maxNumberOfTags != maxNumberOfTags) {
            maxNumberOfTags = _maxNumberOfTags;
        }

        if (_maxOracleCouncilMembers != maxOracleCouncilMembers) {
            maxOracleCouncilMembers = _maxOracleCouncilMembers;
        }

        emit LimitsUpdated(
            _marketQuestionStringLimit,
            _marketSourceStringLimit,
            _marketPositionStringLimit,
            _disputeStringLengthLimit,
            _maximumPositionsAllowed,
            _maxNumberOfTags,
            _maxOracleCouncilMembers
        );
    }

    function setAmounts(
        uint _minFixedTicketPrice,
        uint _maxFixedTicketPrice,
        uint _disputePrice,
        uint _fixedBondAmount,
        uint _safeBoxLowAmount,
        uint _arbitraryRewardForDisputor,
        uint _maxAmountForOpenBidPosition
    ) external onlyOwner {
        if (_minFixedTicketPrice != minFixedTicketPrice) {
            minFixedTicketPrice = _minFixedTicketPrice;
        }
        
        if (_maxFixedTicketPrice != maxFixedTicketPrice) {
            maxFixedTicketPrice = _maxFixedTicketPrice;
        }

        if (_disputePrice != disputePrice) {
            disputePrice = _disputePrice;
        }

        if (_fixedBondAmount != fixedBondAmount) {
            fixedBondAmount = _fixedBondAmount;
        }

        if (_safeBoxLowAmount != safeBoxLowAmount) {
            safeBoxLowAmount = _safeBoxLowAmount;
        }

        if (_arbitraryRewardForDisputor != arbitraryRewardForDisputor) {
            arbitraryRewardForDisputor = _arbitraryRewardForDisputor;
        }

        if (_maxAmountForOpenBidPosition != maxAmountForOpenBidPosition) {
            maxAmountForOpenBidPosition = _maxAmountForOpenBidPosition;
        }

        emit AmountsUpdated(
            _minFixedTicketPrice,
            _maxFixedTicketPrice,
            _disputePrice,
            _fixedBondAmount,
            _safeBoxLowAmount,
            _arbitraryRewardForDisputor,
            _maxAmountForOpenBidPosition
        );
    }

    function setFlags(bool _creationRestrictedToOwner, bool _openBidAllowed) external onlyOwner {
        if (_creationRestrictedToOwner != creationRestrictedToOwner) {
            creationRestrictedToOwner = _creationRestrictedToOwner;
        }

        if (_openBidAllowed != openBidAllowed) {
            openBidAllowed = _openBidAllowed;
        }

        emit FlagsUpdated(_creationRestrictedToOwner, _openBidAllowed);
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

    event AddressesUpdated(
        address _exoticMarketMastercopy,
        address _exoticMarketOpenBidMastercopy,
        address _oracleCouncilAddress,
        address _paymentToken,
        address _tagsAddress,
        address _theRundownConsumerAddress,
        address _marketDataAddress,
        address _exoticRewards,
        address _safeBoxAddress
    );

    event PercentagesUpdated(
        uint safeBoxPercentage,
        uint creatorPercentage,
        uint resolverPercentage,
        uint withdrawalPercentage,
        uint maxFinalWithdrawPercentage
    );

    event DurationsUpdated(
        uint backstopTimeout,
        uint minimumPositioningDuration,
        uint withdrawalTimePeriod,
        uint pDAOResolveTimePeriod,
        uint claimTimeoutDefaultPeriod
    );
    event LimitsUpdated(
        uint marketQuestionStringLimit,
        uint marketSourceStringLimit,
        uint marketPositionStringLimit,
        uint disputeStringLengthLimit,
        uint maximumPositionsAllowed,
        uint maxNumberOfTags,
        uint maxOracleCouncilMembers
    );

    event AmountsUpdated(
        uint minFixedTicketPrice,
        uint maxFixedTicketPrice,
        uint disputePrice,
        uint fixedBondAmount,
        uint safeBoxLowAmount,
        uint arbitraryRewardForDisputor,
        uint maxAmountForOpenBidPosition
    );

    event FlagsUpdated(bool _creationRestrictedToOwner, bool _openBidAllowed);

    event MarketResolved(address marketAddress, uint outcomePosition);
    event MarketCanceled(address marketAddress);
    event MarketReset(address marketAddress);
    event PauserAddressAdded(address pauserAddress);
    event PauserAddressRemoved(address pauserAddress);
    event NewThalesBonds(address thalesBondsAddress);

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
        require(msg.sender == oracleCouncilAddress, "No OC");
        require(oracleCouncilAddress != address(0), "No OC");
        _;
    }
    modifier onlyOracleCouncilAndOwner() {
        require(msg.sender == oracleCouncilAddress || msg.sender == owner, "No OC/owner");
        if (msg.sender != owner) {
            require(oracleCouncilAddress != address(0), "No OC/owner");
        }
        _;
    }
}

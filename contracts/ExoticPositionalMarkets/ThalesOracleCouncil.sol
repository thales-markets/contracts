pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../interfaces/IExoticPositionalMarket.sol";
import "../interfaces/IExoticPositionalMarketManager.sol";
import "../interfaces/IThalesBonds.sol";

contract ThalesOracleCouncil is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    using SafeMath for uint;
    uint private constant COUNCIL_MAX_MEMBERS = 5;
    uint private constant VOTING_OPTIONS = 7;

    uint private constant ACCEPT_SLASH = 1;
    uint private constant ACCEPT_NO_SLASH = 2;
    uint private constant REFUSE_ON_POSITIONING = 3;
    uint private constant ACCEPT_RESULT = 4;
    uint private constant ACCEPT_RESET = 5;
    uint private constant REFUSE_MATURE = 6;

    uint private constant TEN_SUSD = 10 * 1e18;

    mapping(uint => address) public councilMemberAddress;
    mapping(address => uint) public councilMemberIndex;
    uint public councilMemberCount;
    IExoticPositionalMarketManager public marketManager;

    struct Dispute {
        address disputorAddress;
        string disputeString;
        uint disputeCode;
        uint disputeTimestamp;
        bool disputeInPositioningPhase;
    }

    mapping(address => mapping(uint => Dispute)) public dispute;
    mapping(address => uint) public marketTotalDisputes;
    mapping(address => uint) public marketLastClosedDispute;
    mapping(address => bool) public marketClosedForDisputes;

    mapping(address => mapping(uint => uint[])) public disputeVote;
    mapping(address => mapping(uint => uint[VOTING_OPTIONS])) public disputeVotesCount;
    mapping(address => mapping(uint => uint)) public disputeWinningPositionChoosen;
    mapping(address => address) public firstMemberThatChoseWinningPosition;
    mapping(address => uint) public allOpenDisputesCancelledToIndexForMarket;
    mapping(address => mapping(uint => mapping(address => uint))) public disputeWinningPositionChoosenByMember;
    mapping(address => mapping(uint => mapping(uint => uint))) public disputeWinningPositionVotes;

    function initialize(address _owner, address _marketManager) public initializer {
        setOwner(_owner);
        initNonReentrant();
        marketManager = IExoticPositionalMarketManager(_marketManager);
    }

    /* ========== VIEWS ========== */

    function canMarketBeDisputed(address _market) public view returns (bool) {
        return !marketClosedForDisputes[_market] && IExoticPositionalMarket(_market).isMarketCreated();
    }

    function getMarketOpenDisputes(address _market) public view returns (uint) {
        return marketTotalDisputes[_market].sub(marketLastClosedDispute[_market]);
    }

    function getNextOpenDisputeIndex(address _market) public view returns (uint) {
        if (getMarketOpenDisputes(_market) > 0) {
            return (marketLastClosedDispute[_market].add(1));
        } else {
            return 0;
        }
    }

    function getMarketClosedDisputes(address _market) external view returns (uint) {
        return marketLastClosedDispute[_market];
    }

    function getNumberOfCouncilMembersForMarketDispute(address _market, uint _index) external view returns (uint) {
        // zero index does not count
        return disputeVote[_market][_index].length.sub(1);
    }

    function getVotesCountForMarketDispute(address _market, uint _index) public view returns (uint) {
        uint count = 0;
        // council members index starts from 1
        for (uint i = 1; i < disputeVote[_market][_index].length; i++) {
            count += disputeVote[_market][_index][i] > 0 ? 1 : 0;
        }
        return count;
    }

    function getVotesMissingForMarketDispute(address _market, uint _index) external view returns (uint) {
        return disputeVote[_market][_index].length.sub(1).sub(getVotesCountForMarketDispute(_market, _index));
    }

    function getDispute(address _market, uint _index) external view returns (Dispute memory) {
        return dispute[_market][_index];
    }

    function getDisputeTimestamp(address _market, uint _index) external view returns (uint) {
        return dispute[_market][_index].disputeTimestamp;
    }

    function getDisputeAddressOfDisputor(address _market, uint _index) external view returns (address) {
        return dispute[_market][_index].disputorAddress;
    }

    function getDisputeString(address _market, uint _index) external view returns (string memory) {
        return dispute[_market][_index].disputeString;
    }

    function getDisputeCode(address _market, uint _index) external view returns (uint) {
        return dispute[_market][_index].disputeCode;
    }

    function getDisputeVotes(address _market, uint _index) external view returns (uint[] memory) {
        return disputeVote[_market][_index];
    }
    
    function getDisputeVoteOfCouncilMember(address _market, uint _index, address _councilMember) external view returns (uint) {
        if(isOracleCouncilMember(_councilMember)) {
            return disputeVote[_market][_index][councilMemberIndex[_councilMember]];
        }
        else {
            require(isOracleCouncilMember(_councilMember), "Not a council member");
            return 1e18;
        }
    }

    function isDisputeOpen(address _market, uint _index) external view returns (bool) {
        return dispute[_market][_index].disputeCode == 0;
    }

    function isDisputeCancelled(address _market, uint _index) external view returns (bool) {
        return
            dispute[_market][_index].disputeCode == REFUSE_ON_POSITIONING ||
            dispute[_market][_index].disputeCode == REFUSE_MATURE;
    }

    function isOpenDisputeCancelled(address _market, uint _disputeIndex) external view returns (bool) {
        return
            (marketClosedForDisputes[_market] || _disputeIndex <= allOpenDisputesCancelledToIndexForMarket[_market]) &&
            dispute[_market][_disputeIndex].disputeCode == 0 &&
            marketLastClosedDispute[_market] != _disputeIndex;
    }

    function canDisputorClaimbackBondFromUnclosedDispute(
        address _market,
        uint _disputeIndex,
        address _disputorAddress
    ) public view returns (bool) {
        if (
            _disputeIndex <= marketTotalDisputes[_market] &&
            (marketClosedForDisputes[_market] || _disputeIndex <= allOpenDisputesCancelledToIndexForMarket[_market]) &&
            dispute[_market][_disputeIndex].disputorAddress == _disputorAddress &&
            dispute[_market][_disputeIndex].disputeCode == 0 &&
            marketLastClosedDispute[_market] != _disputeIndex &&
            IThalesBonds(marketManager.thalesBonds()).getDisputorBondForMarket(_market, _disputorAddress) > 0
        ) {
            return true;
        } else {
            return false;
        }
    }

    function isOracleCouncilMember(address _councilMember) public view returns (bool) {
        return (councilMemberIndex[_councilMember] > 0);
    }

    function isMarketClosedForDisputes(address _market) public view returns (bool) {
        return marketClosedForDisputes[_market] || IExoticPositionalMarket(_market).canUsersClaim();
    }

    function setMarketManager(address _marketManager) external onlyOwner {
        require(_marketManager != address(0), "Invalid manager address");
        marketManager = IExoticPositionalMarketManager(_marketManager);
        emit NewMarketManager(_marketManager);
    }

    function addOracleCouncilMember(address _councilMember) external onlyOwner {
        require(_councilMember != address(0), "Invalid address. Add valid address");
        require(councilMemberCount <= marketManager.maxOracleCouncilMembers(), "Number of Oracle Council members exceeded");
        require(!isOracleCouncilMember(_councilMember), "Already Oracle Council member");
        councilMemberCount = councilMemberCount.add(1);
        councilMemberAddress[councilMemberCount] = _councilMember;
        councilMemberIndex[_councilMember] = councilMemberCount;
        marketManager.addPauserAddress(_councilMember);
        emit NewOracleCouncilMember(_councilMember, councilMemberCount);
    }

    function removeOracleCouncilMember(address _councilMember) external onlyOwner {
        require(isOracleCouncilMember(_councilMember), "Not an Oracle Council member");
        councilMemberAddress[councilMemberIndex[_councilMember]] = councilMemberAddress[councilMemberCount];
        councilMemberIndex[councilMemberAddress[councilMemberCount]] = councilMemberIndex[_councilMember];
        councilMemberCount = councilMemberCount.sub(1);
        councilMemberIndex[_councilMember] = 0;
        marketManager.removePauserAddress(_councilMember);
        emit OracleCouncilMemberRemoved(_councilMember, councilMemberCount);
    }

    function openDispute(address _market, string memory _disputeString) external whenNotPaused {
        require(IExoticPositionalMarket(_market).isMarketCreated(), "Market not created");
        require(!isMarketClosedForDisputes(_market), "Market is closed for disputes");
        require(marketManager.creatorAddress(_market) != msg.sender, "Creator can not dispute market");
        require(!isOracleCouncilMember(msg.sender), "Oracle Council member can not open dispute.");
        require(
            IERC20(marketManager.paymentToken()).balanceOf(msg.sender) >= IExoticPositionalMarket(_market).disputePrice(),
            "Low token amount for disputing market"
        );
        require(
            IERC20(marketManager.paymentToken()).allowance(msg.sender, marketManager.thalesBonds()) >=
                IExoticPositionalMarket(_market).disputePrice(),
            "No allowance. Please approve ticket price allowance"
        );
        require(
            keccak256(abi.encode(_disputeString)) != keccak256(abi.encode("")),
            "Invalid market question (empty string)"
        );
        marketTotalDisputes[_market] = marketTotalDisputes[_market].add(1);
        dispute[_market][marketTotalDisputes[_market]].disputorAddress = msg.sender;
        dispute[_market][marketTotalDisputes[_market]].disputeString = _disputeString;
        dispute[_market][marketTotalDisputes[_market]].disputeTimestamp = block.timestamp;
        disputeVote[_market][marketTotalDisputes[_market]] = new uint[](councilMemberCount + 1);
        if (!IExoticPositionalMarket(_market).resolved()) {
            dispute[_market][marketTotalDisputes[_market]].disputeInPositioningPhase = true;
        }
        marketManager.disputeMarket(_market, msg.sender);
        emit NewDispute(
            _market,
            _disputeString,
            dispute[_market][marketTotalDisputes[_market]].disputeInPositioningPhase,
            msg.sender
        );
    }

    function voteForDispute(
        address _market,
        uint _disputeIndex,
        uint _disputeCodeVote,
        uint _winningPosition
    ) external onlyCouncilMembers {
        require(!isMarketClosedForDisputes(_market), "Market is closed for disputes. No reason for voting");
        require(_disputeIndex > 0, "Dispute non existent");
        require(dispute[_market][_disputeIndex].disputeCode == 0, "Dispute already closed.");
        require(_disputeCodeVote <= VOTING_OPTIONS && _disputeCodeVote > 0, "Invalid dispute code.");
        if (dispute[_market][_disputeIndex].disputeInPositioningPhase) {
            require(_disputeCodeVote < ACCEPT_RESULT, "Invalid voting code for dispute in positioning phase");
        } else {
            require(_disputeCodeVote >= ACCEPT_RESULT, "Invalid voting code for dispute in maturity phase");
            require(
                _disputeIndex > allOpenDisputesCancelledToIndexForMarket[_market],
                "Dispute is already cancelled previously"
            );
        }
        if (_winningPosition > 0 && _disputeCodeVote == ACCEPT_RESULT) {
            require(
                _winningPosition != IExoticPositionalMarket(_market).winningPosition(),
                "OC member can not vote for the resolved position"
            );
            require(
                disputeWinningPositionChoosenByMember[_market][_disputeIndex][msg.sender] != _winningPosition,
                "Voting for same winning position"
            );
            if (disputeWinningPositionChoosenByMember[_market][_disputeIndex][msg.sender] == 0) {
                disputeWinningPositionChoosenByMember[_market][_disputeIndex][msg.sender] = _winningPosition;
                disputeWinningPositionVotes[_market][_disputeIndex][_winningPosition] = disputeWinningPositionVotes[_market][
                    _disputeIndex
                ][_winningPosition]
                    .add(1);
            } else {
                disputeWinningPositionVotes[_market][_disputeIndex][
                    disputeWinningPositionChoosenByMember[_market][_disputeIndex][msg.sender]
                ] = disputeWinningPositionVotes[_market][_disputeIndex][
                    disputeWinningPositionChoosenByMember[_market][_disputeIndex][msg.sender]
                ]
                    .sub(1);
                disputeWinningPositionChoosenByMember[_market][_disputeIndex][msg.sender] = _winningPosition;
                disputeWinningPositionVotes[_market][_disputeIndex][_winningPosition] = disputeWinningPositionVotes[_market][
                    _disputeIndex
                ][_winningPosition]
                    .add(1);
            }
        }

        // check if already has voted for another option, and revert the vote
        if (disputeVote[_market][_disputeIndex][councilMemberIndex[msg.sender]] > 0) {
            disputeVotesCount[_market][_disputeIndex][
                disputeVote[_market][_disputeIndex][councilMemberIndex[msg.sender]]
            ] = disputeVotesCount[_market][_disputeIndex][
                disputeVote[_market][_disputeIndex][councilMemberIndex[msg.sender]]
            ]
                .sub(1);
        }

        // record the voting option
        disputeVote[_market][_disputeIndex][councilMemberIndex[msg.sender]] = _disputeCodeVote;
        disputeVotesCount[_market][_disputeIndex][_disputeCodeVote] = disputeVotesCount[_market][_disputeIndex][
            _disputeCodeVote
        ]
            .add(1);

        emit VotedAddedForDispute(_market, _disputeIndex, _disputeCodeVote, _winningPosition, msg.sender);

        if (disputeVotesCount[_market][_disputeIndex][_disputeCodeVote] > (councilMemberCount.div(2))) {
            if (_disputeCodeVote == ACCEPT_RESULT) {
                (uint maxVotesForPosition, uint chosenPosition) =
                    calculateWinningPositionBasedOnVotes(_market, _disputeIndex);
                if(maxVotesForPosition > (councilMemberCount.div(2))) {
                    disputeWinningPositionChoosen[_market][_disputeIndex] = chosenPosition;
                    closeDispute(_market, _disputeIndex, _disputeCodeVote);
                }
            }
            else {
                closeDispute(_market, _disputeIndex, _disputeCodeVote);
            }
        }
    }

    function closeDispute(
        address _market,
        uint _disputeIndex,
        uint _decidedOption
    ) internal nonReentrant {
        require(dispute[_market][_disputeIndex].disputeCode == 0, "Dispute already closed");
        require(_decidedOption > 0, "Invalid decided option");
        dispute[_market][_disputeIndex].disputeCode = _decidedOption;
        if (_decidedOption == REFUSE_ON_POSITIONING || _decidedOption == REFUSE_MATURE) {
            // set dispute to false
            // send disputor BOND to SafeBox
            // marketManager.getMarketBondAmount(_market);
            IThalesBonds(marketManager.thalesBonds()).sendBondFromMarketToUser(
                _market,
                marketManager.safeBoxAddress(),
                IExoticPositionalMarket(_market).disputePrice()
            );
            marketLastClosedDispute[_market] = _disputeIndex;
            //if it is the last dispute
            if (_decidedOption == REFUSE_MATURE) {
                marketManager.setBackstopTimeout(_market);
            }
            if (marketLastClosedDispute[_market] == marketTotalDisputes[_market]) {
                marketManager.closeDispute(_market);
            }
            emit DisputeClosed(_market, _disputeIndex, _decidedOption);
        } else if (_decidedOption == ACCEPT_SLASH) {
            // 4 hours
            marketManager.setBackstopTimeout(_market);
            // close dispute flag
            marketManager.closeDispute(_market);
            // cancel market
            marketManager.cancelMarket(_market);
            marketClosedForDisputes[_market] = true;
            // send bond to disputor and safeBox
            IThalesBonds(marketManager.thalesBonds()).sendBondFromMarketToUser(
                _market,
                marketManager.safeBoxAddress(),
                IExoticPositionalMarket(_market).safeBoxLowAmount()
            );
            IThalesBonds(marketManager.thalesBonds()).sendBondFromMarketToUser(
                _market,
                dispute[_market][_disputeIndex].disputorAddress,
                (IExoticPositionalMarket(_market).fixedBondAmount().add(IExoticPositionalMarket(_market).disputePrice()))
                    .sub(IExoticPositionalMarket(_market).safeBoxLowAmount())
            );

            marketLastClosedDispute[_market] = _disputeIndex;
            emit MarketClosedForDisputes(_market, _decidedOption);
            emit DisputeClosed(_market, _disputeIndex, _decidedOption);
        } else if (_decidedOption == ACCEPT_NO_SLASH) {
            // 4 hours
            marketManager.setBackstopTimeout(_market);
            // close dispute flag
            marketManager.closeDispute(_market);
            // close market(cancel market)
            marketManager.cancelMarket(_market);
            marketClosedForDisputes[_market] = true;
            // send bond to disputor and safeBox
            // IThalesBonds(marketManager.thalesBonds()).sendBondFromMarketToUser(_market, marketManager.safeBoxAddress(), marketManager.safeBoxLowAmount());
            IThalesBonds(marketManager.thalesBonds()).sendBondFromMarketToUser(
                _market,
                marketManager.creatorAddress(_market),
                IExoticPositionalMarket(_market).fixedBondAmount()
            );
            IThalesBonds(marketManager.thalesBonds()).sendBondFromMarketToUser(
                _market,
                dispute[_market][_disputeIndex].disputorAddress,
                IExoticPositionalMarket(_market).disputePrice().sub(IExoticPositionalMarket(_market).safeBoxLowAmount())
            );
            marketManager.sendRewardToDisputor(
                _market,
                dispute[_market][_disputeIndex].disputorAddress,
                IExoticPositionalMarket(_market).arbitraryRewardForDisputor()
            );

            marketLastClosedDispute[_market] = _disputeIndex;
            emit MarketClosedForDisputes(_market, _decidedOption);
            emit DisputeClosed(_market, _disputeIndex, _decidedOption);
        } else if (_decidedOption == ACCEPT_RESULT) {
            // close market
            // timer backstop
            marketManager.setBackstopTimeout(_market);
            // close dispute flag
            marketManager.closeDispute(_market);
            // set result
            marketManager.resolveMarket(_market, disputeWinningPositionChoosen[_market][_disputeIndex]);
            IThalesBonds(marketManager.thalesBonds()).sendBondFromMarketToUser(
                _market,
                marketManager.safeBoxAddress(),
                IExoticPositionalMarket(_market).fixedBondAmount()
            );
            IThalesBonds(marketManager.thalesBonds()).sendBondFromMarketToUser(
                _market,
                dispute[_market][_disputeIndex].disputorAddress,
                IExoticPositionalMarket(_market).disputePrice()
            );

            marketClosedForDisputes[_market] = true;
            marketLastClosedDispute[_market] = _disputeIndex;
            emit MarketClosedForDisputes(_market, _decidedOption);
            emit DisputeClosed(_market, _disputeIndex, _decidedOption);
        } else if (_decidedOption == ACCEPT_RESET) {
            // close dispute flag
            marketManager.closeDispute(_market);
            // reset result
            marketManager.resetMarket(_market);
            IThalesBonds(marketManager.thalesBonds()).sendBondFromMarketToUser(
                _market,
                marketManager.safeBoxAddress(),
                IExoticPositionalMarket(_market).safeBoxLowAmount()
            );
            IThalesBonds(marketManager.thalesBonds()).sendBondFromMarketToUser(
                _market,
                dispute[_market][_disputeIndex].disputorAddress,
                IExoticPositionalMarket(_market).fixedBondAmount().add(IExoticPositionalMarket(_market).disputePrice()).sub(
                    IExoticPositionalMarket(_market).safeBoxLowAmount()
                )
            );
            allOpenDisputesCancelledToIndexForMarket[_market] = marketTotalDisputes[_market];
            marketLastClosedDispute[_market] = _disputeIndex;
            emit DisputeClosed(_market, _disputeIndex, _decidedOption);
        } else {
            // (CANCEL)
            //4 hours backstop
            // marketManager.setBackstopTimeout(_market);
            // close market disputes
            // marketClosedForDisputes[_market] = true;
            // close market(cancel market)
            // marketManager.cancelMarket(_market);
        }
    }

    function claimUnclosedDisputeBonds(address _market, uint _disputeIndex) external whenNotPaused {
        require(
            canDisputorClaimbackBondFromUnclosedDispute(_market, _disputeIndex, msg.sender),
            "Unable to claim bonds. Check if market is closed for disputes, disputor index, and dispute address"
        );
        IThalesBonds(marketManager.thalesBonds()).sendOpenDisputeBondFromMarketToDisputor(
            _market,
            msg.sender,
            IThalesBonds(marketManager.thalesBonds()).getDisputorBondForMarket(_market, msg.sender)
        );
    }

    function calculateWinningPositionBasedOnVotes(address _market, uint _disputeIndex) internal view returns (uint, uint) {
        uint maxVotes;
        uint position;
        for (uint i = 0; i <= IExoticPositionalMarket(_market).positionCount(); i++) {
            if (disputeWinningPositionVotes[_market][_disputeIndex][i] > maxVotes) {
                maxVotes = disputeWinningPositionVotes[_market][_disputeIndex][i];
                position = i;
            }
        }

        return (maxVotes, position);
    }

    function closeMarketForDisputes(address _market) external onlyOwner {
        require(!marketClosedForDisputes[_market], "Market already closed for disputes");
        marketClosedForDisputes[_market] = true;
        emit MarketClosedForDisputes(_market, 0);
    }

    function reopenMarketForDisputes(address _market) external onlyOwner {
        require(marketClosedForDisputes[_market], "Market already open for disputes");
        marketClosedForDisputes[_market] = false;
        emit MarketReopenedForDisputes(_market);
    }

    modifier onlyCouncilMembers() {
        require(isOracleCouncilMember(msg.sender), "Issuer not a council member");
        _;
    }
    event NewOracleCouncilMember(address councilMember, uint councilMemberCount);
    event OracleCouncilMemberRemoved(address councilMember, uint councilMemberCount);
    event NewMarketManager(address marketManager);
    event NewDispute(address market, string disputeString, bool disputeInPositioningPhase, address disputorAccount);
    event VotedAddedForDispute(address market, uint disputeIndex, uint disputeCodeVote, uint winningPosition, address voter);
    event MarketClosedForDisputes(address market, uint disputeFinalCode);
    event MarketReopenedForDisputes(address market);
    event DisputeClosed(address market, uint disputeIndex, uint decidedOption);
}

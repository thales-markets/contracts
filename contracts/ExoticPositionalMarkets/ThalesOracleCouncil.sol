pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../interfaces/IExoticPositionalMarket.sol";
import "../interfaces/IExoticPositionalMarketManager.sol";

contract ThalesOracleCouncil is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard  {
    using SafeMath for uint;
    uint private constant COUNCIL_MAX_MEMBERS = 5;
    uint private constant VOTING_OPTIONS = 7;
    
    uint private constant ACCEPT_SLASH = 1;
    uint private constant ACCEPT_NO_SLASH = 2;
    uint private constant REFUSE_ON_POSITIONING = 3;
    uint private constant ACCEPT_RESULT = 4;
    uint private constant ACCEPT_RESET = 5;
    uint private constant REFUSE_MATURE = 6;

    mapping(uint => address) public councilMemberAddress;
    mapping(address => uint) public councilMemberIndex;
    uint public councilMemberCount;
    IERC20 public paymentToken;
    IExoticPositionalMarketManager public marketManager;
    uint public disputePrice;

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

    function initialize(
        address _owner,
        uint _disputePrice,
        address _paymentToken,
        address _marketManager
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        disputePrice = _disputePrice;
        paymentToken = IERC20(_paymentToken);
        marketManager = IExoticPositionalMarketManager(_marketManager);
    }
    /* ========== VIEWS ========== */

    function getMarketOpenDisputes(address _market) public view returns (uint) {
        return marketTotalDisputes[_market].sub(marketLastClosedDispute[_market]);
    }
    
    function getMarketClosedDisputes(address _market) external view returns (uint) {
        return marketLastClosedDispute[_market];
    }

    function getDistpute(address _market, uint _index) external view returns(Dispute memory) {
        return dispute[_market][_index];
    }
    
    function getDistputeTimestamp(address _market, uint _index) external view returns(uint) {
        return dispute[_market][_index].disputeTimestamp;
    }
    
    function getDistputeAddressOfDisputor(address _market, uint _index) external view returns(address) {
        return dispute[_market][_index].disputorAddress;
    }
    
    function getDistputeString(address _market, uint _index) external view returns(string memory) {
        return dispute[_market][_index].disputeString;
    }
    
    function getDistputeCode(address _market, uint _index) external view returns(uint) {
        return dispute[_market][_index].disputeCode;
    }
    
    function getDistputeVotes(address _market, uint _index) external view returns(uint[] memory) {
        return disputeVote[_market][_index];
    }

    function isOracleCouncilMember(address _councilMember) public view returns(bool) {
        return (councilMemberIndex[_councilMember] > 0);
    }


    function setMarketManager(address _marketManager) external onlyOwner {
        require(_marketManager != address(0), "Invalid manager address");
        marketManager = IExoticPositionalMarketManager(_marketManager);
        emit NewMarketManager(_marketManager);
    }

    function addOracleCouncilMember(address _councilMember) external onlyOwner {
        require(_councilMember != address(0), "Invalid address. Add valid address");
        require(councilMemberCount < COUNCIL_MAX_MEMBERS, "Invalid address. Add valid address");
        require(!isOracleCouncilMember(_councilMember), "Already Oracle Council member");
        councilMemberCount = councilMemberCount.add(1);
        councilMemberAddress[councilMemberCount] = _councilMember;
        councilMemberIndex[_councilMember] = councilMemberCount;
        emit NewOracleCouncilMember(_councilMember, councilMemberCount);
    }
    
    function removeOracleCouncilMember(address _councilMember) external onlyOwner {
        require(isOracleCouncilMember(_councilMember), "Not an Oracle Council member");
        councilMemberAddress[councilMemberIndex[_councilMember]] = councilMemberAddress[councilMemberCount];
        councilMemberIndex[councilMemberAddress[councilMemberCount]] = councilMemberIndex[_councilMember];
        councilMemberCount = councilMemberCount.sub(1);
        emit OracleCouncilMemberRemoved(_councilMember, councilMemberCount);
    }

    function openDispute(address _market, string memory _disputeString) external whenNotPaused {
        require(IExoticPositionalMarket(_market).isMarketCreated(), "Market not created");
        require(!marketClosedForDisputes[_market], "Market is closed for disputes");
        require(
                    paymentToken.allowance(msg.sender, address(this)) >= disputePrice,
                    "No allowance. Please approve ticket price allowance"
                );
        marketTotalDisputes[_market] = marketTotalDisputes[_market].add(marketTotalDisputes[_market]);
        dispute[_market][marketTotalDisputes[_market]].disputorAddress =  msg.sender;
        dispute[_market][marketTotalDisputes[_market]].disputeString =  _disputeString;
        dispute[_market][marketTotalDisputes[_market]].disputeTimestamp = block.timestamp;
        disputeVote[_market][marketTotalDisputes[_market]] = new uint[](councilMemberCount);
        if(IExoticPositionalMarket(_market).canUsersPlacePosition()) {
            dispute[_market][marketTotalDisputes[_market]].disputeInPositioningPhase = true;
        }
        if(!IExoticPositionalMarket(_market).disputed()) {
            marketManager.disputeMarket(_market);
        }
        emit NewDispute(_market, _disputeString, msg.sender);
    }

    function voteForDispute(address _market, uint _disputeIndex, uint _disputeCodeVote, uint _winningPosition) external onlyCouncilMembers {
        require(_disputeIndex > 0 && _disputeIndex > marketLastClosedDispute[_market], "Dispute non existent or already closed");
        require(_disputeCodeVote <= VOTING_OPTIONS && _disputeCodeVote > 0, "Invalid dispute code");
        if(dispute[_market][marketTotalDisputes[_market]].disputeInPositioningPhase) {
            require(_disputeCodeVote < ACCEPT_RESULT, "Invalid voting code for dispute in positioning");
        }
        else {
            require(_disputeCodeVote >= ACCEPT_RESULT, "Invalid voting code for dispute in positioning");

        }
        disputeVote[_market][_disputeIndex][councilMemberIndex[msg.sender]] = _disputeCodeVote;
        disputeVotesCount[_market][_disputeIndex][_disputeCodeVote] = disputeVotesCount[_market][_disputeIndex][_disputeCodeVote].add(1);
        uint decidedOption = maxVotesForDisputeOption(_market, _disputeIndex);
        if( decidedOption > (councilMemberCount.div(2))) {
            dispute[_market][marketTotalDisputes[_market]].disputeCode = decidedOption;
            closeDispute(_market, _disputeIndex, decidedOption);
        }
        emit VotedAddedForDispute(_market, _disputeIndex, _disputeCodeVote);
    }


    
    function closeDispute(address _market, uint _disputeIndex, uint _decidedOption) internal nonReentrant {
        if(_decidedOption == REFUSE_ON_POSITIONING || _decidedOption == REFUSE_MATURE) {
                // set dispute to false
                // 4 hours backstop
                marketManager.setBackstopTimeout(_market);
                // send disputor BOND to SafeBox
                marketManager.getMarketBondAmount(_market);

                // marketManager.sendBondAmountTo(_market, _address, _amount);
            }
            else if (_decidedOption == ACCEPT_SLASH) {
                // close market(cancel market)
                // 4 hours
                marketManager.setBackstopTimeout(_market);
                // send bond to disputor and safeBox
            }
            else if (_decidedOption == ACCEPT_NO_SLASH) {
                // close market(cancel market)
                // 4 hours
                marketManager.setBackstopTimeout(_market);
                // send bond to disputor and safeBox

            }
            else if (_decidedOption == ACCEPT_RESULT)  {
                // close market
                // set result
                // timer backstop
                marketManager.setBackstopTimeout(_market);
                
            }
            else if (_decidedOption == ACCEPT_RESET)  {
                // reset result
                
            }
            else {
                // (CANCEL) 

                marketManager.setBackstopTimeout(_market);
            }
        emit MarketClosedForDisputes(_market, dispute[_market][marketTotalDisputes[_market]].disputeCode);
    }

    function maxVotesForDisputeOption(address _market, uint _disputeIndex) internal view returns(uint){
        uint max = 0;
        for(uint i=1; i< VOTING_OPTIONS; i++) {
            max = (disputeVotesCount[_market][_disputeIndex][i] > max) ? disputeVotesCount[_market][_disputeIndex][i] : max;
        }
        return max;
    }
    
    
    modifier onlyCouncilMembers() {
        require(isOracleCouncilMember(msg.sender), "Issuer not a council member");
        _;
    }
    event NewOracleCouncilMember(address councilMember, uint councilMemberCount);
    event OracleCouncilMemberRemoved(address councilMember, uint councilMemberCount);
    event NewMarketManager(address marketManager);
    event NewDispute(address market, string disputeString, address disputorAccount);
    event VotedAddedForDispute(address market, uint disputeIndex, uint disputeCodeVote);
    event MarketClosedForDisputes(address market, uint disputeFinalCode);
}
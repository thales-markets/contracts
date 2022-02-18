pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../interfaces/IExoticPositionalMarket.sol";

contract ThalesOracleCouncil is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard  {
    using SafeMath for uint;
    uint private constant COUNCIL_MAX_MEMBERS = 5;
    uint private constant VOTING_OPTIONS = 8;
    mapping(uint => address) public councilMemberAddress;
    mapping(address => uint) public councilMemberIndex;
    uint public councilMemberCount;
    IERC20 public paymentToken;
    uint public disputePrice;

    struct Dispute {
        address disputorAddress;
        string disputeString;
        uint disputeCode;
        uint disputeTimestamp;
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
        address _paymentToken
    ) public initializer {
        setOwner(_owner);
        initNonReentrant();
        disputePrice = _disputePrice;
        paymentToken = IERC20(_paymentToken);
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


    function addOracleCouncilMember(address _councilMember) external onlyOwner {
        require(_councilMember != address(0), "Invalid address. Add valid address");
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
        emit NewDispute(_market, _disputeString, msg.sender);
    }

    function voteForDispute(address _market, uint _disputeIndex, uint _disputeCodeVote, uint _winningPosition) external onlyCouncilMembers {
        require(_disputeIndex > 0 && _disputeIndex > marketLastClosedDispute[_market], "Dispute non existent or already closed");
        require(_disputeCodeVote < VOTING_OPTIONS, "Invalid dispute code");
        disputeVote[_market][_disputeIndex][councilMemberIndex[msg.sender]] = _disputeCodeVote;
        disputeVotesCount[_market][_disputeIndex][_disputeCodeVote] = disputeVotesCount[_market][_disputeIndex][_disputeCodeVote].add(1);
        if(decisionReachedOnDispute(_market, _disputeIndex) > 0) {
            
        }
        emit VotedAddedForDispute(_market, _disputeIndex, _disputeCodeVote);
    }
    
    function closeDispute(address _market, uint _disputeIndex) external onlyCouncilMembers {
        require(_disputeIndex > 0 && _disputeIndex > marketLastClosedDispute[_market], "Dispute non existent or already closed");

        emit MarketClosedForDisputes(_market, dispute[_market][marketTotalDisputes[_market]].disputeCode);
    }

    function decisionReachedOnDispute(address _market, uint _disputeIndex) internal view returns(uint){
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
    event NewDispute(address market, string disputeString, address disputorAccount);
    event VotedAddedForDispute(address market, uint disputeIndex, uint disputeCodeVote);
    event MarketClosedForDisputes(address market, uint disputeFinalCode);
}
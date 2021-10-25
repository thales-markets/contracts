pragma solidity ^0.5.16;

import "synthetix-2.50.4-ovm/contracts/Pausable.sol";
import "openzeppelin-solidity-2.3.0/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity-2.3.0/contracts/math/Math.sol";
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/SafeERC20.sol";
import "synthetix-2.50.4-ovm/contracts/SafeDecimalMath.sol";
import "../interfaces/IPriceFeed.sol";

contract ThalesRoyale is Owned, Pausable {
    using SafeMath for uint;
    using SafeDecimalMath for uint;
    using SafeERC20 for IERC20;

    uint public reward;
    IERC20 public rewardToken;
    bytes32 public oracleKey;
    IPriceFeed public priceFeed;
    uint public rounds;
    uint public signUpPeriod = 72 hours;

    uint public roundChoosingLength = 8 hours;
    uint public roundLength = 24 hours;

    uint public round = 0;
    uint public roundStartTime;
    uint public roundEndTime;

    uint public roundTargetPrice;

    mapping(uint => uint) public roundResult;

    address[] public players;
    mapping(address => uint) public playerSignedUp;

    uint public creationTime;
    bool public started = false;
    bool public finished = false;

    mapping(address => mapping(uint256 => uint256)) public positionInARound;

    constructor(
        address _owner,
        bytes32 _oracleKey,
        IPriceFeed _priceFeed,
        uint reward,
        address _rewardToken,
        uint _rounds
    ) public Owned(_owner) {
        creationTime = block.timestamp;
        oracleKey = _oracleKey;
        priceFeed = _priceFeed;
        rewardToken = IERC20(_rewardToken);
        rounds = _rounds;
    }

    function signUp() external {
        require(block.timestamp < (creationTime + signUpPeriod), "Sign up period has expired");
        require(playerSignedUp[msg.sender] == 0, "Player already signed up");
        playerSignedUp[msg.sender] = block.timestamp;
        players.push(msg.sender);
    }

    function startRoyale() external {
        require(block.timestamp > (creationTime + signUpPeriod), "Can't start until signup period expires");
        require(started == false, "Already started");
        roundTargetPrice = priceFeed.rateForCurrency(oracleKey);
        started = true;
        round = 1;
        roundStartTime = block.timestamp + roundChoosingLength;
        roundEndTime = roundStartTime + roundLength;
    }

    function takeAPosition(uint position) external {
        require(position == 0 || position == 1, "Position can only be 0 or 1");
        require(started, "Competition not started yet");
        require(!finished, "Competition finished");
        require(playerSignedUp[msg.sender] != 0, "Player did not sign up");

        if (round != 1) {
            require(
                positionInARound[msg.sender][round - 1] == roundResult[round],
                "You did not have correct position in the last round"
            );
        }

        require(block.timestamp < roundStartTime, "Round positioning finished");
        positionInARound[msg.sender][round] = position;
    }

    function closeRound() external {
        require(started, "Competition not started yet");
        require(!finished, "Competition finished");
        require(block.timestamp > roundStartTime, "Competition finished");

        roundResult[round] = roundTargetPrice < priceFeed.rateForCurrency(oracleKey) ? 0 : 1;

        roundTargetPrice = priceFeed.rateForCurrency(oracleKey);
        round = round + 1;
        roundStartTime = block.timestamp + roundChoosingLength;
    }

    function getPlayers() public view returns (address[] memory) {
        return players;
    }
}

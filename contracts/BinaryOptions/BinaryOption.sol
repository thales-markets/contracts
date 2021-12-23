pragma solidity 0.5.16;

// Inheritance
import "synthetix-2.50.4-ovm/contracts/interfaces/IERC20.sol";
import "../interfaces/IBinaryOption.sol";

// Libraries
import "synthetix-2.50.4-ovm/contracts/SafeDecimalMath.sol";

// Internal references
import "./BinaryOptionMarket.sol";

contract BinaryOption is IERC20, IBinaryOption {
    /* ========== LIBRARIES ========== */

    using SafeMath for uint;
    using SafeDecimalMath for uint;

    /* ========== STATE VARIABLES ========== */

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;

    BinaryOptionMarket public market;

    mapping(address => uint) public balanceOf;
    uint public totalSupply;

    // The argument order is allowance[owner][spender]
    mapping(address => mapping(address => uint)) private allowances;

    // Enforce a 1 cent minimum amount
    uint internal constant _MINIMUM_AMOUNT = 1e16;

    address public limitOrderProvider;
    address public thalesAMM;
    /* ========== CONSTRUCTOR ========== */

    bool public initialized = false;

    function initialize(
        string calldata _name,
        string calldata _symbol,
        address _limitOrderProvider,
        address _thalesAMM
    ) external {
        require(!initialized, "Binary Option Market already initialized");
        initialized = true;
        name = _name;
        symbol = _symbol;
        market = BinaryOptionMarket(msg.sender);
        // add through constructor
        limitOrderProvider = _limitOrderProvider;
        thalesAMM = _thalesAMM;
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        if (spender == limitOrderProvider || spender == thalesAMM) {
            return 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
        } else {
            return allowances[owner][spender];
        }
    }

    function _requireMinimumAmount(uint amount) internal pure returns (uint) {
        require(amount >= _MINIMUM_AMOUNT || amount == 0, "Balance < $0.01");
        return amount;
    }

    function mint(address minter, uint amount) external onlyMarket {
        _requireMinimumAmount(amount);
        totalSupply = totalSupply.add(amount);
        balanceOf[minter] = balanceOf[minter].add(amount); // Increment rather than assigning since a transfer may have occurred.

        emit Transfer(address(0), minter, amount);
        emit Issued(minter, amount);
    }

    // This must only be invoked after maturity.
    function exercise(address claimant) external onlyMarket {
        uint balance = balanceOf[claimant];

        if (balance == 0) {
            return;
        }

        balanceOf[claimant] = 0;
        totalSupply = totalSupply.sub(balance);

        emit Transfer(claimant, address(0), balance);
        emit Burned(claimant, balance);
    }

    // This must only be invoked after maturity.
    function exerciseWithAmount(address claimant, uint amount) external onlyMarket {
        require(amount > 0, "Can not exercise zero amount!");

        require(balanceOf[claimant] >= amount, "Balance must be greather or equal amount that is burned");

        balanceOf[claimant] = balanceOf[claimant] - amount;
        totalSupply = totalSupply.sub(amount);

        emit Transfer(claimant, address(0), amount);
        emit Burned(claimant, amount);
    }

    // This must only be invoked after the exercise window is complete.
    // Note that any options which have not been exercised will linger.
    function expire(address payable beneficiary) external onlyMarket {
        selfdestruct(beneficiary);
    }

    /* ---------- ERC20 Functions ---------- */

    function _transfer(
        address _from,
        address _to,
        uint _value
    ) internal returns (bool success) {
        market.requireUnpaused();
        require(_to != address(0) && _to != address(this), "Invalid address");

        uint fromBalance = balanceOf[_from];
        require(_value <= fromBalance, "Insufficient balance");

        balanceOf[_from] = fromBalance.sub(_value);
        balanceOf[_to] = balanceOf[_to].add(_value);

        emit Transfer(_from, _to, _value);
        return true;
    }

    function transfer(address _to, uint _value) external returns (bool success) {
        return _transfer(msg.sender, _to, _value);
    }

    function transferFrom(
        address _from,
        address _to,
        uint _value
    ) external returns (bool success) {
        if (msg.sender != limitOrderProvider && msg.sender != thalesAMM) {
            uint fromAllowance = allowances[_from][msg.sender];
            require(_value <= fromAllowance, "Insufficient allowance");
            allowances[_from][msg.sender] = fromAllowance.sub(_value);
        }
        return _transfer(_from, _to, _value);
    }

    function approve(address _spender, uint _value) external returns (bool success) {
        require(_spender != address(0));
        allowances[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    /* ========== MODIFIERS ========== */

    modifier onlyMarket() {
        require(msg.sender == address(market), "Only market allowed");
        _;
    }

    /* ========== EVENTS ========== */

    event Issued(address indexed account, uint value);
    event Burned(address indexed account, uint value);
    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
}

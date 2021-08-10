pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/ERC20.sol";
import "synthetix-2.43.1/contracts/SafeDecimalMath.sol";

contract RewardDistribution {
    using SafeMath for uint;
    using SafeDecimalMath for uint;

    address public token;

    address public admin;
    mapping(address => bool) public fundAdmins;

    mapping(address => uint) public totalEscrowedAccountBalance;

    uint public totalEscrowedBalance;

    mapping(address => uint) public totalVestedAccountBalance;

    constructor(address _token, address[4] memory _fundAdmins) public {
        token = _token;
        admin = msg.sender;

        for (uint index = 0; index < _fundAdmins.length; index++) {
            address adminAddress = _fundAdmins[index];
            if (adminAddress != address(0)) {
                fundAdmins[adminAddress] = true;
            }
        }
    }

    function addTokens(uint _amount) external onlyAdmin {
        require(ERC20(token).transferFrom(msg.sender, address(this), _amount), "Transfer failed");
    }

    function fund(address[500] calldata _recipients, uint[500] calldata _amounts) external {
        if (msg.sender != admin) {
            require(fundAdmins[msg.sender], "Admin only");
        }
        uint _totalAmount = 0;
        for (uint index = 0; index < _recipients.length; index++) {
            uint amount = _amounts[index];
            address recipient = _recipients[index];
            if (recipient == address(0)) {
                break;
            }

            totalEscrowedAccountBalance[recipient] = totalEscrowedAccountBalance[recipient].add(amount);

            _totalAmount = _totalAmount.add(amount);
            emit Fund(recipient, amount);
        }

        totalEscrowedBalance = totalEscrowedBalance.add(_totalAmount);

        /* There must be enough balance in the contract to provide for the vesting entries. */
        require(
            totalEscrowedBalance <= ERC20(token).balanceOf(address(this)),
            "Must be enough balance in the contract to provide for the reward distribution"
        );
    }

    function balanceOf(address _recipient) public view returns (uint) {
        return totalEscrowedAccountBalance[_recipient];
    }

    function claim() external {
        if (totalEscrowedAccountBalance[msg.sender] != 0) {
            totalEscrowedBalance = totalEscrowedBalance.sub(totalEscrowedAccountBalance[msg.sender]);
            totalVestedAccountBalance[msg.sender] = totalVestedAccountBalance[msg.sender].add(
                totalEscrowedAccountBalance[msg.sender]
            );
            uint totalBalance = totalEscrowedAccountBalance[msg.sender];
            totalEscrowedAccountBalance[msg.sender] = 0;
            ERC20(token).transfer(msg.sender, totalBalance);
            emit Claim(msg.sender, now, totalBalance);
        }
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Admin only");
        _;
    }

    event Fund(address indexed _recipient, uint _amount);
    event Claim(address indexed _address, uint now, uint _amount);
}

pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/IERC20.sol";
import "synthetix-2.50.4-ovm/contracts/SafeDecimalMath.sol";
import "openzeppelin-solidity-2.3.0/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity-2.3.0/contracts/utils/ReentrancyGuard.sol";
import "synthetix-2.50.4-ovm/contracts/Pausable.sol";
import "../interfaces/IThalesExchanger.sol";

contract ThalesExchanger is IThalesExchanger, Owned, ReentrancyGuard, Pausable {
    using SafeMath for uint;

    IERC20 public ThalesToken;
    IERC20 public OpThalesToken;

    uint private constant THALES_TO_OPTHALES = 1;
    uint private constant OPTHALES_TO_THALES = 0;

    event ExchangedThalesForOpThales(address sender, uint amount);
    event ExchangedOpThalesForThales(address sender, uint amount);
       
    constructor(address _owner, address thalesAddress, address opThalesAddress) public Owned(_owner) {
        ThalesToken = IERC20(thalesAddress);
        OpThalesToken = IERC20(opThalesAddress);
    }

    function setThalesAddress(address thalesAddress) external onlyOwner {
        ThalesToken = IERC20(thalesAddress);
    }
    
    function setOpThalesAddress(address opThalesAddress) external onlyOwner {
        OpThalesToken = IERC20(opThalesAddress);
    }

    function exchangeThalesToOpThales(uint amount) external nonReentrant notPaused {
        require(OpThalesToken.balanceOf(address(this)) >= amount, "Insufficient Exchanger OpThales funds" );
        require(ThalesToken.allowance(msg.sender, address(this)) >= amount, "No allowance");
        _exchange(msg.sender, amount, THALES_TO_OPTHALES);
    }

    function exchangeOpThalesToThales(uint amount) external nonReentrant notPaused {
        require(ThalesToken.balanceOf(address(this)) >= amount, "Insufficient Exchanger Thales funds" );
        require(OpThalesToken.allowance(msg.sender, address(this)) >= amount, "No allowance");
        _exchange(msg.sender, amount, OPTHALES_TO_THALES);
    }
    

    function _exchange(address _sender, uint _amount, uint _thalesToOpThales) internal notPaused {
        if(_thalesToOpThales == THALES_TO_OPTHALES) {            
            ThalesToken.transferFrom(_sender, address(this), _amount);
            OpThalesToken.transfer(_sender, _amount);
            emit ExchangedThalesForOpThales(_sender, _amount);
        }
        else {
            OpThalesToken.transferFrom(_sender, address(this), _amount);
            ThalesToken.transfer(_sender, _amount);            
            emit ExchangedOpThalesForThales(_sender, _amount);
        }
    }
}

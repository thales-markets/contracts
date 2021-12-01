pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/IERC20.sol";
import "synthetix-2.50.4-ovm/contracts/SafeDecimalMath.sol";
import "openzeppelin-solidity-2.3.0/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity-2.3.0/contracts/utils/ReentrancyGuard.sol";
import "synthetix-2.50.4-ovm/contracts/Pausable.sol";
import "../interfaces/IThalesExchanger.sol";

import {iOVM_L1ERC20Bridge} from "@eth-optimism/contracts/iOVM/bridge/tokens/iOVM_L1ERC20Bridge.sol";

contract ThalesExchanger is IThalesExchanger, Owned, ReentrancyGuard, Pausable {
    using SafeMath for uint;

    IERC20 public ThalesToken;
    IERC20 public OpThalesToken;
    iOVM_L1ERC20Bridge public L1Bridge;

    address public l2TokenAddress;

    uint private constant THALES_TO_OPTHALES = 1;
    uint private constant OPTHALES_TO_THALES = 0;
    uint private constant MAX_APPROVAL = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

    bool public enabledThalesToOpThales = true;
    bool public enabledOpThalesToThales = true; 

    event ExchangedThalesForOpThales(address sender, uint amount);
    event ExchangedThalesForL2OpThales(address sender, uint amount);
    event ExchangedOpThalesForThales(address sender, uint amount);
    event L1BridgeChanged(address l1BridgeAddress);

    constructor(
        address _owner,
        address thalesAddress,
        address opThalesAddress,
        address _l1BridgeAddress,
        address _l2TokenAddress
    ) public Owned(_owner) {
        ThalesToken = IERC20(thalesAddress);
        OpThalesToken = IERC20(opThalesAddress);
        L1Bridge = iOVM_L1ERC20Bridge(_l1BridgeAddress);
        OpThalesToken.approve(_l1BridgeAddress, MAX_APPROVAL);
        l2TokenAddress = _l2TokenAddress;
    }

    function setThalesAddress(address thalesAddress) external onlyOwner {
        ThalesToken = IERC20(thalesAddress);
    }

    function setOpThalesAddress(address opThalesAddress) external onlyOwner {
        OpThalesToken = IERC20(opThalesAddress);
    }

    function setL2TokenAddress(address _l2TokenAddress) external onlyOwner {
        l2TokenAddress = _l2TokenAddress;
    }
    
    function setEnabledThalesToOpThales(bool _enable) external onlyOwner {
        enabledThalesToOpThales = _enable;
    }
    
    function setEnabledOpThalesToThales(bool _enable) external onlyOwner {
        enabledOpThalesToThales = _enable;
    }

    function setL1StandardBridge(address _l1BridgeAddress) external onlyOwner {
        if (address(L1Bridge) != address(0)) {
            OpThalesToken.approve(address(L1Bridge), 0);
        }
        L1Bridge = iOVM_L1ERC20Bridge(_l1BridgeAddress);
        OpThalesToken.approve(_l1BridgeAddress, MAX_APPROVAL);
        emit L1BridgeChanged(_l1BridgeAddress);
    }

    function exchangeThalesToOpThales(uint amount) external nonReentrant notPaused {
        require(enabledThalesToOpThales, "Exchanging disabled");
        require(OpThalesToken.balanceOf(address(this)) >= amount, "Insufficient Exchanger OpThales funds");
        require(ThalesToken.allowance(msg.sender, address(this)) >= amount, "No allowance");
        _exchange(msg.sender, amount, THALES_TO_OPTHALES);
        emit ExchangedThalesForOpThales(msg.sender, amount);
    }

    function exchangeOpThalesToThales(uint amount) external nonReentrant notPaused {
        require(enabledOpThalesToThales, "Exchanging disabled");
        require(ThalesToken.balanceOf(address(this)) >= amount, "Insufficient Exchanger Thales funds");
        require(OpThalesToken.allowance(msg.sender, address(this)) >= amount, "No allowance");
        _exchange(msg.sender, amount, OPTHALES_TO_THALES);
        emit ExchangedOpThalesForThales(msg.sender, amount);
    }

    function exchangeThalesToL2OpThales(uint amount) external nonReentrant notPaused {
        require(enabledThalesToOpThales, "Exchanging disabled");
        require(OpThalesToken.balanceOf(address(this)) >= amount, "Insufficient Exchanger OpThales funds");
        require(ThalesToken.allowance(msg.sender, address(this)) >= amount, "No allowance");
        ThalesToken.transferFrom(msg.sender, address(this), amount);
        L1Bridge.depositERC20To(address(OpThalesToken), l2TokenAddress, msg.sender, amount, 2000000, "0x");
        emit ExchangedThalesForL2OpThales(msg.sender, amount);
    }

    function selfDestruct(address payable account) external onlyOwner {
        OpThalesToken.transfer(account, OpThalesToken.balanceOf(address(this)));
        ThalesToken.transfer(account, ThalesToken.balanceOf(address(this)));
        selfdestruct(account);
    }

    function _exchange(
        address _sender,
        uint _amount,
        uint _thalesToOpThales
    ) internal notPaused {
        if (_thalesToOpThales == THALES_TO_OPTHALES) {
            ThalesToken.transferFrom(_sender, address(this), _amount);
            OpThalesToken.transfer(_sender, _amount);
        } else {
            OpThalesToken.transferFrom(_sender, address(this), _amount);
            ThalesToken.transfer(_sender, _amount);
        }
    }
}

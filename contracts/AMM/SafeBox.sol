pragma solidity ^0.5.16;

import "@openzeppelin/upgrades-core/contracts/Initializable.sol";
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/SafeERC20.sol";

import "../utils/proxy/ProxyOwned.sol";

contract SafeBox is ProxyOwned, Initializable {
    using SafeERC20 for IERC20;
    IERC20 public sUSD;

    function initialize(address _owner, IERC20 _sUSD) public initializer {
        setOwner(_owner);
        sUSD = _sUSD;
    }

    function retrieveSUSDAmount(address payable account, uint amount) external onlyOwner {
        sUSD.transfer(account, amount);
    }
}

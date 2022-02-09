// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";

import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

contract SafeBox is ProxyOwned, Initializable {
    using SafeERC20 for IERC20;
    IERC20 public sUSD;

    function initialize(address _owner, IERC20 _sUSD) public initializer {
        setOwner(_owner);
        sUSD = _sUSD;
    }
}

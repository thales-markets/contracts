// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";

interface IRangedPosition is IERC20 {
    function initialize(
        address market,
        string calldata _name,
        string calldata _symbol,
        address _thalesRangedAMM
    ) external;

    function burn(address claimant, uint amount) external;

    function mint(address minter, uint amount) external;

    function getBalanceOf(address account) external view returns (uint);

    function getTotalSupply() external view returns (uint);

    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    event Mint(address minter, uint amount);
    event Burned(address burner, uint amount);
}

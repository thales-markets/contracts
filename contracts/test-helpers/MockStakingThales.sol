pragma solidity ^0.5.16;

contract MockStakingThales {
    mapping(address => uint) private _stakedBalances;
    mapping(address => uint) public volume;

    constructor() public {}

    function stakedBalanceOf(address account) external view returns (uint) {
        return _stakedBalances[account];
    }

    function stake(uint amount) external {
        _stakedBalances[msg.sender] = amount;
    }

    function updateVolume(address account, uint amount) external {
        volume[msg.sender] = amount;
    }
}

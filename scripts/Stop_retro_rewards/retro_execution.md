1. Take a snapshot of DODO  
`run dodoDepositors.js script`  
2. Take a snapshot of retro stakers  
`run queryRetroAllocation.js`  
3. Take a snapshot of investors  
`run queryInvestors.js`  
4. In investors snapshot reduce remaining vesting all of two addresses that also got it from SNX staking  
5. Take a snapshot of all old THALES holders  
6. Drain new token from migration contract
7. If no changes since snapshots: Stop migration contract  
`pause via gnosis`
8. If no changed since snapshots (otherwise take another snapshot and repeat): Drain DODO pool  
`USe treasury THALES to get all ETH out of that pool`
9. Execute the script to send new THALES for all holders of old THALES on l1 (use https://disperse.app/, exclude contracts and handle manually)
10. Execute script to send THALES and ETH/wETH to all DODO LPers  (use https://disperse.app/)
11. Setup an airdrop contract on L2 for all unclaimed rewards from retro unlock  (Exclude contracts and figure out how to handle it later)  
`npx hardhat run --network optimisticEthereum scripts/Stop_retro_rewards/retro/unclaimedRewards/prepareL2AirdropForUnclaimedRewards.js`
12. Setup an airdrop contract on L1 for all unclaimed rewards for investors on L1  
`npx hardhat run --network mainnet scripts/Stop_retro_rewards/retro/investors/prepareL1AirdropForUnclaimedRewards.js`
13. Deploy and setup new retro unlock contract for remaining investors unclock on L1  
`npx hardhat run --network mainnet scripts/Stop_retro_rewards/retro/investors/deployRemainingVestingForInvestitors.js`
14. TBD check unclaimed DODO crowndpooling
15. Check all addresses that were contracts  
16. After sanity tests, fund the contracts and change owners to protocol dao  

General: Check for contracts!



In frontend:  
- Connect new airdrop contract on l2 in retro rewards tab 
- Connect new investors airdrop contract on l1 and retro unlock. Make a new tab only for them.
- remove migration tab (leave only the bridge)

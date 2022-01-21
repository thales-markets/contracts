After the rewards are calculated on 2nd of February
1. Leave Staking, OngoingAirdrop and Escrow paused 
2. Take snapshot of staking and escrow `npx hardhat run --network mainnet scripts/THALES_migration/stakingEscrowMigration/prepareStakingAndEscrowMigrationData.js`
3. Destroy staking and escrow if no action after paused (send the funds in wallet to treasury)
4. Take a snapshot of airdrop contract
5. Take a snapshot of ongoingAirdrop contract
6. Deploy OpThales on L1 and send it to treasury
7. Deploy OpThales on L2
8. Deploy Exchanger on L1
9. Exchange the needed amount of THALES to OpTHALES and bridge it to multisig on L2
10. Deploy Staking on L2
11. Deploy Escrow on L2
12. Fund the deployer address with the needed amount of OpTHALES on L2
13. Execute migration of staking on L2 
14. Execute migration of airdrop to l2
15. Execute migration of ongoing airdrop
16. Airdrop and Ongoing Airdrop stay paused on L1 and can only be destroyed after 1 year
17. TBD staking rewards for G-UNI pool


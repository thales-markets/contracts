After the rewards are calculated on 2nd of February

1. Leave Staking, OngoingAirdrop and Escrow paused  
   a. Staking https://etherscan.io/address/0x883D651429B0829BC045A94F288f3b514021B8C1
   b. OngoingAirdrop https://etherscan.io/address/0xDAaB884D083FE5c38b4679ae194c52f176Bd8783
   c. Escrow https://etherscan.io/address/0x8d3703d4dED77473E632dEf20002DAdC86bf4AAD

2. Take a snapshot of staking and escrow  
   `npx hardhat run --network mainnet scripts/THALES_migration/stakingEscrowMigration/prepareStakingAndEscrowMigrationData.js`
3. Destroy staking and escrow if no user action after paused (send the funds in wallet to treasury)
4. Take a snapshot of airdrop contract  
   `npx hardhat run --network mainnet scripts/THALES_migration/airdropMigration/prepareAirdropMigration.js`
5. Take a snapshot of ongoingAirdrop contract and prepare new root for L2  
   `npx hardhat run --network mainnet scripts/THALES_migration/ongoingAirdropMigration/prepareOngoingAirdropMigration.js`
6. Deploy OpThales on L1 and send it to treasury  
   a. `npx hardhat run --network mainnet scripts/deployOPThales/deploy_OpThales_L1.js`  
   b. send all supply to treasury
7. Deploy OpThales on L2  
   a. `npx hardhat run --network optimistic scripts/deployOPThales/deploy_OpThales_L2.js`
8. Deploy Exchanger on L1 and put the needed amount of OpTHALES into the exchanger  
   `npx hardhat run --network mainnet scripts/l1_l2_exchanger/deployExchanger.js`
9. Exchange the needed amount of THALES to OpTHALES and bridge it to multisig on L2 `4. exchangeThalesToL2OpThales`
10. Deploy Staking and Escrow on L2  
    npx hardhat run --network optimistic scripts/deployEscrowAndStaking/deploy_transparent.js
11. Fund the deployer address with the needed amount of OpTHALES on L2
12. Execute migration of staking on L2
    `npx hardhat run --network mainnet scripts/THALES_migration/stakingEscrowMigration/executeStakingAndEscrowMigrationData.js`
13. Execute migration of airdrop to l2  
    a. `npx hardhat run --network mainnet scripts/THALES_migration/airdropMigration/executeAirdropMigration.js`  
14. Execute migration of ongoing airdrop  
    a. `npx hardhat run --network mainnet scripts/THALES_migration/ongoingAirdropMigration/deployOngoingAirdropMigration.js`  
    b. set the latest root from L1 ongoing rewards
    c. copy the latest root file and use it in the dapp
15. Airdrop and Ongoing Airdrop stay paused on L1 and can only be destroyed after 1 year
16. TBD staking rewards for G-UNI pool

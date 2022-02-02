After the rewards are calculated on 2nd of February

1. Pause Staking, OngoingAirdrop and Escrow and Airdrop // done
   a. Staking https://etherscan.io/address/0x883D651429B0829BC045A94F288f3b514021B8C1
   b. OngoingAirdrop https://etherscan.io/address/0xDAaB884D083FE5c38b4679ae194c52f176Bd8783
   c. Escrow https://etherscan.io/address/0x8d3703d4dED77473E632dEf20002DAdC86bf4AAD
   d. Airdrop https://etherscan.io/address/0x0f33af99f3C124189B8dA7C7BE6Dc08C77a9ddc7 paused

2. Take a snapshot of staking and escrow  
   `npx hardhat run --network mainnet scripts/THALES_migration/stakingEscrowMigration/prepareStakingAndEscrowMigrationData.js`
3. Destroy staking and escrow if no user action after paused (send the funds in wallet to treasury) and ongoing airdrop
   a. as protocol DAO, send all THALES to treasury
4. Take a snapshot of airdrop contract  
   `npx hardhat run --network mainnet scripts/THALES_migration/airdropMigration/prepareAirdropMigration.js`
5. Take a snapshot of ongoingAirdrop contract and prepare new root for L2  
   `npx hardhat run --network mainnet scripts/THALES_migration/ongoingAirdropMigration/prepareOngoingAirdropMigration.js`
6. Deploy OpThales on L1 and send it to treasury // all done  
   a. `npx hardhat run --network mainnet scripts/deployOPThales/deploy_OpThales_L1.js`  
   b. send all supply to treasury
7. Deploy OpThales on L2 // all done  
   a. `npx hardhat run --network optimistic scripts/deployOPThales/deploy_OpThales_L2.js`
8. Deploy Exchanger on L1 and put 10m needed amount of OpTHALES into the exchanger // exchanger deployed, transfer pending
   `npx hardhat run --network mainnet scripts/l1_l2_exchanger/deployExchanger.js`
9. Exchange the needed amount of THALES to OpTHALES `4. exchangeThalesToL2OpThales` // estimate 6 million  
   -- DO NOT USE MULTISIG TO BRIDGE  
   -- USE EOA  
   -- send to protocol DAO on l2
   -- pause exchanger when done
10. Deploy Staking and Escrow on L2 // already done  
    `npx hardhat run --network optimistic scripts/deployEscrowAndStaking/deploy_transparent.js`
11. Deploy ThalesStakingRewardsPool on L2 // already done
    `npx hardhat run --network optimistic scripts/deployEscrowAndStaking/deploy_StakingRewards.js`
12. Update Staking and Escrow parameteres with // already done
    `npx hardhat run --network optimistic scripts/deployEscrowAndStaking/update_addresses_on_Staking.js`
13. Execute migration of staking on L2  
    a. Start staking then pause staking and escrow contracts.  
    b. set owner to deployer temporarily  
    c. fund deployer  
    d. remove those that opted out from the input file and send L1 THALES to them directly (store them in another file optedOutAccounts.json)    
    e. `npx hardhat run --network optimistic scripts/THALES_migration/stakingEscrowMigration/executeStakingAndEscrowMigration.js`  
    f. `npx hardhat run --network optimistic scripts/THALES_migration/stakingEscrowMigration/executeStakingAndEscrowMigrationSendETH.js`  
    g. `npx hardhat run --network optimistic scripts/THALES_migration/stakingEscrowMigration/executeStakingAndEscrowMigrationSendETHSendEscrow.js`  
    h. `npx hardhat run --network optimistic scripts/THALES_migration/stakingEscrowMigration/executeStakingAndEscrowMigrationSendETHUnstaking.js`  
    i. run sanity check scripts  
    i1. `npx hardhat run --network optimistic scripts/THALES_migration/stakingEscrowMigration/sanityCheckStakingAndEscrowMigration.js`  
    i2. `npx hardhat run --network optimistic scripts/THALES_migration/stakingEscrowMigration/sanityCheckDirectSendingTHALES.js`      
    j. sanity check      
    k. return owner to pdao  
    
14. Execute migration of airdrop to l2 // done all but the last (fund)
    a. `npx hardhat run --network optimistic scripts/THALES_migration/airdropMigration/executeAirdropMigration.js`  
    b. pause airdrop
    c. migrate owner to protocol DAO  
    d. copy the hashes file to the dapp  
    e. fund airdrop
15. Execute migration of ongoing airdrop  
    a. `npx hardhat run --network optimistic scripts/THALES_migration/ongoingAirdropMigration/deployOngoingAirdropMigration.js`  
    b. set the latest root from L1 ongoing rewards
    c. copy the latest root file and use it in the dapp
    d. pause ongoing airdrop  
    e. migrate owner to protocol DAO  
    f. fund ongoing airdrop
16. Airdrop stays paused on L1 and can only be destroyed after 1 year.
17. Release dapp with paused contracts
18. Verify all states (aidrop, ongoing airdrop and staking), and when 100% verified/certain, unpause and announce migration end
19. Fund the ThalesStakingRewardsPool with rewards on L2 with 91k OpTHALES per week
20. TBD staking rewards for G-UNI pool

Notes:
Unclaimed in ongoing airdrop 1,474,673.88
Airdrop 1,567,828
Staking 3,000,000
Escrow 992,513

about 7m

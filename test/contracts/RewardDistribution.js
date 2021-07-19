'use strict';

const { contract, web3 } = require('hardhat');
const { assert } = require('./common');
const {  fastForward, toUnit } = require('../utils')();

const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const TOTAL_AMOUNT = web3.utils.toWei("500000");
const { testAccounts } = require('./test-accounts');

contract('RewardDistribution', async accounts => {
	const WEEK = 604800;

	const [admin, beneficiary, account1, account2, account3, account4] = accounts;
	let Thales, RewardDistribution;

	before(async () => {
        Thales = await deployContract("Thales");

        RewardDistribution = await deployContract("RewardDistribution", [
            Thales.address,
            [account1, account2, account3, account4]
        ]);

        const recipients = [beneficiary, ...testAccounts, ...new Array(400).fill(ZERO_ADDRESS)];
        const amounts = new Array(500).fill(web3.utils.toWei("1000")); 

        await RewardDistribution.addTokens(TOTAL_AMOUNT);
        await RewardDistribution.fund(recipients, amounts);
	});

    describe('Constructor & Settings ', async () => {
	
		it('should set admin on contructor', async () => {
			const adminAddress = await RewardDistribution.admin();
			assert.equal(adminAddress, admin);
		});

	});

    describe('Functions', async() => {
        let adminS, beneficiaryS;
        beforeEach(async () => {
            [adminS, beneficiaryS] = await ethers.getSigners();
		
            Thales = await deployContract("Thales");
    
            RewardDistribution = await deployContract("RewardDistribution", [
                Thales.address,
                [account1, account2, account3, account4]
            ]);

        });

		describe('Vesting Writes', async () => {
			it('should revert if there is not enough THALES in the contracts balance', async () => {
                const REVERT = 'VM Exception while processing transaction: revert Must be enough balance in the contract to provide for the reward distribution';
                const recipients = [beneficiary, ...new Array(499).fill(ZERO_ADDRESS)];
                const amounts = new Array(500).fill(web3.utils.toWei("1000")); 
        
                await RewardDistribution.addTokens(web3.utils.toWei("100"));
               
				await assert.revert(
					RewardDistribution.fund(recipients, amounts),
                    REVERT
				);
			});
		});

        describe('Vesting Reads', async () => {
			beforeEach(async () => {
                const recipients = [beneficiary, ...new Array(499).fill(ZERO_ADDRESS)];

                await RewardDistribution.addTokens(web3.utils.toWei('100'));
				await RewardDistribution.fund(recipients, [web3.utils.toWei('100'), ...new Array(499).fill(0)]);
				await fastForward(WEEK);

                await RewardDistribution.addTokens(web3.utils.toWei('200'));
				await RewardDistribution.fund(recipients, [web3.utils.toWei('200'), ...new Array(499).fill(0)]);
				await fastForward(WEEK);

                await RewardDistribution.addTokens(web3.utils.toWei('300'));
				await RewardDistribution.fund(recipients, [web3.utils.toWei('300'), ...new Array(499).fill(0)]);
			});

			it('should append a vesting entry and increase the contracts balance', async () => {
				const balanceOfRewardDistribution = await Thales.balanceOf(RewardDistribution.address);
				assert.bnEqual(balanceOfRewardDistribution, toUnit('600'));
			});

			it('should get an account\'s total Vested Account Balance', async () => {
				const balanceOf = await RewardDistribution.balanceOf(beneficiary);
				assert.bnEqual(balanceOf, toUnit('600'));
			});


		});


        describe('Vesting', async () => {
            let adminS, beneficiaryS;
			beforeEach(async () => {
				[adminS, beneficiaryS] = await ethers.getSigners();
                const recipients = [beneficiary, ...new Array(499).fill(ZERO_ADDRESS)];

                await RewardDistribution.addTokens(web3.utils.toWei('100'));
				await RewardDistribution.fund(recipients, [web3.utils.toWei('100'), ...new Array(499).fill(0)]);
				await fastForward(WEEK);

                await RewardDistribution.addTokens(web3.utils.toWei('200'));
				await RewardDistribution.fund(recipients, [web3.utils.toWei('200'), ...new Array(499).fill(0)]);
				await fastForward(WEEK);

                await RewardDistribution.addTokens(web3.utils.toWei('300'));
				await RewardDistribution.fund(recipients, [web3.utils.toWei('300'), ...new Array(499).fill(0)]);

				// Need to go into the future to vest
				await fastForward(WEEK * 4);
			});

			it('should claim and transfer THALES from contract to the user', async () => {
				await RewardDistribution.connect(beneficiaryS).claim();

				// Check user has all their vested THALES
				assert.bnEqual(await Thales.balanceOf(beneficiary), toUnit('600'));

				// Check RewardDistribution does not have any THALES
				assert.bnEqual(await Thales.balanceOf(RewardDistribution.address), toUnit('0'));
			});

			it('should claim and emit a Claim event', async () => {
                let claimEvent = new Promise((resolve, reject) => {
                    RewardDistribution.on('Claim', (sender, now, total, event) => {
                        event.removeListener();
        
                        resolve({
                            sender: sender,
                            total: total
                        });
                    });
        
                    setTimeout(() => {
                        reject(new Error('timeout'));
                    }, 60000)
                });
        
                await RewardDistribution.connect(beneficiaryS).claim();
        
                let event = await claimEvent;
        
                assert.equal(event.sender, beneficiary);
                assert.equal(event.total.toString(), toUnit('600'));
			});

			it('should claim and update totalEscrowedAccountBalance', async () => {
				// This account should have an escrowedAccountBalance
				let escrowedAccountBalance = await RewardDistribution.totalEscrowedAccountBalance(beneficiary);
				assert.bnEqual(escrowedAccountBalance, toUnit('600'));

				// Claim
				await RewardDistribution.connect(beneficiaryS).claim();

				// This account should not have any amount escrowed
				escrowedAccountBalance = await RewardDistribution.totalEscrowedAccountBalance(beneficiary);
				assert.bnEqual(escrowedAccountBalance, toUnit('0'));
			});

			it('should claim and update totalVestedAccountBalance', async () => {
				// This account should have zero totalVestedAccountBalance
				let totalVestedAccountBalance = await RewardDistribution.totalVestedAccountBalance(beneficiary);
				assert.bnEqual(totalVestedAccountBalance, toUnit('0'));

				// Claim
				await RewardDistribution.connect(beneficiaryS).claim();

				// This account should have vested its whole amount
				totalVestedAccountBalance = await RewardDistribution.totalVestedAccountBalance(beneficiary);
				assert.bnEqual(totalVestedAccountBalance, toUnit('600'));
			});

			it('should claim and update totalEscrowedBalance', async () => {
				await RewardDistribution.connect(beneficiaryS).claim();
				// There should be no Escrowed balance left in the contract
				assert.bnEqual(await RewardDistribution.totalEscrowedBalance(), toUnit('0'));
			});
		});
    });
});

const deployContract = async (name, args) => {
    const factory = await ethers.getContractFactory(name);
    const ctr = await factory.deploy(...(args || []));
    await ctr.deployed();
  
    return ctr;
}

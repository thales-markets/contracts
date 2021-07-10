'use strict';

const { contract, web3 } = require('hardhat');
const { assert } = require('./common');
const { currentTime, fastForward, toUnit } = require('../utils')();

const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const TOTAL_AMOUNT = web3.utils.toWei("100000");
const { testAccounts } = require('./test-accounts');

contract('RewardEscrow', async accounts => {
	const SECOND = 1000;
	const DAY = 86400;
	const WEEK = 604800;
	const YEAR = 31556926;

	const [admin, beneficiary, account1, account2, account3, account4] = accounts;
	let Thales, RewardEscrow;

	before(async () => {
        Thales = await deployContract("Thales");

        RewardEscrow = await deployContract("RewardEscrow", [
            Thales.address,
            [account1, account2, account3, account4]
        ]);

        const recipients = [beneficiary, ...testAccounts];
        const amounts = new Array(100).fill(web3.utils.toWei("1000")); 

        await RewardEscrow.addTokens(TOTAL_AMOUNT);
        await RewardEscrow.fund(recipients, amounts);
	});

    describe('Constructor & Settings ', async () => {
	
		it('should set admin on contructor', async () => {
			const adminAddress = await RewardEscrow.admin();
			assert.equal(adminAddress, admin);
		});

	});

	describe('Given there are no escrow entries', async () => {
        let adminS, beneficiaryS;
        before(async () => {
            [adminS, beneficiaryS] = await ethers.getSigners();
            Thales = await deployContract("Thales");

            RewardEscrow = await deployContract("RewardEscrow", [
                Thales.address,
                [account1, account2, account3, account4]
            ]);
        });
        
		it('then numVestingEntries should return 0', async () => {
			assert.equal(0, await RewardEscrow.numVestingEntries(beneficiary));
		});
		it('then getNextVestingEntry should return 0', async () => {
			const nextVestingEntry = await RewardEscrow.getNextVestingEntry(beneficiary);
			assert.equal(nextVestingEntry[0], 0);
			assert.equal(nextVestingEntry[1], 0);
		});
		it('then vest should do nothing and not revert', async () => {
			await RewardEscrow.connect(beneficiaryS).claim();
			assert.bnEqual(toUnit('0'), await RewardEscrow.totalVestedAccountBalance(beneficiary));
		});
	});

    describe('Functions', async() => {
        beforeEach(async () => {
		
            Thales = await deployContract("Thales");
    
            RewardEscrow = await deployContract("RewardEscrow", [
                Thales.address,
                [account1, account2, account3, account4]
            ]);
        });

		describe('Vesting Schedule Writes', async () => {
			it('should not create vesting entries if there is not enough THALES in the contracts balance', async () => {
                await RewardEscrow.addTokens(web3.utils.toWei('100'));
                const recipients = [beneficiary, ...testAccounts];
                const amounts = new Array(100).fill(web3.utils.toWei('1000')); 
				await assert.revert(
					RewardEscrow.fund(recipients, amounts)
				);
			});
		});

        describe('Vesting Schedule Reads', async () => {
			beforeEach(async () => {
                const recipients = [beneficiary, ...new Array(99).fill(ZERO_ADDRESS)];

                await RewardEscrow.addTokens(web3.utils.toWei('100'));
				await RewardEscrow.fund(recipients, [web3.utils.toWei('100'), ...new Array(99).fill(0)]);
				await fastForward(WEEK);

                await RewardEscrow.addTokens(web3.utils.toWei('200'));
				await RewardEscrow.fund(recipients, [web3.utils.toWei('200'), ...new Array(99).fill(0)]);
				await fastForward(WEEK);

                await RewardEscrow.addTokens(web3.utils.toWei('300'));
				await RewardEscrow.fund(recipients, [web3.utils.toWei('300'), ...new Array(99).fill(0)]);
			});

			it('should append a vesting entry and increase the contracts balance', async () => {
				const balanceOfRewardEscrow = await Thales.balanceOf(RewardEscrow.address);
				assert.bnEqual(balanceOfRewardEscrow, toUnit('600'));
			});

			it('should get an account\'s total Vested Account Balance', async () => {
				const balanceOf = await RewardEscrow.balanceOf(beneficiary);
				assert.bnEqual(balanceOf, toUnit('600'));
			});

			it('should get an account\'s number of vesting entries', async () => {
				const numVestingEntries = await RewardEscrow.numVestingEntries(beneficiary);
				assert.equal(numVestingEntries, 3);
			});

			it('should get an account\'s vesting schedule entry by index', async () => {
				let vestingScheduleEntry;
				vestingScheduleEntry = await RewardEscrow.getVestingScheduleEntry(beneficiary, 0);
				assert.bnEqual(vestingScheduleEntry[1], toUnit('100'));

				vestingScheduleEntry = await RewardEscrow.getVestingScheduleEntry(beneficiary, 1);
				assert.bnEqual(vestingScheduleEntry[1], toUnit('200'));

				vestingScheduleEntry = await RewardEscrow.getVestingScheduleEntry(beneficiary, 2);
				assert.bnEqual(vestingScheduleEntry[1], toUnit('300'));
			});

			it('should get an account\'s vesting time for a vesting entry index', async () => {
				const fourWeeksAhead = (await currentTime()) + DAY * 28;
				assert.isAtLeast(fourWeeksAhead, parseInt(await RewardEscrow.getVestingTime(beneficiary, 0)));
				assert.isAtLeast(fourWeeksAhead, parseInt(await RewardEscrow.getVestingTime(beneficiary, 1)));
				assert.isAtLeast(fourWeeksAhead, parseInt(await RewardEscrow.getVestingTime(beneficiary, 2)));
			});

			it('should get an account\'s vesting quantity for a vesting entry index', async () => {
				assert.bnEqual(await RewardEscrow.getVestingQuantity(beneficiary, 0), toUnit('100'));
				assert.bnEqual(await RewardEscrow.getVestingQuantity(beneficiary, 1), toUnit('200'));
				assert.bnEqual(await RewardEscrow.getVestingQuantity(beneficiary, 2), toUnit('300'));
			});
		});

        describe('Partial Vesting', async () => {
			beforeEach(async () => {
                const [adminS, beneficiaryS] = await ethers.getSigners();
                const recipients = [beneficiary, ...new Array(99).fill(ZERO_ADDRESS)];

                await RewardEscrow.addTokens(web3.utils.toWei('100'));
				await RewardEscrow.fund(recipients, [web3.utils.toWei('100'), ...new Array(99).fill(0)]);
				await fastForward(WEEK);

                await RewardEscrow.addTokens(web3.utils.toWei('200'));
				await RewardEscrow.fund(recipients, [web3.utils.toWei('200'), ...new Array(99).fill(0)]);
				await fastForward(WEEK);

                await RewardEscrow.addTokens(web3.utils.toWei('300'));
				await RewardEscrow.fund(recipients, [web3.utils.toWei('300'), ...new Array(99).fill(0)]);

				// fastForward to vest only the first weeks entry
				await fastForward(WEEK * 2);

				// Claim
				await RewardEscrow.connect(beneficiaryS).claim();
			});

			it('should get an account\'s next vesting entry index', async () => {
				assert.bnEqual(await RewardEscrow.getNextVestingIndex(beneficiary), 1);
			});

			it('should get an account\'s next vesting entry', async () => {
				const vestingScheduleEntry = await RewardEscrow.getNextVestingEntry(beneficiary);
				assert.bnEqual(vestingScheduleEntry[1], toUnit('200'));
			});

			it('should get an account\'s next vesting time', async () => {
				const fiveDaysAhead = (await currentTime()) + DAY * 5;
				assert.isAtLeast(parseInt(await RewardEscrow.getNextVestingTime(beneficiary)), fiveDaysAhead);
			});

			it('should get an account\'s next vesting quantity', async () => {
				const nextVestingQuantity = await RewardEscrow.getNextVestingQuantity(beneficiary);
				assert.bnEqual(nextVestingQuantity, toUnit('200'));
			});
		});

        describe('Vesting', async () => {
            let adminS, beneficiaryS;
			beforeEach(async () => {
				[adminS, beneficiaryS] = await ethers.getSigners();
                const recipients = [beneficiary, ...new Array(99).fill(ZERO_ADDRESS)];

                await RewardEscrow.addTokens(web3.utils.toWei('100'));
				await RewardEscrow.fund(recipients, [web3.utils.toWei('100'), ...new Array(99).fill(0)]);
				await fastForward(WEEK);

                await RewardEscrow.addTokens(web3.utils.toWei('200'));
				await RewardEscrow.fund(recipients, [web3.utils.toWei('200'), ...new Array(99).fill(0)]);
				await fastForward(WEEK);

                await RewardEscrow.addTokens(web3.utils.toWei('300'));
				await RewardEscrow.fund(recipients, [web3.utils.toWei('300'), ...new Array(99).fill(0)]);

				// Need to go into the future to vest
				await fastForward(WEEK * 4);
			});

			it('should claim and transfer THALES from contract to the user', async () => {
				await RewardEscrow.connect(beneficiaryS).claim();

				// Check user has all their vested THALES
				assert.bnEqual(await Thales.balanceOf(beneficiary), toUnit('600'));

				// Check RewardEscrow does not have any THALES
				assert.bnEqual(await Thales.balanceOf(RewardEscrow.address), toUnit('0'));
			});

			it('should claim and emit a Claim event', async () => {
                let claimEvent = new Promise((resolve, reject) => {
                    RewardEscrow.on('Claim', (sender, now, total, event) => {
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
        
                await RewardEscrow.connect(beneficiaryS).claim();
        
                let event = await claimEvent;
        
                assert.equal(event.sender, beneficiary);
                assert.equal(event.total.toString(), toUnit('600'));
			});

			it('should claim and update totalEscrowedAccountBalance', async () => {
				// This account should have an escrowedAccountBalance
				let escrowedAccountBalance = await RewardEscrow.totalEscrowedAccountBalance(beneficiary);
				assert.bnEqual(escrowedAccountBalance, toUnit('600'));

				// Claim
				await RewardEscrow.connect(beneficiaryS).claim();

				// This account should not have any amount escrowed
				escrowedAccountBalance = await RewardEscrow.totalEscrowedAccountBalance(beneficiary);
				assert.bnEqual(escrowedAccountBalance, toUnit('0'));
			});

			it('should claim and update totalVestedAccountBalance', async () => {
				// This account should have zero totalVestedAccountBalance
				let totalVestedAccountBalance = await RewardEscrow.totalVestedAccountBalance(beneficiary);
				assert.bnEqual(totalVestedAccountBalance, toUnit('0'));

				// Claim
				await RewardEscrow.connect(beneficiaryS).claim();

				// This account should have vested its whole amount
				totalVestedAccountBalance = await RewardEscrow.totalVestedAccountBalance(beneficiary);
				assert.bnEqual(totalVestedAccountBalance, toUnit('600'));
			});

			it('should claim and update totalEscrowedBalance', async () => {
				await RewardEscrow.connect(beneficiaryS).claim();
				// There should be no Escrowed balance left in the contract
				assert.bnEqual(await RewardEscrow.totalEscrowedBalance(), toUnit('0'));
			});
		});

        describe('Stress Test', () => {
            let adminS, beneficiaryS, recipients;
            beforeEach(async () => {
                [adminS, beneficiaryS] = await ethers.getSigners();
                recipients = [beneficiary, ...new Array(99).fill(ZERO_ADDRESS)];
                Thales = await deployContract("Thales");

                RewardEscrow = await deployContract("RewardEscrow", [
                    Thales.address,
                    [account1, account2, account3, account4]
                ]);
            });

			it('should not create more than MAX_VESTING_ENTRIES vesting entries', async () => {
				const MAX_VESTING_ENTRIES = 52; // await RewardEscrow.MAX_VESTING_ENTRIES();
                const REVERT = "VM Exception while processing transaction: revert Vesting schedule is too long";

				// append the MAX_VESTING_ENTRIES to the schedule
				for (let i = 0; i < MAX_VESTING_ENTRIES; i++) {
                    await RewardEscrow.addTokens(web3.utils.toWei('1'));
                    await RewardEscrow.fund(recipients, [web3.utils.toWei('1'), ...new Array(99).fill(0)]);
                    await fastForward(WEEK);
				}

                await RewardEscrow.addTokens(web3.utils.toWei('1'));
                await RewardEscrow.fund(recipients, [web3.utils.toWei('1'), ...new Array(99).fill(0)]);
				// assert adding 1 more above the MAX_VESTING_ENTRIES fails
				await assert.revert(
					RewardEscrow.fund(recipients, [web3.utils.toWei('1'), ...new Array(99).fill(0)]),
                    REVERT
				);
			}).timeout(60e3);

			it('should be able to vest 52 weeks vesting entries', async () => {
				const MAX_VESTING_ENTRIES = 52; // await rewardEscrow.MAX_VESTING_ENTRIES();

				// Append the MAX_VESTING_ENTRIES to the schedule
				for (let i = 0; i < MAX_VESTING_ENTRIES; i++) {
					await RewardEscrow.addTokens(web3.utils.toWei('1'));
                    await RewardEscrow.fund(recipients, [web3.utils.toWei('1'), ...new Array(99).fill(0)]);
                    await fastForward(SECOND);
				}

				// Need to go into the future to claim
				await fastForward(4*WEEK + DAY);

				// Claim
				await RewardEscrow.connect(beneficiaryS).claim();

				// Check user has all their claimed THALES
				assert.bnEqual(await Thales.balanceOf(beneficiary), toUnit('52'));

				// Check RewardEscrow does not have any THALES
				assert.bnEqual(await Thales.balanceOf(RewardEscrow.address), toUnit('0'));

				// This account should have claimed its whole amount
				assert.bnEqual(await RewardEscrow.totalEscrowedAccountBalance(beneficiary), toUnit('0'));

				// This account should have claimed its whole amount
				assert.bnEqual(await RewardEscrow.totalVestedAccountBalance(beneficiary), toUnit('52'));
			}).timeout(60e3);

			it('should be able to read an accounts schedule of 5 vesting entries', async () => {
				const VESTING_ENTRIES = 5;

				// Append the VESTING_ENTRIES to the schedule
				for (let i = 0; i < VESTING_ENTRIES; i++) {
					await RewardEscrow.addTokens(web3.utils.toWei('1'));
                    await RewardEscrow.fund(recipients, [web3.utils.toWei('1'), ...new Array(99).fill(0)]);
                    await fastForward(SECOND);
				}

				// Get the vesting Schedule
				const accountSchedule = await RewardEscrow.checkAccountSchedule(beneficiary);

				// Check accountSchedule entries
				for (let i = 1; i < VESTING_ENTRIES; i += 2) {
					if (accountSchedule[i]) {
						assert.bnEqual(accountSchedule[i], toUnit('1'));
					}
					break;
				}
			}).timeout(60e3);

			it('should be able to read the full account schedule 52 weeks vesting entries', async () => {
				const MAX_VESTING_ENTRIES = 52; // await rewardEscrow.MAX_VESTING_ENTRIES();

				// Append the MAX_VESTING_ENTRIES to the schedule
				for (let i = 0; i < MAX_VESTING_ENTRIES; i++) {
					await RewardEscrow.addTokens(web3.utils.toWei('1'));
                    await RewardEscrow.fund(recipients, [web3.utils.toWei('1'), ...new Array(99).fill(0)]);
                    await fastForward(SECOND);
				}

				// Get the vesting Schedule
				const accountSchedule = await RewardEscrow.checkAccountSchedule(beneficiary);

				// Check accountSchedule entries
				for (let i = 1; i < MAX_VESTING_ENTRIES; i += 2) {
					assert.bnEqual(accountSchedule[i], toUnit('1'));
				}
			}).timeout(60e3);
		});
    });
});

const deployContract = async (name, args) => {
    const factory = await ethers.getContractFactory(name);
    const ctr = await factory.deploy(...(args || []));
    await ctr.deployed();
  
    return ctr;
}

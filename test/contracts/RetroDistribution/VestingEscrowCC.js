'use strict';

const { contract, web3, artifacts } = require('hardhat');
const Big = require('big.js');
const { toBN } = web3.utils;
const { currentTime, fastForward } = require('../../utils')();

const { time } = require('@openzeppelin/test-helpers');
const { assert } = require('../../utils/common');

const VESTING_PERIOD = 86400 * 365;
const TOTAL_AMOUNT = web3.utils.toWei('4500000');
const SINGLE_AMOUNT = web3.utils.toWei('150000');

const { testAccounts } = require('./testRecipients');
const { numberExponentToLarge } = require('../../../scripts/helpers');

const { encodeCall } = require('../../utils/helpers');

contract('VestingEscrow', (accounts) => {
	const WEEK = 604800;
	const YEAR = 31556926;
	let owner, beneficiary, revoker, newAddress;
	let Thales, VestingEscrow;

	describe('Getters', () => {
		let amounts, startTimes, recipients;
		beforeEach(async () => {
			[owner, beneficiary, revoker] = await ethers.getSigners();
			let now = await currentTime();

			let OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');

			Thales = artifacts.require('Thales');
			let ThalesDeployed = await Thales.new({ from: owner.address });

			let vestingEscrow = artifacts.require('VestingEscrowCC');
			let VestingEscrowDeployed = await OwnedUpgradeabilityProxy.new({ from: owner.address });
			let VestingEscrowImplementation = await vestingEscrow.new({ from: owner.address });
			VestingEscrow = await vestingEscrow.at(VestingEscrowDeployed.address);

			let initializeVestingEscrowData = encodeCall(
				'initialize',
				['address', 'address', 'uint'],
				[owner.address, ThalesDeployed.address, VESTING_PERIOD]
			);

			await VestingEscrowDeployed.upgradeToAndCall(
				VestingEscrowImplementation.address,
				initializeVestingEscrowData,
				{
					from: owner.address,
				}
			);

			recipients = [beneficiary.address, ...testAccounts];
			startTimes = new Array(30);
			amounts = new Array(30).fill(web3.utils.toWei('150000'));

			// set different startTimes for all recipients
			for (let i = 0; i < recipients.length; i++) {
				startTimes[i] = (i === 0 ? now : startTimes[i - 1]) + WEEK;
				await VestingEscrow.fund(recipients[i], amounts[i], startTimes[i], { from: owner.address });
			}

			await ThalesDeployed.transfer(VestingEscrow.address, TOTAL_AMOUNT, { from: owner.address });
			await ThalesDeployed.approve(VestingEscrow.address, TOTAL_AMOUNT, { from: owner.address });
		});

		it('should get total vested supply', async () => {
			const vestedSupplyBeforeStart = await VestingEscrow.vestedSupply();
			assert.equal(vestedSupplyBeforeStart, 0);

			// week after last recipient end time
			await fastForward(startTimes[startTimes.length - 1] + YEAR + WEEK);

			const vestedSupplyAfterStart = await VestingEscrow.vestedSupply();

			let sum = Big(0);
			for (let i = 0; i < amounts.length; i++) {
				sum = sum.add(amounts[i]);
			}

			assert.equal(
				vestedSupplyAfterStart.toString(),
				sum.toNumber().toLocaleString('fullwide', { useGrouping: false })
			);
		});

		it('should get total locked supply', async () => {
			const lockedSupplyStart = await VestingEscrow.lockedSupply();
			assert.equal(lockedSupplyStart, TOTAL_AMOUNT);

			// week after last recipient end time
			await fastForward(startTimes[startTimes.length - 1] + YEAR + WEEK);

			const lockedSupplyEnd = await VestingEscrow.lockedSupply();
			assert.equal(lockedSupplyEnd, 0);
		});

		it('should get vested amount of address', async () => {
			const vestedOfStart = await VestingEscrow.vestedOf(beneficiary.address);
			assert.equal(vestedOfStart, 0);

			await fastForward(YEAR + WEEK);

			const vestedOfEnd = await VestingEscrow.vestedOf(beneficiary.address);
			assert.equal(vestedOfEnd, amounts[0]);
		});

		it('should get locked amount of address - first address', async () => {
			let lockedOfStart = await VestingEscrow.lockedOf(beneficiary.address);
			assert.equal(lockedOfStart, amounts[0]);

			await fastForward(startTimes[0] + WEEK);

			let lockedOfEnd = await VestingEscrow.lockedOf(beneficiary.address);
			assert.equal(lockedOfEnd, 0);
		});

		it('should get locked amount of address - last address', async () => {
			let index = recipients.length - 1;
			let lockedOfStart = await VestingEscrow.lockedOf(recipients[index]);
			assert.equal(lockedOfStart, amounts[index]);

			await fastForward(startTimes[index] + WEEK);

			let lockedOfEnd = await VestingEscrow.lockedOf(recipients[index]);
			assert.equal(lockedOfEnd, 0);
		});

		it('should get balance of address', async () => {
			const balanceOfStart = await VestingEscrow.balanceOf(beneficiary.address);
			assert.equal(balanceOfStart, 0);

			await fastForward(startTimes[0] + WEEK);

			const balanceOfEnd = await VestingEscrow.balanceOf(beneficiary.address);
			assert.equal(balanceOfEnd, amounts[0]);

			await VestingEscrow.claim({ from: beneficiary.address });
			assert.equal(await VestingEscrow.balanceOf(beneficiary.address), 0);
		});
	});

	describe('Fund', () => {
		let amounts, recipients, notowner, startTimes, ThalesDeployed;
		beforeEach(async () => {
			[owner, beneficiary, revoker, notowner] = await ethers.getSigners();
			let now = await currentTime();

			let OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');

			let Thales = artifacts.require('Thales');
			ThalesDeployed = await Thales.new({ from: owner.address });

			let vestingEscrow = artifacts.require('VestingEscrowCC');
			let VestingEscrowDeployed = await OwnedUpgradeabilityProxy.new({ from: owner.address });
			let VestingEscrowImplementation = await vestingEscrow.new({ from: owner.address });
			VestingEscrow = await vestingEscrow.at(VestingEscrowDeployed.address);

			let initializeVestingEscrowData = encodeCall(
				'initialize',
				['address', 'address', 'uint'],
				[owner.address, ThalesDeployed.address, VESTING_PERIOD]
			);

			await VestingEscrowDeployed.upgradeToAndCall(
				VestingEscrowImplementation.address,
				initializeVestingEscrowData,
				{
					from: owner.address,
				}
			);

			recipients = [beneficiary.address, ...testAccounts];
			amounts = new Array(30);
			startTimes = new Array(30);
			for (let i = 1; i < 31; i++) {
				amounts[i - 1] = (i * 10 ** 17).toString();
			}

			// set different startTimes for all recipients
			for (let i = 0; i < recipients.length; i++) {
				startTimes[i] = (i === 0 ? now : startTimes[i - 1]) + WEEK;
			}
			await ThalesDeployed.transfer(VestingEscrow.address, TOTAL_AMOUNT, { from: owner.address });
			await ThalesDeployed.approve(VestingEscrow.address, TOTAL_AMOUNT, { from: owner.address });
		});

		it('should get token balance', async () => {
			assert.equal(await ThalesDeployed.balanceOf(VestingEscrow.address), TOTAL_AMOUNT);
		});

		it('should get initial locked supply', async () => {
			for (let i = 0; i < recipients.length; i++) {
				await VestingEscrow.fund(recipients[i], amounts[i], startTimes[i], { from: owner.address });
			}
			let amountsSum = 0;
			for (let i = 0; i < amounts.length; i++) {
				amountsSum += parseInt(amounts[i]);
			}
			assert.equal(await VestingEscrow.initialLockedSupply(), toBN(amountsSum).toString());
		});

		it('should get inital locked for each account', async () => {
			for (let i = 0; i < recipients.length; i++) {
				await VestingEscrow.fund(recipients[i], amounts[i], startTimes[i], { from: owner.address });
			}
			const data = amounts.reduce(function (data, field, index) {
				data[recipients[index]] = field;
				return data;
			}, {});

			for (let [account, expectedAmount] of Object.entries(data)) {
				assert.equal(await VestingEscrow.initialLocked(account), expectedAmount);
			}
		});

		it('should fund partial recipients', async () => {
			recipients = [...recipients.slice(0, 5)];
			startTimes = [...startTimes.slice(0, 5)];
			for (let i = 0; i < recipients.length; i++) {
				await VestingEscrow.fund(recipients[i], amounts[i], startTimes[i], { from: owner.address });
			}
			let amountsSum = 0;
			for (let i = 0; i < 5; i++) {
				amountsSum += parseInt(amounts[i]);
			}
			assert.equal(await VestingEscrow.initialLockedSupply(), toBN(amountsSum).toString());
		});

		it('should fund one recipient', async () => {
			await VestingEscrow.fund(accounts[5], (10 ** 20).toString(), startTimes[5], {
				from: owner.address,
			});

			assert.equal(await VestingEscrow.initialLockedSupply(), toBN(10 ** 20).toString());
		});

		it('should fund multiple times with different recipients', async () => {
			recipients = [accounts[4], accounts[5]];
			startTimes = [startTimes[4], startTimes[5]];
			amounts = [(10 ** 20).toString(), (10 ** 20 * 2).toString()];
			for (let i = 0; i < recipients.length; i++) {
				await VestingEscrow.fund(recipients[i], amounts[i], startTimes[i], { from: owner.address });
			}

			recipients = [accounts[6], accounts[4]];
			for (let i = 0; i < recipients.length; i++) {
				await VestingEscrow.fund(recipients[i], amounts[i], startTimes[i], { from: owner.address });
			}
			assert.equal(await VestingEscrow.initialLockedSupply(), toBN(10 ** 20 * 6).toString());

			assert.equal(await VestingEscrow.initialLocked(accounts[4]), toBN(10 ** 20 * 3).toString());
			assert.equal(await VestingEscrow.initialLocked(accounts[5]), toBN(10 ** 20 * 2).toString());
			assert.equal(await VestingEscrow.initialLocked(accounts[6]), toBN(10 ** 20).toString());
		});

		it('should fund multiple times with same recipients', async () => {
			await VestingEscrow.fund(accounts[5], (10 ** 20 * 2).toString(), startTimes[5], {
				from: owner.address,
			});

			await VestingEscrow.fund(accounts[5], (10 ** 20).toString(), startTimes[5], {
				from: owner.address,
			});

			assert.equal(await VestingEscrow.initialLockedSupply(), toBN(10 ** 20 * 3).toString());

			assert.equal(await VestingEscrow.initialLocked(accounts[5]), toBN(10 ** 20 * 3).toString());
		});

		it("should fund from owner's account only", async () => {
			const REVERT = 'Only the contract owner may perform this action';
			await assert.revert(
				VestingEscrow.fund(recipients[0], amounts[0], startTimes[0], { from: notowner.address }),
				REVERT
			);
		});

		it('should fund from funding owner account', async () => {
			await VestingEscrow.fund(accounts[5], (10 ** 20).toString(), startTimes[5], {
				from: owner.address,
			});

			assert.equal(await VestingEscrow.initialLockedSupply(), toBN(10 ** 20).toString());

			assert.equal(await VestingEscrow.initialLocked(accounts[5]), toBN(10 ** 20).toString());
		});
	});

	describe('Claim', () => {
		let startTimes, recipients, amounts, ThalesDeployed;
		beforeEach(async () => {
			[owner, beneficiary, revoker, newAddress] = await ethers.getSigners();
			const now = await currentTime();

			let OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');

			let Thales = artifacts.require('Thales');
			ThalesDeployed = await Thales.new({ from: owner.address });

			let vestingEscrow = artifacts.require('VestingEscrowCC');
			let VestingEscrowDeployed = await OwnedUpgradeabilityProxy.new({ from: owner.address });
			let VestingEscrowImplementation = await vestingEscrow.new({ from: owner.address });
			VestingEscrow = await vestingEscrow.at(VestingEscrowDeployed.address);

			let initializeVestingEscrowData = encodeCall(
				'initialize',
				['address', 'address', 'uint'],
				[owner.address, ThalesDeployed.address, VESTING_PERIOD]
			);

			await VestingEscrowDeployed.upgradeToAndCall(
				VestingEscrowImplementation.address,
				initializeVestingEscrowData,
				{
					from: owner.address,
				}
			);

			recipients = [beneficiary.address, ...testAccounts];
			// set last recipient to be account that could claim
			recipients[recipients.length - 1] = revoker.address;
			startTimes = new Array(30);
			amounts = new Array(30).fill(SINGLE_AMOUNT);

			// set different startTimes for all recipients
			for (let i = 0; i < recipients.length; i++) {
				startTimes[i] = (i === 0 ? now : startTimes[i - 1]) + WEEK;
				await VestingEscrow.fund(recipients[i], amounts[i], startTimes[i], { from: owner.address });
			}

			await ThalesDeployed.transfer(VestingEscrow.address, TOTAL_AMOUNT, { from: owner.address });
			await ThalesDeployed.approve(VestingEscrow.address, TOTAL_AMOUNT, { from: owner.address });
		});

		it('should set initial funding', async () => {
			const initialLockedSupply = await VestingEscrow.initialLockedSupply();
			assert.equal(initialLockedSupply, TOTAL_AMOUNT);
		});

		it('toggle pause/disable claim - should revert if caller is not owner', async () => {
			const REVERT = 'Only the contract owner may perform this action';
			await assert.revert(
				VestingEscrow.disableClaim(beneficiary.address, { from: beneficiary.address }),
				REVERT
			);
			await assert.revert(
				VestingEscrow.enableClaim(beneficiary.address, { from: beneficiary.address }),
				REVERT
			);

			await assert.revert(
				VestingEscrow.pauseClaim(beneficiary.address, { from: beneficiary.address }),
				REVERT
			);
			await assert.revert(
				VestingEscrow.unpauseClaim(beneficiary.address, { from: beneficiary.address }),
				REVERT
			);
		});

		it('should claim partial amount if account is paused', async () => {
			await fastForward(5 * WEEK);
			VestingEscrow.pauseClaim(beneficiary.address, { from: owner.address });
			// calculate amount at that moment
			let expectedAmount = Big(SINGLE_AMOUNT)
				.mul(Big(await currentTime()).sub(startTimes[0]))
				.div(VESTING_PERIOD)
				.div(10 ** 18)
				.round(0, Big.roundDown);

			// some time forward
			await fastForward(20 * WEEK);
			await VestingEscrow.claim({ from: beneficiary.address });
			const balanceOfAccountDecimal = await ThalesDeployed.balanceOf(beneficiary.address);

			let balanceOfAccount = Big(balanceOfAccountDecimal)
				.div(10 ** 18)
				.round(0, Big.roundDown);

			await fastForward(30 * WEEK);
			// unpause account
			await VestingEscrow.unpauseClaim(beneficiary.address, { from: owner.address });

			await VestingEscrow.claim({ from: beneficiary.address });
			balanceOfAccount = await ThalesDeployed.balanceOf(beneficiary.address);

			// should claim full amount after end time
			assert.equal(balanceOfAccount, SINGLE_AMOUNT);
		});

		it('should disable/enable claim', async () => {
			await fastForward(5 * WEEK);

			await VestingEscrow.claim({ from: beneficiary.address });
			VestingEscrow.disableClaim(beneficiary.address, { from: owner.address });
			// some time forward
			await fastForward(20 * WEEK);

			await assert.revert(VestingEscrow.claim({ from: beneficiary.address }), 'Account disabled');

			await fastForward(30 * WEEK);
			// enable account
			await VestingEscrow.enableClaim(beneficiary.address, { from: owner.address });

			await VestingEscrow.claim({ from: beneficiary.address });
			let balanceOfAccount = await ThalesDeployed.balanceOf(beneficiary.address);

			// should claim full amount after end time
			assert.equal(balanceOfAccount, SINGLE_AMOUNT);
		});

		it('should claim full amount', async () => {
			await fastForward(startTimes[0] + VESTING_PERIOD);
			await VestingEscrow.claim({ from: beneficiary.address });

			const balanceOfAccount = await ThalesDeployed.balanceOf(beneficiary.address);

			assert.equal(balanceOfAccount, SINGLE_AMOUNT);
		});

		it('should show zero balance if claimed before start', async () => {
			await time.increaseTo((await currentTime()).toString());
			const REVERT = 'Nothing to claim';
			await assert.revert(VestingEscrow.claim({ from: beneficiary.address }), REVERT);
		});

		it('should be able to claim partial', async () => {
			await fastForward(10 * WEEK);
			// first address
			await VestingEscrow.claim({ from: beneficiary.address });
			let expectedAmount = Big(SINGLE_AMOUNT)
				.mul(Big(await currentTime()).sub(startTimes[0]))
				.div(VESTING_PERIOD)
				.round(0, Big.roundDown);

			let balanceOfAccount = await ThalesDeployed.balanceOf(beneficiary.address);
			assert.equal(balanceOfAccount.toString(), numberExponentToLarge(expectedAmount.toString()));

			// last address
			await fastForward(30 * WEEK);
			await VestingEscrow.claim({ from: recipients[recipients.length - 1] });

			expectedAmount = Big(SINGLE_AMOUNT)
				.mul(Big(await currentTime()).sub(startTimes[startTimes.length - 1]))
				.div(VESTING_PERIOD)
				.round();

			balanceOfAccount = await ThalesDeployed.balanceOf(recipients[recipients.length - 1]);
			assert.equal(balanceOfAccount.toString(), numberExponentToLarge(expectedAmount.toString()));
		});

		it('should be able to claim multiple times ', async () => {
			let balance = 0;
			await fastForward(WEEK);
			for (let i = 0; i < 53; i++) {
				await fastForward(WEEK);
				await VestingEscrow.claim({ from: beneficiary.address });
				let newBalance = await ThalesDeployed.balanceOf(beneficiary.address);
				assert.bnGt(newBalance, balance);
				balance = newBalance;
			}

			const balanceOfAccount = await ThalesDeployed.balanceOf(beneficiary.address);
			assert.equal(balanceOfAccount, SINGLE_AMOUNT);
		});

		it('should be able to partial claim', async () => {
			const partial_amount = web3.utils.toWei('10000');
			await fastForward(WEEK);
			let balanceOfAccount = await ThalesDeployed.balanceOf(beneficiary.address);
			console.log('balance', balanceOfAccount / 1e18);

			await fastForward(54 * WEEK);

			await VestingEscrow.partialClaim(partial_amount, { from: beneficiary.address });

			balanceOfAccount = await ThalesDeployed.balanceOf(beneficiary.address);
			console.log(balanceOfAccount / 1e18);
		});

		describe('Change wallet', () => {
			it('should revert if caller is not the owner', async () => {
				const REVERT = 'Only the contract owner may perform this action';
				await assert.revert(
					VestingEscrow.changeWallet(beneficiary.address, newAddress.address, {
						from: revoker.address,
					}),
					REVERT
				);
			});

			it('should revert if address is already allocated', async () => {
				const REVERT = 'Address is already a recipient';
				await assert.revert(
					VestingEscrow.changeWallet(beneficiary.address, revoker.address, {
						from: owner.address,
					}),
					REVERT
				);
			});

			it('should change wallet and claim with new address', async () => {
				await VestingEscrow.changeWallet(beneficiary.address, newAddress.address, {
					from: owner.address,
				});

				assert.equal(await VestingEscrow.startTime(beneficiary.address), 0);
				assert.equal(await VestingEscrow.startTime(newAddress.address), startTimes[0]);

				assert.equal(await VestingEscrow.endTime(beneficiary.address), 0);
				assert.equal(
					await VestingEscrow.endTime(newAddress.address),
					startTimes[0] + VESTING_PERIOD
				);

				assert.equal(await VestingEscrow.initialLocked(beneficiary.address), 0);
				assert.equal(await VestingEscrow.initialLocked(newAddress.address), SINGLE_AMOUNT);

				await fastForward(10 * WEEK);
				// first address
				await VestingEscrow.claim({ from: newAddress.address });
				let expectedAmount = Big(SINGLE_AMOUNT)
					.mul(Big(await currentTime()).sub(startTimes[0]))
					.div(VESTING_PERIOD)
					.round(0, Big.roundDown);

				let balanceOfAccount = await ThalesDeployed.balanceOf(newAddress.address);
				assert.equal(balanceOfAccount.toString(), numberExponentToLarge(expectedAmount.toString()));
			});

			describe('Change allocation', () => {
				it('should revert if caller is not the owner', async () => {
					const REVERT = 'Only the contract owner may perform this action';
					await assert.revert(
						VestingEscrow.increaseAllocation(beneficiary.address, SINGLE_AMOUNT, {
							from: revoker.address,
						}),
						REVERT
					);

					await assert.revert(
						VestingEscrow.decreaseAllocation(beneficiary.address, web3.utils.toWei('50000'), {
							from: revoker.address,
						}),
						REVERT
					);
				});

				it('should increase allocation', async () => {
					const DOUBLE_SINGLE_AMOUNT = web3.utils.toWei('300000');
					await VestingEscrow.increaseAllocation(beneficiary.address, SINGLE_AMOUNT, {
						from: owner.address,
					});

					assert.equal(
						await VestingEscrow.initialLocked(beneficiary.address),
						DOUBLE_SINGLE_AMOUNT
					);

					await fastForward(startTimes[0] + VESTING_PERIOD);
					await VestingEscrow.claim({ from: beneficiary.address });

					const balanceOfAccount = await ThalesDeployed.balanceOf(beneficiary.address);

					assert.equal(balanceOfAccount, DOUBLE_SINGLE_AMOUNT);
				});

				it('should decrease allocation', async () => {
					await VestingEscrow.decreaseAllocation(beneficiary.address, web3.utils.toWei('50000'), {
						from: owner.address,
					});

					assert.equal(
						await VestingEscrow.initialLocked(beneficiary.address),
						web3.utils.toWei('100000')
					);

					await fastForward(startTimes[0] + VESTING_PERIOD);
					await VestingEscrow.claim({ from: beneficiary.address });

					const balanceOfAccount = await ThalesDeployed.balanceOf(beneficiary.address);

					assert.equal(balanceOfAccount, web3.utils.toWei('100000'));
				});

				it('should revert if decreased amount is larger than vested amount', async () => {
					await fastForward(30 * WEEK);
					await VestingEscrow.claim({ from: beneficiary.address });

					await assert.revert(
						VestingEscrow.decreaseAllocation(
							beneficiary.address,
							web3.utils.toWei('100000000000000000000000000'),
							{
								from: owner.address,
							}
						),
						'Invalid amount'
					);
				});
			});
		});
	});
});

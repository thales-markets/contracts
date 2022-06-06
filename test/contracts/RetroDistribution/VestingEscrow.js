'use strict';

const { contract, web3 } = require('hardhat');
const Big = require('big.js');
const { toBN } = web3.utils;
const { currentTime, fastForward } = require('../../utils')();

const { time } = require('@openzeppelin/test-helpers');
const { assert } = require('../../utils/common');

const VESTING_PERIOD = 86400 * 365;
const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const TOTAL_AMOUNT = web3.utils.toWei('15000000');

const { testRecipients } = require('./testRecipients');
const { numberExponentToLarge } = require('../../../scripts/helpers');

contract('VestingEscrow', accounts => {
	const WEEK = 604800;
	const YEAR = 31556926;
	let admin, beneficiary, revoker;
	let Thales, VestingEscrow;

	describe('Getters', () => {
		let amounts;
		beforeEach(async () => {
			[admin, beneficiary, revoker] = await ethers.getSigners();
			let now = await currentTime();

			Thales = await deployContract('Thales');
			VestingEscrow = await deployContract('VestingEscrow', [
				admin.address,
				Thales.address,
				(now + 10000).toString(),
				(now + YEAR).toString(),
			]);

			const recipients = [beneficiary.address, ...testRecipients];
			amounts = new Array(100).fill(web3.utils.toWei('150000'));

			await Thales.approve(VestingEscrow.address, TOTAL_AMOUNT);
			await VestingEscrow.addTokens(TOTAL_AMOUNT);
			await VestingEscrow.fund(recipients, amounts);
		});

		it('should get total vested supply', async () => {
			const vestedSupplyBeforeStart = await VestingEscrow.vestedSupply();
			assert.equal(vestedSupplyBeforeStart, 0);

			await fastForward(YEAR + WEEK);

			const vestedSupplyAfterStart = await VestingEscrow.vestedSupply();

			let sum = Big(0);
			for (let i = 0; i < 100; i++) {
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

			await fastForward(YEAR + WEEK);

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

		it('should get locked amount of address', async () => {
			const lockedOfStart = await VestingEscrow.lockedOf(beneficiary.address);
			assert.equal(lockedOfStart, amounts[0]);

			await fastForward(YEAR + WEEK);

			const lockedOfEnd = await VestingEscrow.lockedOf(beneficiary.address);
			assert.equal(lockedOfEnd, 0);
		});

		it('should get balance of address', async () => {
			const balanceOfStart = await VestingEscrow.balanceOf(beneficiary.address);
			assert.equal(balanceOfStart, 0);

			await fastForward(YEAR + WEEK);

			const balanceOfEnd = await VestingEscrow.balanceOf(beneficiary.address);
			assert.equal(balanceOfEnd, amounts[0]);

			await VestingEscrow.connect(beneficiary).claim({ from: beneficiary.address });
			assert.equal(await VestingEscrow.balanceOf(beneficiary.address), 0);
		});
	});

	describe('Fund', () => {
		let amounts, recipients, fundAdmin2, fundAdmin3, fundAdmin4, notAdmin;
		beforeEach(async () => {
			[
				admin,
				beneficiary,
				revoker,
				fundAdmin2,
				fundAdmin3,
				fundAdmin4,
				notAdmin,
			] = await ethers.getSigners();
			let now = await currentTime();

			Thales = await deployContract('Thales');
			VestingEscrow = await deployContract('VestingEscrow', [
				admin.address,
				Thales.address,
				(now + 100).toString(),
				(now + YEAR).toString(),
			]);

			recipients = [beneficiary.address, ...testRecipients];
			amounts = new Array(100);
			for (let i = 1; i < 101; i++) {
				amounts[i - 1] = (i * 10 ** 17).toString();
			}
			await Thales.approve(VestingEscrow.address, TOTAL_AMOUNT);
			await VestingEscrow.addTokens(TOTAL_AMOUNT);
		});

		it('should get token balance', async () => {
			assert.equal(await Thales.balanceOf(VestingEscrow.address), TOTAL_AMOUNT);
		});

		it('should get initial locked supply', async () => {
			await VestingEscrow.fund(recipients, amounts, { from: admin.address });
			let amountsSum = 0;
			for (let i = 0; i < amounts.length; i++) {
				amountsSum += parseInt(amounts[i]);
			}
			assert.equal(await VestingEscrow.initialLockedSupply(), toBN(amountsSum).toString());
		});

		it('should get unallocated supply', async () => {
			await VestingEscrow.fund(recipients, amounts, { from: admin.address });
			let amountsSum = 0;
			for (let i = 0; i < amounts.length; i++) {
				amountsSum += parseInt(amounts[i]);
			}
			assert.equal(
				await VestingEscrow.unallocatedSupply(),
				toBN(TOTAL_AMOUNT)
					.sub(toBN(amountsSum))
					.toString()
			);
		});

		it('should get inital locked for each account', async () => {
			await VestingEscrow.fund(recipients, amounts, { from: admin.address });
			const data = amounts.reduce(function(data, field, index) {
				data[recipients[index]] = field;
				return data;
			}, {});

			for (let [account, expectedAmount] of Object.entries(data)) {
				assert.equal(await VestingEscrow.initialLocked(account), expectedAmount);
			}
		});

		it('should fund partial recipients', async () => {
			recipients = [...recipients.slice(0, 5), ...new Array(95).fill(ZERO_ADDRESS)];
			await VestingEscrow.fund(recipients, amounts, { from: admin.address });
			let amountsSum = 0;
			for (let i = 0; i < 5; i++) {
				amountsSum += parseInt(amounts[i]);
			}
			assert.equal(await VestingEscrow.initialLockedSupply(), toBN(amountsSum).toString());
		});

		it('should fund one recipient', async () => {
			recipients = [accounts[5], ...new Array(99).fill(ZERO_ADDRESS)];
			await VestingEscrow.fund(recipients, [(10 ** 20).toString(), ...new Array(99).fill('0')], {
				from: admin.address,
			});

			assert.equal(await VestingEscrow.initialLockedSupply(), toBN(10 ** 20).toString());
		});

		it('should fund multiple times with different recipients', async () => {
			recipients = [accounts[5], ...new Array(99).fill(ZERO_ADDRESS)];
			amounts = [(10 ** 20).toString(), (10 ** 20 * 2).toString(), ...new Array(98).fill('0')];
			await VestingEscrow.fund(recipients, amounts, { from: admin.address });

			recipients[0] = accounts[4];
			recipients[1] = accounts[6];
			await VestingEscrow.fund(recipients, amounts, { from: admin.address });

			assert.equal(await VestingEscrow.initialLockedSupply(), toBN(10 ** 20 * 4).toString());
			assert.equal(
				await VestingEscrow.unallocatedSupply(),
				toBN(TOTAL_AMOUNT)
					.sub(toBN(10 ** 20 * 4))
					.toString()
			);
			assert.equal(await VestingEscrow.initialLocked(accounts[4]), toBN(10 ** 20).toString());
			assert.equal(await VestingEscrow.initialLocked(accounts[5]), toBN(10 ** 20).toString());
			assert.equal(await VestingEscrow.initialLocked(accounts[6]), toBN(10 ** 20 * 2).toString());
		});

		it('should fund multiple times with same recipients', async () => {
			recipients = [accounts[5], ...new Array(99).fill(ZERO_ADDRESS)];
			amounts = [(10 ** 20 * 2).toString(), ...new Array(99).fill('0')];

			await VestingEscrow.fund(recipients, amounts, { from: admin.address });

			amounts[0] = (10 ** 20).toString();
			await VestingEscrow.fund(recipients, amounts, { from: admin.address });

			assert.equal(await VestingEscrow.initialLockedSupply(), toBN(10 ** 20 * 3).toString());
			assert.equal(
				await VestingEscrow.unallocatedSupply(),
				toBN(TOTAL_AMOUNT)
					.sub(toBN(10 ** 20 * 3))
					.toString()
			);
			assert.equal(await VestingEscrow.initialLocked(accounts[5]), toBN(10 ** 20 * 3).toString());
		});

		it("should fund from admin's account only", async () => {
			const REVERT =
				'Only the contract owner may perform this action';
			await assert.revert(VestingEscrow.connect(notAdmin).fund(recipients, amounts), REVERT);
		});

		// it('should revert on over allocation', async() => {
		//     const REVERT = 'VM Exception while processing transaction: revert SafeMath: subtraction overflow';
		//     await assert.revert(VestingEscrow.fund(recipients, [100 + TOTAL_AMOUNT + '', ...new Array(99).fill('0')], {from: admin.address}), REVERT);
		// });

		it('should fund from funding admin account', async () => {
			recipients = [accounts[5], ...new Array(99).fill(ZERO_ADDRESS)];
			amounts = [(10 ** 20).toString(), (10 ** 20 * 2).toString(), ...new Array(98).fill('0')];

			await VestingEscrow.connect(admin).fund(recipients, amounts);

			assert.equal(await VestingEscrow.initialLockedSupply(), toBN(10 ** 20).toString());
			assert.equal(
				await VestingEscrow.unallocatedSupply(),
				toBN(TOTAL_AMOUNT)
					.sub(toBN(10 ** 20))
					.toString()
			);
			assert.equal(await VestingEscrow.initialLocked(accounts[5]), toBN(10 ** 20).toString());
		});
	});

	describe('Claim', () => {
		let startTime, endTime;
		beforeEach(async () => {
			[admin, beneficiary, revoker] = await ethers.getSigners();

			startTime = (await currentTime()) + 100;
			endTime = startTime + YEAR;

			Thales = await deployContract('Thales');
			VestingEscrow = await deployContract('VestingEscrow', [
				admin.address,
				Thales.address,
				startTime.toString(),
				endTime.toString(),
			]);

			const recipients = [beneficiary.address, ...new Array(99).fill(ZERO_ADDRESS)];

			await Thales.approve(VestingEscrow.address, TOTAL_AMOUNT);
			await VestingEscrow.addTokens(TOTAL_AMOUNT);
			await VestingEscrow.fund(recipients, [TOTAL_AMOUNT, ...new Array(99).fill(0)]);
		});

		it('should set initial funding', async () => {
			const initialLockedSupply = await VestingEscrow.initialLockedSupply();
			const unallocatedSupply = await VestingEscrow.unallocatedSupply();
			assert.equal(initialLockedSupply, TOTAL_AMOUNT);
			assert.equal(unallocatedSupply, 0);
		});

		it('should claim full amount', async () => {
			await fastForward(53 * WEEK);
			await VestingEscrow.connect(beneficiary).claim({ from: beneficiary.address });

			const balanceOfAccount = await Thales.balanceOf(beneficiary.address);

			assert.equal(balanceOfAccount, TOTAL_AMOUNT);
		});

		it('should show zero balance if claimed before start', async () => {
			await time.increaseTo((await currentTime()).toString());
			const REVERT = 'nothing to claim';
			await assert.revert(VestingEscrow.connect(beneficiary).claim(), REVERT);
		});

		it('should be able to claim partial', async () => {
			await fastForward(10 * WEEK);
			await VestingEscrow.connect(beneficiary).claim({ from: beneficiary.address });
			const expectedAmount = Big(TOTAL_AMOUNT)
				.mul(Big(await currentTime()).sub(startTime))
				.div(Big(endTime).sub(startTime))
				.round();

			const balanceOfAccount = await Thales.balanceOf(beneficiary.address);
			assert.equal(balanceOfAccount.toString(), numberExponentToLarge(expectedAmount.toString()));
		});

		it('should be able to claim multiple times [ @cov-skip ]', async () => {
			let balance = 0;
			for (let i = 0; i < 53; i++) {
				await fastForward(WEEK);
				await VestingEscrow.connect(beneficiary).claim({ from: beneficiary.address });
				let newBalance = await Thales.balanceOf(beneficiary.address);
				assert.bnGt(newBalance, balance);
				balance = newBalance;
			}

			const balanceOfAccount = await Thales.balanceOf(beneficiary.address);
			assert.equal(balanceOfAccount, TOTAL_AMOUNT);
		});
	});

	describe('Selfdestruct', () => {
		let startTime, endTime;

		beforeEach(async () => {
			[admin, beneficiary, revoker] = await ethers.getSigners();

			startTime = (await currentTime()) + 100;
			endTime = startTime + YEAR;

			Thales = await deployContract('Thales');
			VestingEscrow = await deployContract('VestingEscrow', [
				admin.address,
				Thales.address,
				startTime.toString(),
				endTime.toString(),
			]);

			const recipients = [beneficiary.address, ...new Array(99).fill(ZERO_ADDRESS)];

			await Thales.approve(VestingEscrow.address, TOTAL_AMOUNT);
			await VestingEscrow.addTokens(TOTAL_AMOUNT);
			await VestingEscrow.fund(recipients, [TOTAL_AMOUNT, ...new Array(99).fill(0)]);
		});

		it('Cant selfdestruct befor a year passes after end time', async () => {
			await fastForward(YEAR);
			const REVERT =
				'Contract can only be selfdestruct a year after endtime';
			await assert.revert(VestingEscrow._selfDestruct(beneficiary.address), REVERT);
		});

		it('After 3 years everything left goes to admin', async () => {
			await fastForward(YEAR * 3);
			await VestingEscrow._selfDestruct(beneficiary.address);
			assert.equal(await Thales.balanceOf(beneficiary.address), TOTAL_AMOUNT);
		});
	});
});

const deployContract = async (name, args) => {
	const factory = await ethers.getContractFactory(name);
	const ctr = await factory.deploy(...(args || []));
	await ctr.deployed();

	return ctr;
};

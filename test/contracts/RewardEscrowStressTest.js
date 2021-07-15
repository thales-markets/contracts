'use strict';

const { contract, web3 } = require('hardhat');
const { assert } = require('./common');
const { currentTime, fastForward, toUnit } = require('../utils')();

const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const TOTAL_AMOUNT = web3.utils.toWei('100000');
const { testAccounts } = require('./test-accounts');

contract('RewardEscrow', async accounts => {
	const SECOND = 1000;
	const DAY = 86400;
	const WEEK = 604800;
	const YEAR = 31556926;

	const [admin, beneficiary, account1, account2, account3, account4] = accounts;
	let Thales, RewardEscrow;

	before(async () => {
		Thales = await deployContract('Thales');

		RewardEscrow = await deployContract('RewardEscrow', [
			Thales.address,
			[account1, account2, account3, account4],
		]);

		const recipients = [beneficiary, ...testAccounts];
	});

	describe('Vesting Schedule Reads', async () => {
		it('Fund 100 addresses', async () => {
			const recipients = [beneficiary, ...testAccounts];
			await RewardEscrow.addTokens(web3.utils.toWei('200'));
			await RewardEscrow.fund(recipients, [web3.utils.toWei('100'), ...new Array(99).fill(0)]);
		});
	});
});

const deployContract = async (name, args) => {
	const factory = await ethers.getContractFactory(name);
	const ctr = await factory.deploy(...(args || []));
	await ctr.deployed();

	return ctr;
};

'use strict';

const { contract, web3 } = require('hardhat');
const { assert } = require('../../utils/common');
const { currentTime, fastForward, toUnit } = require('../../utils')();

const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const TOTAL_AMOUNT = web3.utils.toWei('100000');
const { testAccounts } = require('../Token/test-accounts');

var ethers2 = require('ethers');
var crypto = require('crypto');

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
		it('Fund 500 addresses', async () => {
			const recipients = [];
			const ammounts = [];
			for (var i = 0; i < 500; i++) {
				var id = crypto.randomBytes(32).toString('hex');
				var privateKey = '0x' + id;

				var wallet = new ethers2.Wallet(privateKey);
				console.log('Address: ' + wallet.address);
				recipients.push(wallet.address);
				ammounts.push(web3.utils.toWei('1'));
			}

			await RewardEscrow.addTokens(web3.utils.toWei('500'));
			await RewardEscrow.fundCustom(recipients, ammounts);
		});
	});
});

const deployContract = async (name, args) => {
	const factory = await ethers.getContractFactory(name);
	const ctr = await factory.deploy(...(args || []));
	await ctr.deployed();

	return ctr;
};

'use strict';

const { contract, web3 } = require('hardhat');
const { currentTime } = require('../utils')();

var ethers2 = require('ethers');
var crypto = require('crypto');

contract('VestingEscrow', async accounts => {
	const YEAR = 31556926;
	let Thales, VestingEscrow;

	before(async () => {
		Thales = await deployContract('Thales');

		VestingEscrow = await deployContract('VestingEscrow', [
			Thales.address,
			((await currentTime()) + 100).toString(),
			((await currentTime()) + 100 + YEAR).toString(),
			true,
			[accounts[2], accounts[3], accounts[4], accounts[5]],
		]);
	});

	describe('Vesting Schedule Reads', async () => {
		it('Fund 100 addresses', async () => {
			const recipients = [];
			for (var i = 0; i < 1000; i++) {
				var id = crypto.randomBytes(32).toString('hex');
				var privateKey = '0x' + id;
				console.log('SAVE BUT DO NOT SHARE THIS:', privateKey);

				var wallet = new ethers2.Wallet(privateKey);
				console.log('Address: ' + wallet.address);
				recipients.push(wallet.address);
			}

			await VestingEscrow.addTokens(web3.utils.toWei('1000'));
			for (i = 0; i < 10; i++) {
				await VestingEscrow.fund(recipients.slice(i * 100, (i + 1) * 100), new Array(100).fill(1));
			}
		});
	});
});

const deployContract = async (name, args) => {
	const factory = await ethers.getContractFactory(name);
	const ctr = await factory.deploy(...(args || []));
	await ctr.deployed();

	return ctr;
};

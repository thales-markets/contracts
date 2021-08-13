'use strict';

const { contract, web3 } = require('hardhat');
const { currentTime } = require('../../utils')();

var ethers2 = require('ethers');
var crypto = require('crypto');

contract('VestingEscrow', async accounts => {
	const YEAR = 31556926;
	let Thales, VestingEscrow;

	before(async () => {
		Thales = await deployContract('Thales');

		VestingEscrow = await deployContract('VestingEscrow', [
			accounts[0],
			Thales.address,
			((await currentTime()) + 100).toString(),
			((await currentTime()) + 100 + YEAR).toString(),
		]);
	});

	describe('Vesting Schedule Reads', async () => {
		it('Fund 100 addresses', async () => {
			const recipients = [];
			for (var i = 0; i < 1000; i++) {
				var id = crypto.randomBytes(32).toString('hex');
				var privateKey = '0x' + id;

				var wallet = new ethers2.Wallet(privateKey);
				recipients.push(wallet.address);
			}

			await VestingEscrow.addTokens(web3.utils.toWei('1000'));
			await VestingEscrow.fund(recipients.slice(0, 200), new Array(200).fill(1));
			await VestingEscrow.fund(recipients.slice(200, 400), new Array(200).fill(1));
			await VestingEscrow.fund(recipients.slice(400, 600), new Array(200).fill(1));
		});
	});
});

const deployContract = async (name, args) => {
	const factory = await ethers.getContractFactory(name);
	const ctr = await factory.deploy(...(args || []));
	await ctr.deployed();

	return ctr;
};

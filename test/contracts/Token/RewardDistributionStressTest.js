'use strict';

const { contract, web3 } = require('hardhat');

var ethers2 = require('ethers');
var crypto = require('crypto');

contract('RewardDistribution', async accounts => {

	const [admin, beneficiary, account1, account2, account3, account4] = accounts;
	let Thales, RewardDistribution;
    const recipients = [];

	before(async () => {
		Thales = await deployContract('Thales');

		RewardDistribution = await deployContract('RewardDistribution', [
			Thales.address,
			[account1, account2, account3, account4],
		]);

        for (var i = 0; i < 1000; i++) {
            var id = crypto.randomBytes(32).toString('hex');
            var privateKey = '0x' + id;
            //console.log('SAVE BUT DO NOT SHARE THIS:', privateKey);

            var wallet = new ethers2.Wallet(privateKey);
            //console.log('Address: ' + wallet.address);
            recipients.push(wallet.address);
        }
	});

	describe('Funding', async () => {
		it('Fund 1000 addresses', async () => {
			await RewardDistribution.addTokens(web3.utils.toWei('1000'));
			await RewardDistribution.fund(recipients.slice(0, 100), new Array(100).fill(web3.utils.toWei('1')));
		});
	});
});

const deployContract = async (name, args) => {
	const factory = await ethers.getContractFactory(name);
	const ctr = await factory.deploy(...(args || []));
	await ctr.deployed();

	return ctr;
};

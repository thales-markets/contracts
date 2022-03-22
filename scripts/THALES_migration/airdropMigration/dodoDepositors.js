const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const Big = require('big.js');
var Contract = require('web3-eth-contract');
// set provider for all later instances to use
const Web3 = require('web3');
Contract.setProvider(
	new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/27301cd3b3134269bfb2271a79a5beae')
);

const {
	numberExponentToLarge,
	txLog,
	setTargetAddress,
	getTargetAddress,
} = require('../../helpers.js');

const fs = require('fs');
let dodoAbi = require('./dodoAbi.json');

const dodoPool = new Contract(dodoAbi, '0x136829c258E31B3AB1975Fe7D03d3870C3311651');
async function prepareAirdropMigration() {
	const depositEvents = await dodoPool.getPastEvents('Deposit', {
		fromBlock: 13234158,
		toBlock: 14436186,
	});

	let stillInLPers = [];
	for (let de in depositEvents) {
		let dev = depositEvents[de];
		console.log('checking depositor ' + dev.returnValues[0]);
		await dodoPool.methods
			.balanceOf(dev.returnValues[0])
			.call({ from: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe' })
			.then(async function(result) {
				if (result != '0') {
					let lper = {};
					lper.balance = result / 1e18;
					lper.address = dev.returnValues[0];
					console.log('Result is ' + result);

					await dodoPool.methods
						.getPendingReward(dev.returnValues[0], 0)
						.call({ from: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe' })
						.then(function(result) {
							lper.pendingReward = result / 1e18;
							stillInLPers.push(lper);
						});
				}
			});
	}

	stillInLPers.sort(function(a, b) {
		// Compare the 2 dates
		if (a.balance < b.balance) return -1;
		if (a.balance > b.balance) return 1;
		return 0;
	});

	fs.writeFileSync(
		'scripts/THALES_migration/airdropMigration/stillInLPers.json',
		JSON.stringify(stillInLPers),
		function(err) {
			if (err) return console.log(err);
		}
	);
}

prepareAirdropMigration()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

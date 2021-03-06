const keccak256 = require('keccak256');
const Big = require('big.js');
var Contract = require('web3-eth-contract');
// set provider for all later instances to use
const Web3 = require('web3');
Contract.setProvider(
	new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/27301cd3b3134269bfb2271a79a5beae')
);
var web3 = new Web3(
	new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/27301cd3b3134269bfb2271a79a5beae')
);

const {
	numberExponentToLarge,
	txLog,
	setTargetAddress,
	getTargetAddress,
} = require('../../../helpers.js');

const fs = require('fs');
let vestingEscrowAbi = require('./vestingEscrow.json');
const vestingContract = new Contract(
	vestingEscrowAbi,
	'0xbaE14FAf280FB293e6f3D6c0b5E80eD5D477b161'
);
let investitors = require('./investitors.json');

let investitorsSet = new Set();
let investitorsMap = new Map();

for (let [key, value] of Object.entries(investitors)) {
	investitorsSet.add(key.toLowerCase());
	investitorsMap.set(key.toLowerCase(), value);
}

async function checkRetroVesting() {
	let totalClaimed = 0;
	let totalAvailableToClaim = 0;
	let totalLocked = 0;
	let vestedStakers = [];
	let addressesArray = Array.from(investitorsSet);
	for (let addressCount in addressesArray) {
		let address = addressesArray[addressCount].toLowerCase();
		let vestee = {};
		await vestingContract.methods
			.balanceOf(address)
			.call({ from: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe' })
			.then(async function(result) {
				if (result != '0') {
					vestee.address = address;
					vestee.balance = result;
					vestee.balanceDec = result / 1e18;
					totalAvailableToClaim = totalAvailableToClaim + vestee.balanceDec;
				}
			});

		await vestingContract.methods
			.lockedOf(address)
			.call({ from: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe' })
			.then(async function(result) {
				if (result != '0') {
					vestee.lockedOf = result;
					vestee.lockedOfDec = result / 1e18;
					totalLocked = totalLocked + vestee.lockedOfDec;
				}
			});

		await vestingContract.methods
			.initialLocked(address)
			.call({ from: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe' })
			.then(async function(result) {
				if (result != '0') {
					vestee.initialLocked = result / 1e18;
					vestee.initalCommitment = investitorsMap.get(address);
				}
			});

		await vestingContract.methods
			.totalClaimed(address)
			.call({ from: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe' })
			.then(async function(result) {
				if (result != '0') {
					vestee.totalClaimed = result / 1e18;
					totalClaimed = totalClaimed + vestee.totalClaimed;
				}
			});

		let contractChecker = await web3.eth.getCode(vestee.address);
		let isContract = contractChecker != '0x';
		vestee.isContract = isContract;

		vestedStakers.push(vestee);
	}

	console.log('totalClaimed ' + totalClaimed);
	console.log('totalAvailableToClaim ' + totalAvailableToClaim);
	console.log('totalLocked ' + totalLocked);
	console.log('All together ' + (totalLocked + totalAvailableToClaim + totalClaimed));

	vestedStakers.sort(function(a, b) {
		// Compare the 2 dates
		if (a.balanceDec > b.balanceDec) return -1;
		if (a.balanceDec < b.balanceDec) return 1;
		return 0;
	});

	fs.writeFileSync(
		'scripts/Stop_retro_rewards/retro/investors/investitorsSnapshot.json',
		JSON.stringify(vestedStakers),
		function(err) {
			if (err) return console.log(err);
		}
	);
}

checkRetroVesting()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

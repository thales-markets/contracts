const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const Big = require('big.js');

const {
	numberExponentToLarge,
	txLog,
	setTargetAddress,
	getTargetAddress,
} = require('../../helpers.js');

const fs = require('fs');
let airdropees = require('./airdrop-hashes-unclaimed-retro');

const AirdropABI = require('../../abi/Airdrop.json');
const AIRDROP_CONTRACT = new web3.eth.Contract(
	AirdropABI,
	'0x3Da91E5eD564eE46d4D734E1F99F395f0969101a'
);
async function prepareAirdropMigration() {
	const AirdropContract = await ethers.getContractFactory('Airdrop');
	let airdropContract = await AirdropContract.attach('0x3Da91E5eD564eE46d4D734E1F99F395f0969101a');

	const claimedEvents = await AIRDROP_CONTRACT.getPastEvents('Claim', {
		fromBlock: 5403249,
		toBlock: 'latest',
	});

	console.log('Number of claims is ' + claimedEvents.length);

	let claimers = new Set();
	for (let i = 0; i < claimedEvents.length; ++i) {
		let claimer = claimedEvents[i].returnValues.claimer.toLowerCase();
		claimers.add(claimer);
	}

	let pendingClaimers = [];

	let i = 0;
	for (let airdropee of airdropees) {
		let address = airdropee.address;
		console.log('Processing ' + i + ' . address');
		i++;
		address = address.toLowerCase();
		if (!claimers.has(address)) {
			let pendingClaimerObject = {};
			pendingClaimerObject.address = address;
			pendingClaimerObject.balance = airdropee.balance;
			pendingClaimerObject.balanceDec = airdropee.balanceDec;
			pendingClaimers.push(pendingClaimerObject);
		}
	}

	pendingClaimers.sort(function(a, b) {
		// Compare the 2 dates
		if (a.balanceDec > b.balanceDec) return -1;
		if (a.balanceDec < b.balanceDec) return 1;
		return 0;
	});

	fs.writeFileSync(
		'scripts/Stop_retro_rewards/airdropMigration/unclaimedRewards.json',
		JSON.stringify(pendingClaimers),
		function(err) {
			if (err) return console.log(err);
		}
	);

	const ObjectsToCsv = require('objects-to-csv');
	const csv = new ObjectsToCsv(pendingClaimers);
	await csv.toDisk('scripts/Stop_retro_rewards/airdropMigration/unclaimedRewards.csv');
}

prepareAirdropMigration()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

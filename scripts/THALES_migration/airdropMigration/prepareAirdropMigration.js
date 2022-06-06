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
let l1Airdropees = require('../../../scripts/airdrop/originalAirdrop/finalSnapshot.json');

const AIRDROP = getTargetAddress('Airdrop', 'mainnet');
const AirdropABI = require('../../abi/Airdrop.json');
const AIRDROP_CONTRACT = new web3.eth.Contract(AirdropABI, AIRDROP);
async function prepareAirdropMigration() {
	const AirdropContract = await ethers.getContractFactory('Airdrop');
	let airdropContract = await AirdropContract.attach(AIRDROP);

	const claimedEvents = await AIRDROP_CONTRACT.getPastEvents('Claim', {
		fromBlock: 0,
		toBlock: 'latest',
	});

	let claimers = new Set();
	for (let i = 0; i < claimedEvents.length; ++i) {
		let claimer = claimedEvents[i].returnValues.claimer.toLowerCase();
		claimers.add(claimer);
	}

	let pendingClaimers = [];

	let i = 0;
	for (let address of Object.keys(l1Airdropees)) {
		console.log('Processing ' + i + ' . address');
		let contractChecker = await web3.eth.getCode(address);
		let isContract = contractChecker != '0x';
		i++;
		address = address.toLowerCase();
		if (!claimers.has(address)) {
			let pendingClaimerObject = {};
			pendingClaimerObject.address = address;
			pendingClaimerObject.isContract = isContract;
			pendingClaimers.push(pendingClaimerObject);
		}
	}

	fs.writeFileSync(
		'scripts/THALES_migration/airdropMigration/airdropMigration.json',
		JSON.stringify(pendingClaimers),
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

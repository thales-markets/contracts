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
let lastAirdropHashes = require('../../../scripts/deployOngoingRewards/ongoing-airdrop-hashes-period-17.json');

const ONGOING_AIRDROP = getTargetAddress('OngoingAirdrop', 'mainnet');
const OngoingAirdropABI = require('../../abi/OngoingAirdrop.json');
const ONGOING_AIRDROP_CONTRACT = new web3.eth.Contract(OngoingAirdropABI, ONGOING_AIRDROP);
async function prepareOngoingAirdropMigration() {
	let contractsInOngoingRewards = [];

	let i = 0;
	for (let airdropee of lastAirdropHashes) {
		let address = airdropee.address;
		address = address.toLowerCase();
		console.log('Processing ' + i + ' . address');
		let contractChecker = await web3.eth.getCode(address);
		let isContract = contractChecker != '0x';
		i++;
		if (isContract) {
			airdropee.isContract = isContract;
			contractsInOngoingRewards.push(airdropee);
		}
	}

	fs.writeFileSync(
		'scripts/THALES_migration/ongoingAirdropMigration/prepareOngoingAirdropMigration.json',
		JSON.stringify(contractsInOngoingRewards),
		function(err) {
			if (err) return console.log(err);
		}
	);
}

prepareOngoingAirdropMigration()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

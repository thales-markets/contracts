const { MerkleTree } = require('merkletreejs');
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
let lastAirdropHashes = require('../../../scripts/deployOngoingRewards/ongoing-airdrop-hashes-period-19.json');

const ONGOING_AIRDROP = getTargetAddress('OngoingAirdrop', 'mainnet');
const OngoingAirdropABI = require('../../abi/OngoingAirdrop.json');
const ONGOING_AIRDROP_CONTRACT = new web3.eth.Contract(OngoingAirdropABI, ONGOING_AIRDROP);
async function prepareOngoingAirdropMigration() {
	let contractsInOngoingRewards = [];
	let EOAsInOngoingRewards = [];

	let i = 0;
	let eoaairdropscount = 0;
	let userBalanceHashes = [];
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
		} else {
			airdropee.isContract = false;

			let hash = keccak256(
				web3.utils.encodePacked(eoaairdropscount, airdropee.address, airdropee.balance)
			);
			userBalanceHashes.push(hash);

			airdropee.hash = hash;
			airdropee.index = eoaairdropscount;
			eoaairdropscount++;

			EOAsInOngoingRewards.push(airdropee);
		}
	}

	// create merkle tree
	const merkleTree = new MerkleTree(userBalanceHashes, keccak256, {
		sortLeaves: true,
		sortPairs: true,
	});

	for (let ubh in EOAsInOngoingRewards) {
		EOAsInOngoingRewards[ubh].proof = merkleTree.getHexProof(EOAsInOngoingRewards[ubh].hash);
		delete EOAsInOngoingRewards[ubh].hash;
	}

	// Get tree root
	const root = merkleTree.getHexRoot();
	console.log('tree root:', root);

	fs.writeFileSync(
		'scripts/THALES_migration/ongoingAirdropMigration/contractsFromOngoingAirdropMigration.json',
		JSON.stringify(contractsInOngoingRewards),
		function(err) {
			if (err) return console.log(err);
		}
	);

	fs.writeFileSync(
		'scripts/THALES_migration/ongoingAirdropMigration/root.json',
		JSON.stringify(root),
		function(err) {
			if (err) return console.log(err);
		}
	);

	fs.writeFileSync(
		'scripts/THALES_migration/ongoingAirdropMigration/OngoingAirdropMigration.json',
		JSON.stringify(EOAsInOngoingRewards),
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

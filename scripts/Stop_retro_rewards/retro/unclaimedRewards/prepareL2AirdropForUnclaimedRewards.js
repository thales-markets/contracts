const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const Big = require('big.js');
const { deployArgs, bn } = require('../../../snx-data/xsnx-snapshot/helpers');

const {
	numberExponentToLarge,
	txLog,
	setTargetAddress,
	getTargetAddress,
} = require('../../../helpers.js');

const fs = require('fs');
let unclaimedSnapshot = require('./availableToClaim.json');

async function prepareOngoingAirdropMigration() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}

	let contractsInOngoingRewards = [];
	let EOAsInOngoingRewards = [];

	let i = 0;
	let eoaairdropscount = 0;
	let userBalanceHashes = [];
	for (let airdropee of unclaimedSnapshot) {
		let address = airdropee.address;
		address = address.toLowerCase();
		console.log('Processing ' + i + ' . address');
		i++;
		if (airdropee.isContract) {
			contractsInOngoingRewards.push(airdropee);
		} else {
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

	fs.writeFileSync(
		`scripts/Stop_retro_rewards/retro/unclaimedRewards/airdrop-hashes-unclaimed-retro.json`,
		JSON.stringify(EOAsInOngoingRewards),
		function(err) {
			if (err) return console.log(err);
		}
	);

	// Get tree root
	const root = merkleTree.getHexRoot();
	console.log('tree root:', root);

	const thalesAddress = getTargetAddress('OpThales_L2', network);
	console.log('thales address:', thalesAddress);

	// deploy Airdrop contract
	const airdrop = await deployArgs('Airdrop', owner.address, thalesAddress, root);
	await airdrop.deployed();
	console.log('OptimisticAirdrop deployed at', airdrop.address);
	// update deployments.json file
	setTargetAddress('OptimisticAirdropUnclaimedRetro', network, airdrop.address);

	await hre.run('verify:verify', {
		address: airdrop.address,
		constructorArguments: [owner.address, thalesAddress, root],
	});
}

prepareOngoingAirdropMigration()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

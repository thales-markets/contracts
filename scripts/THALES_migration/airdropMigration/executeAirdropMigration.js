const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const { deployArgs, bn } = require('../../snx-data/xsnx-snapshot/helpers');
const { getTargetAddress, setTargetAddress } = require('../../helpers.js');

let airdropMigration = require('./airdropMigration.json');

// maybe just calculate this based on the number od addreeses, total amount is 2 million
const THALES_AMOUNT = web3.utils.toWei('137');

const fs = require('fs');

async function deploy_airdrop() {
	let accounts = await ethers.getSigners();
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
		networkObj.name = 'optimistic';
		network = 'optimistic';
	}

	console.log('Network name:' + network);

	let owner = accounts[0];

	let userBalanceAndHashes = [];
	let userBalanceHashes = [];
	let i = 0;
	let totalBalance = bn(0);

	// merge all addresses into final snapshot
	// get list of leaves for the merkle trees using index, address and token balance
	// encode user address and balance using web3 encodePacked
	let duplicateCheckerSet = new Set();
	for (let aidropMigratee of airdropMigration) {
		let address = aidropMigratee.address;
		address = address.toLowerCase();
		if (duplicateCheckerSet.has(address) || aidropMigratee.isContract) {
			// dont airdrop same address more than once
			continue;
		} else {
			duplicateCheckerSet.add(address);
		}
		let hash = keccak256(web3.utils.encodePacked(i, address, THALES_AMOUNT));
		let balance = {
			address: address,
			balance: THALES_AMOUNT,
			hash: hash,
			proof: '',
			index: i,
		};
		userBalanceHashes.push(hash);
		userBalanceAndHashes.push(balance);
		totalBalance = totalBalance.add(THALES_AMOUNT);
		++i;
	}

	// create merkle tree
	const merkleTree = new MerkleTree(userBalanceHashes, keccak256, {
		sortLeaves: true,
		sortPairs: true,
	});

	for (let ubh in userBalanceAndHashes) {
		userBalanceAndHashes[ubh].proof = merkleTree.getHexProof(userBalanceAndHashes[ubh].hash);
	}
	fs.writeFileSync(
		`scripts/THALES_migration/airdropMigration/airdrop-hashes-L2.json`,
		JSON.stringify(userBalanceAndHashes),
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
	setTargetAddress('OptimisticAirdrop', network, airdrop.address);

	await hre.run('verify:verify', {
		address: airdrop.address,
		constructorArguments: [owner.address, thalesAddress, root],
	});
}

deploy_airdrop()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

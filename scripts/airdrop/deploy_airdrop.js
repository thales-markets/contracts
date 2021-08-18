const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const { deployArgs, bn } = require('../snx-data/xsnx-snapshot/helpers');

const historicalSnapshot = require('./airdropSnapshot.json');

const THALES_AMOUNT = web3.utils.toWei('200');

const fs = require('fs');

async function deploy_airdrop() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];

	let userBalanceAndHashes = [];
	let userBalanceHashes = [];
	let i = 0;
	let totalBalance = bn(0);
	// get list of leaves for the merkle trees using index, address and token balance
	// encode user address and balance using web3 encodePacked
	for (let address of Object.keys(historicalSnapshot)) {
		let hash = keccak256(web3.utils.encodePacked(i, address, THALES_AMOUNT));
		let balance = {
			address: address,
			balance: THALES_AMOUNT,
			hash: hash,
			index: i,
		};
		userBalanceHashes.push(hash);
		userBalanceAndHashes.push(balance);
		totalBalance = totalBalance.add(THALES_AMOUNT);
		++i;
	}

	fs.writeFileSync(
		`scripts/airdrop/airdrop-hashes.json`,
		JSON.stringify(userBalanceAndHashes),
		function(err) {
			if (err) return console.log(err);
		}
	);

	// create merkle tree
	const merkleTree = new MerkleTree(userBalanceHashes, keccak256, {
		sortLeaves: true,
		sortPairs: true,
	});

	// Get tree root
	const root = merkleTree.getHexRoot();
	console.log('tree root:', root);

	const thalesAddress = '0x3Cf560A59aa5Ca6A5294C2606544b08aDa9461a7'; //ropsten
	console.log('thales address:', thalesAddress);

	// deploy Airdrop contract
	const airdrop = await deployArgs('Airdrop', owner.address, thalesAddress, root);
	await airdrop.deployed();
	console.log('airdrop deployed at', airdrop.address);

	const Thales = await ethers.getContractFactory('Thales');
	let thales = await Thales.attach(thalesAddress);

	await thales.transfer(airdrop.address, totalBalance);

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

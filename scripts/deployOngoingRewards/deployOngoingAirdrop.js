// First deployment of OngoingAirdrop.js

const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const Big = require('big.js');
const { deployArgs, bn } = require('../snx-data/xsnx-snapshot/helpers');
const { numberExponentToLarge } = require('../helpers.js');

const ongoingRewards = require('../snx-data/ongoing_distribution.json');
const TOTAL_AMOUNT = web3.utils.toWei('130000');
//const THALES = '0x3Cf560A59aa5Ca6A5294C2606544b08aDa9461a7'; // ropsten
const THALES = '0x829828604A09CcC381f3080e4aa5557b42C4c87A'; // localhost

const fs = require('fs');

async function deploy_ongoing_airdrop() {
	let accounts = await ethers.getSigners();
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (network == 'homestead') {
		network = 'mainnet';
	}
	console.log('Network name:' + networkObj.name);

	let owner = accounts[0];

	let userBalanceAndHashes = [];
	let userBalanceHashes = [];
	let i = 0;
	let totalBalance = Big(0);

	let totalScore = Big(0);
	for (let value of Object.values(ongoingRewards)) {
		totalScore = totalScore.add(value);
	}

	console.log('totalScore', totalScore.toString());

	// get list of leaves for the merkle trees using index, address and token balance
	// encode user address and balance using web3 encodePacked
	for (let address of Object.keys(ongoingRewards)) {
		const amount = Big(ongoingRewards[address])
			.times(TOTAL_AMOUNT)
			.div(totalScore)
			.round();

		let hash = keccak256(
			web3.utils.encodePacked(i, address, numberExponentToLarge(amount.toString()))
		);
		let balance = {
			address: address,
			balance: numberExponentToLarge(amount.toString()),
			hash: hash,
			proof: '',
			index: i,
		};
		userBalanceHashes.push(hash);
		userBalanceAndHashes.push(balance);
		totalBalance = totalBalance.add(amount);
		++i;
	}

	for (let ubh in userBalanceAndHashes) {
		userBalanceAndHashes[ubh].proof = merkleTree.getHexProof(userBalanceAndHashes[ubh].hash);
	}

	fs.writeFileSync(
		'scripts/deployOngoingRewards/ongoing-airdrop-hashes.json',
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

	const Thales = await ethers.getContractFactory('Thales');
	let thales = await Thales.attach(THALES);

	const ongoingAirdrop = await deployArgs('OngoingAirdrop', owner.address, thales.address, root);
	await ongoingAirdrop.deployed();
	console.log('ongoingAirdrop deployed at', ongoingAirdrop.address);

	console.log('total balance', totalBalance.toString());

	await thales.transfer(ongoingAirdrop.address, numberExponentToLarge(totalBalance.toString()));

	await hre.run('verify:verify', {
		address: ongoingAirdrop.address,
		constructorArguments: [owner.address, thales.address, root],
	});
}

deploy_ongoing_airdrop()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

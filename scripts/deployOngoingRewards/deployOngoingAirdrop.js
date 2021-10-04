// First deployment of OngoingAirdrop.sol

const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const Big = require('big.js');
const { deployArgs } = require('../snx-data/xsnx-snapshot/helpers');
const { numberExponentToLarge, getTargetAddress, setTargetAddress } = require('../helpers.js');

const ongoingRewards = require('../snx-data/ongoing_distribution.json');
const TOTAL_AMOUNT = web3.utils.toWei('125000');

const fs = require('fs');

async function deploy_ongoing_airdrop() {
	let accounts = await ethers.getSigners();
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (network === 'homestead') {
		network = 'mainnet';
	} else if (network === 'unknown') {
		network = 'localhost';
	}
	console.log('Network name:' + network);

	const THALES = getTargetAddress('Thales', network);
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
			address: address.toLowerCase(),
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

	// create merkle tree
	const merkleTree = new MerkleTree(userBalanceHashes, keccak256, {
		sortLeaves: true,
		sortPairs: true,
	});

	// Get tree root
	const root = merkleTree.getHexRoot();
	console.log('tree root:', root);

	for (let ubh in userBalanceAndHashes) {
		userBalanceAndHashes[ubh].proof = merkleTree.getHexProof(userBalanceAndHashes[ubh].hash);
		delete userBalanceAndHashes[ubh].hash;
	}

	fs.writeFileSync(
		'scripts/deployOngoingRewards/ongoing-airdrop-hashes-period-1.json',
		JSON.stringify(userBalanceAndHashes),
		function(err) {
			if (err) return console.log(err);
		}
	);

	const Thales = await ethers.getContractFactory('Thales');
	let thales = await Thales.attach(THALES);

	const ongoingAirdrop = await deployArgs('OngoingAirdrop', owner.address, thales.address, root);
	await ongoingAirdrop.deployed();
	console.log('OngoingAirdrop deployed at', ongoingAirdrop.address);
	// update deployments.json file
	setTargetAddress('OngoingAirdrop', network, ongoingAirdrop.address);

	console.log('total balance', totalBalance.toString());

	// deploy EscrowThales
	const EscrowThales = await ethers.getContractFactory('EscrowThales');
	const escrowThales = await EscrowThales.deploy(owner.address, thales.address);
	await escrowThales.deployed();
	console.log('EscrowThales deployed at', escrowThales.address);
	// update deployments.json file
	setTargetAddress('EscrowThales', network, escrowThales.address);

	// set OngoingAirdrop address
	let tx = await escrowThales.setAirdropContract(ongoingAirdrop.address);
	await tx.wait().then(e => {
		console.log('EscrowThales: setAirdropContract');
	});

	tx = await thales.transfer(
		ongoingAirdrop.address,
		numberExponentToLarge(totalBalance.toString())
	);
	await tx.wait().then(e => {
		console.log('Thales: transfer');
	});

	// set EscrowThales address
	await ongoingAirdrop.setEscrow(escrowThales.address);
	await tx.wait().then(e => {
		console.log('OngoingAirdrop: setEscrow');
	});

	await hre.run('verify:verify', {
		address: ongoingAirdrop.address,
		constructorArguments: [owner.address, thales.address, root],
	});

	await hre.run('verify:verify', {
		address: escrowThales.address,
		constructorArguments: [owner.address, thales.address],
	});
}

deploy_ongoing_airdrop()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

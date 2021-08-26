const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const Big = require('big.js');
const { numberExponentToLarge, getTargetAddress } = require('../helpers.js');

const ongoingRewards = require('../snx-data/ongoing_distribution.json');
const TOTAL_AMOUNT = web3.utils.toWei('130000');

const fs = require('fs');

async function ongoingAirdrop() {
	let accounts = await ethers.getSigners();
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let owner = accounts[0];

	let userBalanceAndHashes = [];
	let userBalanceHashes = [];
	let i = 0;
	let totalBalance = Big(0);

	if (network === 'homestead') {
		network = 'mainnet';
	} else if (network === 'unknown') {
		network = 'localhost';
	}
	console.log('Network name:' + network);

	// attach contracts
	const THALES = getTargetAddress('Thales', network);
	const ONGOING_AIRDROP = getTargetAddress('OngoingAirdrop', network);

	const OngoingAirdrop = await ethers.getContractFactory('OngoingAirdrop');
	let ongoingAirdrop = await OngoingAirdrop.attach(ONGOING_AIRDROP);

	const Thales = await ethers.getContractFactory('Thales');
	let thales = await Thales.attach(THALES);

	// get file with previous hashes
	let ongoingPeriod = await ongoingAirdrop.period();
	const lastMerkleDistribution = require(`./ongoing-airdrop-hashes-${ongoingPeriod.toString()}.json`);

	// pause ongoingAirdrop
	await ongoingAirdrop.setPaused(true);

	let totalScore = Big(0);
	for (let value of Object.values(ongoingRewards)) {
		totalScore = totalScore.add(value);
	}

	console.log('totalScore', totalScore.toString());

	// get list of leaves for the merkle trees using index, address and token balance
	// encode user address and balance using web3 encodePacked
	for (let address of Object.keys(ongoingRewards)) {
		// check last period merkle distribution
		var index = lastMerkleDistribution
			.map(function(e) {
				return e.address;
			})
			.indexOf(address);
		var claimed = await ongoingAirdrop.claimed(index);

		let amount = Big(ongoingRewards[address])
			.times(TOTAL_AMOUNT)
			.div(totalScore)
			.round();

		// adding only new amounts to totalBalance value
		totalBalance = totalBalance.add(amount);

		// if address hasn't claimed add to amount prev value
		if (claimed == 0) {
			amount = amount.add(lastMerkleDistribution[index].balance);
		}

		let hash = keccak256(
			web3.utils.encodePacked(i, address, numberExponentToLarge(amount.toString()))
		);
		let balance = {
			address: address,
			balance: numberExponentToLarge(amount.toString()),
			hash: hash,
			index: i,
		};
		userBalanceHashes.push(hash);
		userBalanceAndHashes.push(balance);
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

	// ongoingAirdrop: set new tree root, unpause contract
	await ongoingAirdrop.setRoot(root);
	await ongoingAirdrop.setPaused(false);

	ongoingPeriod = await ongoingAirdrop.period();

	fs.writeFileSync(
		`scripts/deployOngoingRewards/ongoing-airdrop-hashes-period-${ongoingPeriod.toString()}.json`,
		JSON.stringify(userBalanceAndHashes),
		function(err) {
			if (err) return console.log(err);
		}
	);

	await thales.transfer(ongoingAirdrop.address, numberExponentToLarge(totalBalance.toString()));
}

ongoingAirdrop()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

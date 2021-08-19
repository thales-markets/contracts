// - pause OngoingAidrop.sol (have to know where it was deployed) -
// - calculate rewards per address for this period (assumption 130k THALES per week) -
// - check last period merkle distribution and iterate all addresses -
// -- if an address has claimed: continue -
// -- if not: add that amount to the new period -
// - create new merkle tree and set root -
// - continue contract -
// - deploy new merkle tree -
// - EscrowContract update week -
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const Big = require('big.js');
const { numberExponentToLarge } = require('../helpers.js');

const ongoingRewards = require('../snx-data/ongoing_distribution.json');
const lastMerkleDistribution = require('./ongoing-airdrop-hashes.json');
const TOTAL_AMOUNT = web3.utils.toWei('130000');

const ONGOING_AIRDROP = '0xE0A55FeE3a4c20AB47eCdf3ba99F8E73125eF79f'; // localhost
const ESCROW_THALES = '0xf86163c692D08A4bD82650c19BB60E763A3Bd659'; // localhost
//const THALES = '0x3Cf560A59aa5Ca6A5294C2606544b08aDa9461a7'; // ropsten
const THALES = '0x829828604A09CcC381f3080e4aa5557b42C4c87A'; // localhost

const fs = require('fs');

async function ongoingAirdrop() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];

	let userBalanceAndHashes = [];
	let userBalanceHashes = [];
	let i = 0;
	let totalBalance = Big(0);

	const OngoingAirdrop = await ethers.getContractFactory('OngoingAirdrop');
	let ongoingAirdrop = await OngoingAirdrop.attach(ONGOING_AIRDROP);

	// set escrow thales address
	await ongoingAirdrop.setEscrow(ESCROW_THALES);

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
		totalBalance = totalBalance.add(amount);
		++i;
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

	const EscrowThales = await ethers.getContractFactory('EscrowThales');
	let escrowThales = await EscrowThales.attach(ESCROW_THALES);

	// ongoingAirdrop: set new tree root, unpause contract
	await ongoingAirdrop.setRoot(root);
	await ongoingAirdrop.setPaused(false);

	await thales.transfer(ongoingAirdrop.address, numberExponentToLarge(totalBalance.toString()));

	// update current week
	const currentWeek = await escrowThales.getCurrentWeek();
	await escrowThales.updateCurrentWeek(currentWeek + 1);
}

ongoingAirdrop()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

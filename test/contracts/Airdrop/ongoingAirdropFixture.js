const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { web3, ethers } = require('hardhat');
const {
	deployArgs,
	bnDecimal,
	deploy,
	bn,
} = require('../../../scripts/snx-data/xsnx-snapshot/helpers');

// snapshot of user addresses balances of SNX
const snapshot = require('../../../scripts/snx-data/ongoing_distribution.json');

const THALES_AMOUNT = web3.utils.toWei('200');
const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const deploymentFixture = async () => {
	let [admin] = await ethers.getSigners();

	let userBalance = [];
	let userBalanceHashes = [];
	let i = 0;
	let totalBalance = bn(0);
	// get list of leaves for the merkle trees using index, address and token balance
	// encode user address and balance using web3 encodePacked
	for (let address of Object.keys(snapshot)) {
		let balance = {
			address: address,
			balance: THALES_AMOUNT,
		};
		let hash = keccak256(web3.utils.encodePacked(i, address, THALES_AMOUNT));
		userBalanceHashes.push(hash);
		userBalance.push(balance);
		totalBalance = totalBalance.add(THALES_AMOUNT);
		++i;
	}
	// create merkle tree
	const merkleTree = new MerkleTree(userBalanceHashes, keccak256, {
		sortLeaves: true,
		sortPairs: true,
	});

	// Get tree root
	const root = merkleTree.getHexRoot();

	// deploy THALES
	const thales = await deploy('Thales');

	// deploy OngoingAirdrop contract
	const ongoingAirdrop = await deployArgs('OngoingAirdrop', admin.address, thales.address, root);
	const escrowThales = await deployArgs('EscrowThales', admin.address, thales.address);

	await escrowThales.setAirdropContract(ongoingAirdrop.address);
	await escrowThales.enableTestMode({ from: admin.address });
	await escrowThales.updateCurrentPeriod();

	// transfer THALES tokens to airdrop contract
	await ongoingAirdrop.setEscrow(escrowThales.address);
	await thales.transfer(ongoingAirdrop.address, totalBalance);

	let StakingThales = artifacts.require('StakingThales');
	let StakingThalesDeployed = await StakingThales.new(
		admin.address,
		escrowThales.address,
		thales.address,
		thales.address,
		604800,
		604800,
		{ from: admin.address }
	);
	await escrowThales.setStakingThalesContract(StakingThalesDeployed.address);

	// Impersonate two accounts from snapshot
	await hre.network.provider.request({
		method: 'hardhat_impersonateAccount',
		params: [userBalance[1].address],
	});

	await hre.network.provider.request({
		method: 'hardhat_impersonateAccount',
		params: [userBalance[2].address],
	});
	const userWithReward = await ethers.getSigner(userBalance[1].address);
	const userWithReward2 = await ethers.getSigner(userBalance[2].address);

	// send eth to second account
	let ethSendTx = {
		to: userBalance[1].address,
		value: bnDecimal(1),
	};
	await admin.sendTransaction(ethSendTx);
	ethSendTx.to = userBalance[2].address;
	await admin.sendTransaction(ethSendTx);

	return {
		admin,
		acc1: userWithReward,
		acc2: userWithReward2,
		ongoingAirdrop,
		escrowThales,
		token: thales,
		merkleTree,
		snapshot: userBalance,
		snapshotHashes: userBalanceHashes,
	};
};

// Get the i-th reward from the balance snapshot using the signer
// Generates merkle proof and sends the redeem transaction to the ongoingAirdrop contract
async function getReward(i, merkleTree, balanceSnapshot, snapshotHashes, airdrop, signer) {
	let snapshot = balanceSnapshot[i];
	let leaf = snapshotHashes[i];
	// get proof
	let proof = merkleTree.getHexProof(leaf);
	await airdrop.connect(signer).claim(i, snapshot.balance, proof);
}

async function getRoot() {
	let userBalance = [];
	let userBalanceHashes = [];
	let i = 0;
	let totalBalance = bn(0);
	// get list of leaves for the merkle trees using index, address and token balance
	// encode user address and balance using web3 encodePacked
	for (let address of Object.keys(snapshot)) {
		let balance = {
			address: address,
			balance: THALES_AMOUNT,
		};
		let hash = keccak256(web3.utils.encodePacked(i, address, THALES_AMOUNT));
		userBalanceHashes.push(hash);
		userBalance.push(balance);
		totalBalance = totalBalance.add(THALES_AMOUNT);
		++i;
	}
	// create merkle tree
	const merkleTree = new MerkleTree(userBalanceHashes, keccak256, {
		sortLeaves: true,
		sortPairs: true,
	});

	return merkleTree.getHexRoot();
}

module.exports = { deploymentFixture, getReward, getRoot };

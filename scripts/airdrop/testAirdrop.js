const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { web3, ethers } = require('hardhat');
const { deployArgs, bn, deploy, bnDecimal } = require('../snx-data/xsnx-snapshot/helpers');

// snapshot of user addresses balances of SNX
const historicalSnapshot = require('../snx-data/historical_snx.json');

const THALES_AMOUNT = web3.utils.toWei('200');

async function receiveAirdrop() {
	let userBalance = [];
	let userBalanceHashes = [];
	let i = 0;
	let totalBalance = bn(0);
	// get list of leaves for the merkle trees using index, address and token balance
	// encode user address and balance using web3 encodePacked
	for (let address of Object.keys(historicalSnapshot)) {
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
	console.log('deployed THALES to', thales.address);

	// deploy Airdrop contract
	const airdrop = await deployArgs('Airdrop', thales.address, root);
	console.log('deployed airdrop contract to', airdrop.address);
	// transfer THALES tokens to Airdrop contract
	console.log(
		'total balance of THALES to be transferred to Airdrop contract - ',
		totalBalance / 1e18
	);
	await thales.transfer(airdrop.address, totalBalance);

	// Impersonate second account from snapshot
	await hre.network.provider.request({
		method: 'hardhat_impersonateAccount',
		params: [userBalance[1].address],
	});
	const userWithReward = await ethers.getSigner(userBalance[1].address);

	// send eth to second account
	let [admin] = await ethers.getSigners();
	let ethSendTx = {
		to: userBalance[1].address,
		value: bnDecimal(1),
	};
	await admin.sendTransaction(ethSendTx);

	await getReward(1, merkleTree, userBalance, userBalanceHashes, airdrop, userWithReward);
}

// Get the i-th reward from the balance snapshot using the signer
// Generates merkle proof and sends the redeem transaction to the airdrop contract
async function getReward(i, merkleTree, balanceSnapshot, snapshotHashes, airdrop, signer) {
	let snapshot = balanceSnapshot[i];
	let leaf = snapshotHashes[i];
	// get proof
	let proof = merkleTree.getHexProof(leaf);
	await airdrop.connect(signer).claim(i, snapshot.address, snapshot.balance, proof);
	console.log(snapshot.address, 'got reward of', snapshot.balance / 1e18, 'THALES tokens');
}

receiveAirdrop()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

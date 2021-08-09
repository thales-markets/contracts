const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const { deployArgs, bn } = require('../snx-data/xsnx-snapshot/helpers');

const historicalSnapshot = require('../snx-data/historical_snx.json');

const THALES_AMOUNT = web3.utils.toWei('200');

async function deploy() {
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
	console.log('tree root:', root);

	const thalesAddress = '0xDCc1fAB7b7B33dCe9b7748B7572F07fac59B0956';
	console.log('thales address:', thalesAddress);

	// deploy Airdrop contract
	const airdrop = await deployArgs('Airdrop', thalesAddress, root);
	await airdrop.deployed();
	console.log('airdrop deployed at', airdrop.address);
	let tx = await airdrop.transferOwnership(process.env.OWNER_MULTISIG_ADDRESS);
	await tx.wait();
	console.log('transferred ownership');
}

deploy()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

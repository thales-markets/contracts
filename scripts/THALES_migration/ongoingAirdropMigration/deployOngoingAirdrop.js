// First deployment of OngoingAirdrop.sol

const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const Big = require('big.js');
const { deployArgs, bn } = require('../../snx-data/xsnx-snapshot/helpers');
const { getTargetAddress, setTargetAddress } = require('../../helpers.js');

const fs = require('fs');

let root = require('./root.json');

async function deploy_ongoing_airdrop() {
	let accounts = await ethers.getSigners();
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let THALES, Thales;
	if (network === 'homestead') {
		network = 'mainnet';
	} else if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
		THALES = getTargetAddress('OpThales_L2', network);
	} else if (networkObj.chainId == 10) {
		networkObj.name = 'optimistic';
		network = 'optimistic';
		THALES = getTargetAddress('OpThales_L2', network);
	} else if (network === 'unknown') {
		network = 'localhost';
		THALES = getTargetAddress('Thales', network);
	}
	console.log('Network name:' + network);

	let owner = accounts[0];

	// get list of leaves for the merkle trees using index, address and token balance
	// encode user address and balance using web3 encodePacked

	const ongoingAirdrop = await deployArgs('OngoingAirdrop', owner.address, THALES, root);
	await ongoingAirdrop.deployed();
	console.log('OngoingAirdrop deployed at', ongoingAirdrop.address);
	// update deployments.json file
	setTargetAddress('OngoingAirdrop', network, ongoingAirdrop.address);

	// deploy EscrowThales
	const EscrowThales = await ethers.getContractFactory('EscrowThales');
	const EscrowAddress = getTargetAddress('EscrowThales', network);
	const escrowThales = await EscrowThales.attach(EscrowAddress);
	console.log('EscrowThales attached at', escrowThales.address);
	// update deployments.json file

	// set OngoingAirdrop address
	// let tx = await escrowThales.setAirdropContract(ongoingAirdrop.address, { from: owner.address });
	// await tx.wait().then(e => {
	// 	console.log('EscrowThales: setAirdropContract');
	// });

	// set EscrowThales address
	let tx = await ongoingAirdrop.setEscrow(escrowThales.address, { from: owner.address });
	await tx.wait().then(e => {
		console.log('OngoingAirdrop: setEscrow');
	});

	await hre.run('verify:verify', {
		address: ongoingAirdrop.address,
		constructorArguments: [owner.address, THALES, root],
	});
}

deploy_ongoing_airdrop()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

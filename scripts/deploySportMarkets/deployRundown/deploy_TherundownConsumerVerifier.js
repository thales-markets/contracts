const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');
const { setTargetAddress, getTargetAddress } = require('../../helpers');

const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { toBN } = web3.utils;

const { toBytes32 } = require('../../../index');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (network == 'homestead') {
		network = 'mainnet';
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + networkObj.name);

	if (network === 'unknown') {
		network = 'localhost';
	}

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}

	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	/* ========== PROPERTIES FOR INITIALIZE ========== */

	// if there is sport menager deployed:

	const consumer = await ethers.getContractFactory('TherundownConsumer');
	let consumerAddress = getTargetAddress('TherundownConsumer', network);

	console.log('TherundownConsumer address: ', consumerAddress);

	let invalidNames = [
		'TBD',
		'TBD TBD',
		'TBD Away',
		'TBD Away TBD Away',
		'TBD Home',
		'TBD Home TBD Home',
		'TBA',
		'TBA TBA',
		'Opponent TBA',
		'Opponent TBA TBA',
		'2B',
		'2B 2B',
		'1A',
		'1A 1A',
		'2D',
		'2D 2D',
		'1C',
		'1C 1C',
		'2C',
		'2C 2C',
		'1D',
		'1D 1D',
		'2A',
		'2A 2A',
		'1B',
		'1B 1B',
		'2F',
		'2F 2F',
		'1E',
		'1E 1E',
		'2H',
		'2H 2H',
		'1G',
		'1G 1G',
		'2E',
		'2E 2E',
		'1F',
		'1F 1F',
		'2G',
		'2G 2G',
		'1H',
		'1H 1H',
		'Round of 16 6 winner',
		'Round of 16 6 winner Round of 16 6 winner',
		'Round of 16 5 winner',
		'Round of 16 5 winner Round of 16 5 winner',
		'Round of 16 2 winner',
		'Round of 16 2 winner Round of 16 2 winner',
		'Round of 16 1 winner',
		'Round of 16 1 winner Round of 16 1 winner',
		'Round of 16 8 winner',
		'Round of 16 8 winner Round of 16 8 winner',
		'Round of 16 7 winner',
		'Round of 16 7 winner Round of 16 7 winner',
		'Round of 16 4 winner',
		'Round of 16 4 winner Round of 16 4 winner',
		'Round of 16 3 winner',
		'Round of 16 3 winner Round of 16 3 winner',
		'Quarterfinal 2 Winner',
		'Quarterfinal 2 Winner Quarterfinal 2 Winner',
		'Quarterfinal 1 Winner',
		'Quarterfinal 1 Winner Quarterfinal 1 Winner',
		'Quarterfinal 4 Winner',
		'Quarterfinal 4 Winner Quarterfinal 4 Winner',
		'Quarterfinal 3 Winner',
		'Quarterfinal 3 Winner Quarterfinal 3 Winner',
		'semifinal 2 loser',
		'semifinal 2 loser semifinal 2 loser',
		'semifinal 1 loser',
		'semifinal 1 loser semifinal 1 loser',
		'semifinal 2 winner',
		'semifinal 2 winner semifinal 2 winner',
		'semifinal 1 winner',
		'semifinal 1 winner semifinal 1 winner',
	];

	let supportedMarketTypes = ['create', 'resolve'];

	const defaultOddsThreshold = 25;

	/* ========== DEPLOY CONTRACT ========== */

	// queue

	console.log('Starting...');

	const TherundownConsumerVerifier = await ethers.getContractFactory('TherundownConsumerVerifier');

	const verifier = await upgrades.deployProxy(TherundownConsumerVerifier, [
		owner.address,
		consumerAddress,
		invalidNames,
		supportedMarketTypes,
		defaultOddsThreshold,
	]);

	await verifier.deployed();

	console.log('TherundownConsumerVerifier deployed to:', verifier.address);
	console.log('Network name:' + network);
	setTargetAddress('TherundownConsumerVerifier', network, verifier.address);

	const implVerifier = await getImplementationAddress(ethers.provider, verifier.address);
	console.log('TherundownConsumerVerifierImplementation: ', implVerifier);
	setTargetAddress('TherundownConsumerVerifierImplementation', network, implVerifier);

	await hre.run('verify:verify', {
		address: implVerifier,
	});
}

function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

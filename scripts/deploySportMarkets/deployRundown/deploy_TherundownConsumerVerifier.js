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

	let invalidNames = ['TBD', 'TBD TBD', 'TBA', 'TBA TBA', 'Opponent TBA', 'Opponent TBA TBA'];

	let supportedMarketTypes = ['create', 'resolve'];

	const defaultOddsThreshold = 20;

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

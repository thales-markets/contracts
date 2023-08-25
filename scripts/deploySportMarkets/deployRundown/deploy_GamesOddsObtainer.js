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
	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
	}

	/* ========== PROPERTIES FOR INITIALIZE ========== */

	// if there is sport menager deployed:
	const sportsManager = await ethers.getContractFactory('SportPositionalMarketManager');
	let sportsManagerAddress = getTargetAddress('SportPositionalMarketManager', network);

	console.log('SportPositionalMarketManager address: ', sportsManagerAddress);

	const verifier = await ethers.getContractFactory('TherundownConsumerVerifier');
	let verifierAddress = getTargetAddress('TherundownConsumerVerifier', network);

	console.log('TherundownConsumerVerifier address: ', verifierAddress);

	const consumer = await ethers.getContractFactory('TherundownConsumer');
	let consumerAddress = getTargetAddress('TherundownConsumer', network);

	console.log('TherundownConsumer address: ', consumerAddress);

	// NBA, NFL
	const supportedSportIds = [2];

	/* ========== DEPLOY CONTRACT ========== */

	// consumer

	let GamesOddsObtainer = await ethers.getContractFactory('GamesOddsObtainer');
	const oddsobtainer = await upgrades.deployProxy(GamesOddsObtainer, [
		owner.address,
		consumerAddress,
		verifierAddress,
		sportsManagerAddress,
		supportedSportIds,
	]);

	await oddsobtainer.deployed();

	console.log('GamesOddsObtainer deployed to:', oddsobtainer.address);
	setTargetAddress('GamesOddsObtainer', network, oddsobtainer.address);

	const implementation = await getImplementationAddress(ethers.provider, oddsobtainer.address);
	console.log('GamesOddsObtainerImplementation: ', implementation);
	setTargetAddress('GamesOddsObtainerImplementation', network, implementation);

	await hre.run('verify:verify', {
		address: implementation,
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

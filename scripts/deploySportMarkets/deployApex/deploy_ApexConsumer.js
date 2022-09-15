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

	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}

	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	/* ========== PROPERTIES FOR INITIALIZE ========== */

	// if there is sport menager deployed:
	/*
	const sportsManager = await ethers.getContractFactory('SportPositionalMarketManager');
	let sportsManagerAddress = getTargetAddress('SportPositionalMarketManager', network);

	console.log('SportPositionalMarketManager address: ', sportsManagerAddress);
	*/

	const chainlink = require(`./chainlink/${network}.json`);

	console.log('LINK address:', chainlink['LINK']);
	console.log('ORACLE address:', chainlink['ORACLE']);

	const allowedSports = ['formula1', 'motogp'];

	/* ========== DEPLOY CONTRACT ========== */

	// consumer

	let ApexConsumer = await ethers.getContractFactory('ApexConsumer');
	let sportPositionalMarketManagerAddress = getTargetAddress(
		'SportPositionalMarketManager',
		network
	);
	const apex = await upgrades.deployProxy(ApexConsumer, [
		owner.address,
		allowedSports,
		sportPositionalMarketManagerAddress,
	]);

	await apex.deployed();

	console.log('ApexConsumer deployed to:', apex.address);
	setTargetAddress('ApexConsumer', network, apex.address);

	const implementation = await getImplementationAddress(ethers.provider, apex.address);
	console.log('ApexConsumerImplementation: ', implementation);
	setTargetAddress('ApexConsumerImplementation', network, implementation);

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

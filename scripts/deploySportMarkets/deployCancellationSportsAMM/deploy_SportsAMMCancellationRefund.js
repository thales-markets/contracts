const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');
const { setTargetAddress, getTargetAddress } = require('../../helpers');

const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { toBN } = web3.utils;

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

	const SportsAMMContract = getTargetAddress('SportsAMM', network);
	const riskManagerAddress = getTargetAddress('SportAMMRiskManager', network);
	console.log('Found SportsAMM at:', SportsAMMContract);
	console.log('Found SportAMMRiskManager at:', riskManagerAddress);

	const SportAMMRiskManager = await ethers.getContractFactory('SportAMMRiskManager');
	const SportAMMRiskManagerDeployed = await SportAMMRiskManager.attach(riskManagerAddress);
	const SportsAMMCancellationPool = await ethers.getContractFactory('SportsAMMCancellationPool');

	const SportsAMMCancellationPoolDeployed = await upgrades.deployProxy(SportsAMMCancellationPool, [
		SportsAMMContract,
	]);
	await delay(2000);
	await SportsAMMCancellationPoolDeployed.deployed();

	console.log(
		'SportsAMMCancellationPoolDeployed Deployed on',
		SportsAMMCancellationPoolDeployed.address
	);
	setTargetAddress('SportsAMMCancellationPool', network, SportsAMMCancellationPoolDeployed.address);

	const SportsAMMCancellationPoolImplementation = await getImplementationAddress(
		ethers.provider,
		SportsAMMCancellationPoolDeployed.address
	);

	console.log(
		'Implementation SportsAMMCancellationPool: ',
		SportsAMMCancellationPoolImplementation
	);
	setTargetAddress(
		'SportsAMMCancellationPoolImplementation',
		network,
		SportsAMMCancellationPoolImplementation
	);

	if (
		networkObj.chainId == 69 ||
		networkObj.chainId == 42 ||
		networkObj.chainId == 420 ||
		networkObj.chainId == 5
	) {
		await delay(5000);
		await SportAMMRiskManagerDeployed.setSportsAMMCancellationPool(
			SportsAMMCancellationPoolDeployed.address,
			{ from: owner.address }
		);
		console.log('SportsAMMCancellationPoolDeployed set in SportAMMRiskManager');
	}

	await delay(5000);
	try {
		await hre.run('verify:verify', {
			address: SportsAMMCancellationPoolImplementation,
		});
	} catch (e) {
		console.log(e);
	}
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

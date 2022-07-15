const path = require('path');
const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let mainnetNetwork = 'mainnet';

	if (network == 'homestead') {
		console.log(
			"Error L1 network used! Deploy only on L2 Optimism. \nTry using '--network optimistic'"
		);
		return 0;
	}
	if (networkObj.chainId == 42) {
		networkObj.name = 'kovan';
		network = 'kovan';
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
		mainnetNetwork = 'kovan';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}

	const ThalesBondsContract = await ethers.getContractFactory('ThalesBonds');
	const ExoticMarketManagerAddress = getTargetAddress('ExoticMarketManager', network);
	const ExoticMarketManager = await ethers.getContractFactory('ExoticPositionalMarketManager');

	const ThalesBondsDeployed = await upgrades.deployProxy(ThalesBondsContract, [owner.address]);
	await ThalesBondsDeployed.deployed;

	console.log('ThalesBonds Deployed on', ThalesBondsDeployed.address);
	setTargetAddress('ThalesBonds', network, ThalesBondsDeployed.address);

	const ThalesBondsImplementation = await getImplementationAddress(
		ethers.provider,
		ThalesBondsDeployed.address
	);

	console.log('Implementation ThalesBonds: ', ThalesBondsImplementation);
	setTargetAddress('ThalesBondsImplementation', network, ThalesBondsImplementation);

	const ExoticMarketManagerDeployed = await ExoticMarketManager.attach(ExoticMarketManagerAddress);
	await ExoticMarketManagerDeployed.setThalesBonds(ThalesBondsDeployed.address);
	console.log('ThalesBonds address set in ExoticMarketManager');

	await ThalesBondsDeployed.setMarketManager(ExoticMarketManagerDeployed.address);
	console.log('ExoticMarketManager address set in ThalesBonds');

	try {
		await hre.run('verify:verify', {
			address: ThalesBondsDeployed.address,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: ThalesBondsImplementation,
		});
	} catch (e) {
		console.log(e);
	}
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

function delay(time) {
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}

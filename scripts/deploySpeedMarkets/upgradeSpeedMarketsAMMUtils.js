const path = require('path');
const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

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

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
	}

	if (networkObj.chainId == 56) {
		networkObj.name = 'bsc';
		network = 'bsc';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	if (networkObj.chainId == 168587773) {
		networkObj.name = 'blastSepolia';
		network = 'blastSepolia';
	}

	if (networkObj.chainId == 11155420) {
		networkObj.name = 'optimisticSepolia';
		network = 'optimisticSepolia';
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + network);

	const speedMarketsAMMUtilsAddress = getTargetAddress('SpeedMarketsAMMUtils', network);
	console.log('Found SpeedMarketsAMMUtils at:', speedMarketsAMMUtilsAddress);

	const SpeedMarketsAMMUtils = await ethers.getContractFactory('SpeedMarketsAMMUtils');

	const implementation = await getImplementationAddress(
		ethers.provider,
		speedMarketsAMMUtilsAddress
	);
	console.log('Current implementation:', implementation);

	// Upgrade the contract
	console.log('Upgrading SpeedMarketsAMMUtils...');
	const upgraded = await upgrades.upgradeProxy(speedMarketsAMMUtilsAddress, SpeedMarketsAMMUtils);
	await upgraded.deployed();

	console.log('SpeedMarketsAMMUtils upgraded');

	const newImplementation = await getImplementationAddress(
		ethers.provider,
		speedMarketsAMMUtilsAddress
	);
	console.log('New implementation:', newImplementation);

	setTargetAddress('SpeedMarketsAMMUtilsImplementation', network, newImplementation);

	// Wait for confirmation
	await delay(5000);

	try {
		await hre.run('verify:verify', {
			address: newImplementation,
			constructorArguments: [],
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

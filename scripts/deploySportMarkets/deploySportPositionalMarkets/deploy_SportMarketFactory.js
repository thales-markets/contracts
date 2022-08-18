const path = require('path');
const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { getTargetAddress, setTargetAddress } = require('../../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let mainnetNetwork = 'mainnet';
	let PaymentToken;

	if (network == 'homestead') {
		console.log(
			"Error L1 network used! Deploy only on L2 Optimism. \nTry using '--network optimistic'"
		);
		return 0;
	}
	if (networkObj.chainId == 42) {
		networkObj.name = 'kovan';
		network = 'kovan';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
		mainnetNetwork = 'kovan';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
		PaymentToken = getTargetAddress('ProxysUSD', network);
	}
	if (networkObj.chainId == 5) {
		networkObj.name = 'goerli';
		network = 'goerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}

	const SportMarketFactory = await ethers.getContractFactory('SportPositionalMarketFactory');
	const SportMarketManager = await ethers.getContractFactory('SportPositionalMarketManager');
	const SportMarketManagerAddress = getTargetAddress('SportPositionalMarketManager', network);
	const SportMarketManagerDeployed = await SportMarketManager.attach(SportMarketManagerAddress);

	const SportMarketFactoryDeployed = await upgrades.deployProxy(SportMarketFactory, [
		owner.address,
	]);
	await SportMarketFactoryDeployed.deployed;

	console.log('SportMarketFactory Deployed on', SportMarketFactoryDeployed.address);
	setTargetAddress('SportPositionalMarketFactory', network, SportMarketFactoryDeployed.address);

	const SportMarketFactoryImplementation = await getImplementationAddress(
		ethers.provider,
		SportMarketFactoryDeployed.address
	);

	console.log('Implementation SportMarketFactory: ', SportMarketFactoryImplementation);
	setTargetAddress(
		'SportPositionalMarketFactoryImplementation',
		network,
		SportMarketFactoryImplementation
	);

	await delay(5000);

	await SportMarketManagerDeployed.setSportPositionalMarketFactory(
		SportMarketFactoryDeployed.address,
		{ from: owner.address }
	);
	console.log('Factory set in Manager');
	await delay(5000);
	await SportMarketFactoryDeployed.setSportPositionalMarketManager(
		SportMarketManagerDeployed.address,
		{ from: owner.address }
	);
	console.log('Manager set in Factory');

	await delay(5000);
	try {
		await hre.run('verify:verify', {
			address: SportMarketFactoryDeployed.address,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: SportMarketFactoryImplementation,
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

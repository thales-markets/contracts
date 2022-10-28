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
		ThalesName = 'OpThales_L1';
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

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}

	const MarketDataContract = await ethers.getContractFactory('ExoticPositionalMarketData');
	const ExoticMarketManagerAddress = getTargetAddress('ExoticMarketManager', network);
	const ExoticMarketManager = await ethers.getContractFactory('ExoticPositionalMarketManager');

	const MarketDataDeployed = await upgrades.deployProxy(MarketDataContract, [
		owner.address,
		ExoticMarketManagerAddress,
	]);
	await MarketDataDeployed.deployed;

	console.log('MarketData Deployed on', MarketDataDeployed.address);
	setTargetAddress('ExoticPositionalMarketData', network, MarketDataDeployed.address);

	const ExoticPositionalMarketDataImplementation = await getImplementationAddress(
		ethers.provider,
		MarketDataDeployed.address
	);

	console.log('Implementation MarketData: ', ExoticPositionalMarketDataImplementation);
	setTargetAddress(
		'ExoticPositionalMarketDataImplementation',
		network,
		ExoticPositionalMarketDataImplementation
	);

	const ExoticMarketManagerDeployed = await ExoticMarketManager.attach(ExoticMarketManagerAddress);
	await ExoticMarketManagerDeployed.setMarketDataAddress(MarketDataDeployed.address);
	console.log('MarketData address set in ExoticMarketManager');

	await MarketDataDeployed.setMarketManager(ExoticMarketManagerDeployed.address);
	console.log('ExoticMarketManager address set in MarketData');

	try {
		await hre.run('verify:verify', {
			address: MarketDataDeployed.address,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: ExoticPositionalMarketDataImplementation,
		});
	} catch (e) {
		console.log(e);
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}

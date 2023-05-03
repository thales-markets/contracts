const path = require('path');
const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	if (network == 'homestead') {
		console.log(
			"Error L1 network used! Deploy only on L2 Optimism. \nTry using '--network optimistic'"
		);
		return 0;
	}
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}
	if (networkObj.chainId == 56) {
		networkObj.name = 'bsc';
		network = 'bsc';
	}
	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	const MarketData = await ethers.getContractFactory('PositionalMarketData');
	const MarketDataAddress = getTargetAddress('PositionalMarketData', network);

	let implementation;
	if (networkObj.chainId == 10 || networkObj.chainId == 42161) {
		implementation = await upgrades.prepareUpgrade(MarketDataAddress, MarketData);
	}

	// upgrade if test networks
	if (networkObj.chainId == 420) {
		await upgrades.upgradeProxy(MarketDataAddress, MarketData);

		implementation = await getImplementationAddress(ethers.provider, MarketDataAddress);
	}

	console.log('PositionalMarketData upgraded');

	console.log('PositionalMarketDataImplementation: ', implementation);
	setTargetAddress('PositionalMarketDataImplementation', network, implementation);

	await delay(5000);
	try {
		await hre.run('verify:verify', {
			address: implementation,
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

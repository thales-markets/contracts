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

	const SportMarketManager = await ethers.getContractFactory('SportPositionalMarketManager');
	const SportMarketManagerAddress = getTargetAddress('SportPositionalMarketManager', network);

	let implementation;
	if (networkObj.chainId == 10) {
		implementation = await upgrades.prepareUpgrade(SportMarketManagerAddress, SportMarketManager);
	}

	// upgrade if test networks
	if (networkObj.chainId == 69 || networkObj.chainId == 42 || networkObj.chainId == 5) {
		await upgrades.upgradeProxy(SportMarketManagerAddress, SportMarketManager);

		implementation = await getImplementationAddress(ethers.provider, SportMarketManagerAddress);
	}

	console.log('SportPositionalMarketManager upgraded');

	console.log('SportPositionalMarketManagerImplementation: ', implementation);
	setTargetAddress('SportPositionalMarketManagerImplementation', network, implementation);

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
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

function delay(time) {
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}

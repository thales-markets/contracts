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
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
		PaymentToken = getTargetAddress('ProxyUSDC', network);
	}

	const SportMarketData = await ethers.getContractFactory('SportPositionalMarketData');
	const SportMarketDataAddress = getTargetAddress('SportPositionalMarketData', network);

	let implementation;
	if (networkObj.chainId == 10 || networkObj.chainId == 42161) {
		implementation = await upgrades.prepareUpgrade(SportMarketDataAddress, SportMarketData);
	}

	// upgrade if test networks
	if (networkObj.chainId == 69 || networkObj.chainId == 42 || networkObj.chainId == 420) {
		await upgrades.upgradeProxy(SportMarketDataAddress, SportMarketData);

		implementation = await getImplementationAddress(ethers.provider, SportMarketDataAddress);
	}

	console.log('SportPositionalMarketData upgraded');

	console.log('SportPositionalMarketDataImplementation: ', implementation);
	setTargetAddress('SportPositionalMarketDataImplementation', network, implementation);

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

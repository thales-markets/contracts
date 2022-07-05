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
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
		PaymentToken = getTargetAddress('ProxysUSD', network);
	}

	const SportMarketManager = await ethers.getContractFactory('SportPositionalMarketManager');
	const SportMarketManagerAddress = getTargetAddress('SportPositionalMarketManager', network);
	const SportMarketManagerDeployed = await SportMarketManager.attach(SportMarketManagerAddress);

	const SportMarketFactoryAddress = getTargetAddress('SportPositionalMarketFactory', network);
	const SportMarketFactory = await ethers.getContractFactory('SportPositionalMarketFactory');
	const SportMarketFactoryDeployed = await SportMarketFactory.attach(SportMarketFactoryAddress);

	const SportPosition = await ethers.getContractFactory('SportPositionMastercopy');

	const SportPositionDeployed = await SportPosition.deploy();
	await SportPositionDeployed.deployed();

	console.log('SportPositionMastercopy Deployed on', SportPositionDeployed.address);
	setTargetAddress('SportPositionMastercopy', network, SportPositionDeployed.address);

	// await delay(5000);
	// await SportMarketManagerDeployed.setPositionalMarketFactory(SportMarketFactoryDeployed.address, {from: owner.address});
	await delay(5000);
	if (networkObj.chainId == 69 || networkObj.chainId == 42) {
		await SportMarketFactoryDeployed.setPositionMastercopy(SportPositionDeployed.address, {
			from: owner.address,
		});
		console.log('SportPositionMarketMastercopy set in Factory');
		await delay(5000);
	}
	try {
		await hre.run('verify:verify', {
			address: SportPositionDeployed.address,
			contract:
				'contracts/SportMarkets/SportPositions/SportPositionMastercopy.sol:SportPositionMastercopy',
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

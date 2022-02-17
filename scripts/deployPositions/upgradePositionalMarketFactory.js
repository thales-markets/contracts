const { ethers, upgrades } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../helpers');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

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

	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimistic';
		network = 'optimistic';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	const positionalMarketFactoryAddress = getTargetAddress('PositionalMarketFactory', network);
	console.log('Found PositionalMarketFactory at:', positionalMarketFactoryAddress);

	const PositionalMarketFactory = await ethers.getContractFactory('PositionalMarketFactory');
	await upgrades.upgradeProxy(positionalMarketFactoryAddress, PositionalMarketFactory);

	console.log('PositionalMarketFactory upgraded');

	const positionalMarketFactoryImplementation = await getImplementationAddress(ethers.provider, positionalMarketFactoryAddress);
	setTargetAddress('PositionalMarketFactoryImplementation', network, positionalMarketFactoryImplementation);

	let LimitOrderProviderAddress = getTargetAddress('LimitOrderProvider', network);
	let PositionalMarketManagerDeployed = getTargetAddress('PositionalMarketManager', network);
	let PositionalMarketMastercopyDeployed = getTargetAddress('PositionalMarketMastercopy', network);
	let PositionMastercopyDeployed = getTargetAddress('PositionMastercopy', network);
	const PositionalMarketFactoryDeployed = await PositionalMarketFactory.attach(positionalMarketFactoryAddress);

	let tx = await PositionalMarketFactoryDeployed.setPositionalMarketManager(
		PositionalMarketManagerDeployed
	);
	await tx.wait().then(e => {
		console.log('PositionalMarketFactory: setPositionalMarketManager');
	});

	tx = await PositionalMarketFactoryDeployed.setPositionalMarketMastercopy(
		PositionalMarketMastercopyDeployed
	);
	await tx.wait().then(e => {
		console.log('PositionalMarketFactory: setPositionalMarketMastercopy');
	});
	tx = await PositionalMarketFactoryDeployed.setPositionMastercopy(
		PositionMastercopyDeployed
	);
	await tx.wait().then(e => {
		console.log('PositionalMarketFactory: setPositionMastercopy');
	});

	if (LimitOrderProviderAddress) {
		tx = await PositionalMarketFactoryDeployed.setLimitOrderProvider(LimitOrderProviderAddress);
		await tx.wait().then(e => {
			console.log('PositionalMarketFactory: setLimitOrderProvider');
		});
	}

	try {
		await hre.run('verify:verify', {
			address: positionalMarketFactoryImplementation,
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

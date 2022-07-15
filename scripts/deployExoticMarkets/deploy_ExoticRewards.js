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

	const ExoticRewardsContract = await ethers.getContractFactory('ExoticRewards');
	const ExoticMarketManagerAddress = getTargetAddress('ExoticMarketManager', network);
	const ExoticMarketManager = await ethers.getContractFactory('ExoticPositionalMarketManager');

	const ExoticRewardsDeployed = await upgrades.deployProxy(ExoticRewardsContract, [
		owner.address,
		ExoticMarketManagerAddress,
	]);
	await ExoticRewardsDeployed.deployed;

	console.log('ExoticRewards Deployed on', ExoticRewardsDeployed.address);
	setTargetAddress('ExoticRewards', network, ExoticRewardsDeployed.address);

	const ExoticRewardsImplementation = await getImplementationAddress(
		ethers.provider,
		ExoticRewardsDeployed.address
	);

	console.log('Implementation ExoticRewards: ', ExoticRewardsImplementation);
	setTargetAddress('ExoticRewardsImplementation', network, ExoticRewardsImplementation);

	const ExoticMarketManagerDeployed = await ExoticMarketManager.attach(ExoticMarketManagerAddress);
	await ExoticMarketManagerDeployed.setExoticRewards(ExoticRewardsDeployed.address);
	console.log('ExoticRewards address set in ExoticMarketManager');

	// await ExoticRewardsDeployed.setMarketManager(ExoticMarketManagerDeployed.address);
	// console.log("ExoticMarketManager address set in ExoticRewards");

	try {
		await hre.run('verify:verify', {
			address: ExoticRewardsDeployed.address,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: ExoticRewardsImplementation,
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

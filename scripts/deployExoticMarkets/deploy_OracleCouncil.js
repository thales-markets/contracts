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

	const OracleCouncilContract = await ethers.getContractFactory('ThalesOracleCouncil');
	const ExoticMarketManagerAddress = getTargetAddress('ExoticMarketManager', network);
	const ExoticMarketManager = await ethers.getContractFactory('ExoticPositionalMarketManager');

	const OracleCouncilDeployed = await upgrades.deployProxy(OracleCouncilContract, [
		owner.address,
		ExoticMarketManagerAddress,
	]);
	await OracleCouncilDeployed.deployed;

	console.log('OracleCouncil Deployed on', OracleCouncilDeployed.address);
	setTargetAddress('ThalesOracleCouncil', network, OracleCouncilDeployed.address);

	const OracleCouncilImplementation = await getImplementationAddress(
		ethers.provider,
		OracleCouncilDeployed.address
	);

	console.log('Implementation OracleCouncil: ', OracleCouncilImplementation);
	setTargetAddress('ThalesOracleCouncilImplementation', network, OracleCouncilImplementation);

	const ExoticMarketManagerDeployed = await ExoticMarketManager.attach(ExoticMarketManagerAddress);
	await ExoticMarketManagerDeployed.setOracleCouncilAddress(OracleCouncilDeployed.address);
	console.log('OracleCouncil address set in ExoticMarketManager');

	await OracleCouncilDeployed.setMarketManager(ExoticMarketManagerDeployed.address);
	console.log('ExoticMarketManager address set in OracleCouncil');

	try {
		await hre.run('verify:verify', {
			address: OracleCouncilDeployed.address,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: OracleCouncilImplementation,
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

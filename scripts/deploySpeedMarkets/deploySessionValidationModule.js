const { ethers } = require('hardhat');
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

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + network);

	const SpeedMarketsAMMCreatorAddress = getTargetAddress('SpeedMarketsAMMCreator', network);
	const SpeedMarketsAMMAddress = getTargetAddress('SpeedMarketsAMM', network);
	const ChainedSpeedMarketsAMM = getTargetAddress('SpeedMarketsAMMCreator', network);

	const SessionValidationModule = await ethers.getContractFactory('SessionValidationModule');
	const SessionValidationModuleDeployed = await SessionValidationModule.deploy();
	await SessionValidationModuleDeployed.deployed();

	console.log('SessionValidationModule deployed to:', SessionValidationModuleDeployed.address);
	setTargetAddress('SessionValidationModule', network, SessionValidationModuleDeployed.address);

	await SessionValidationModuleDeployed.initialize(
		SpeedMarketsAMMCreatorAddress,
		SpeedMarketsAMMAddress,
		ChainedSpeedMarketsAMM
	);

	try {
		await hre.run('verify:verify', {
			address: SessionValidationModuleDeployed.address,
		});
	} catch (e) {
		console.log(e);
	}

	function delay(time) {
		return new Promise(function (resolve) {
			setTimeout(resolve, time);
		});
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

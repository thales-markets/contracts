const { ethers } = require('hardhat');
const { setTargetAddress } = require('../helpers');

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

	if (networkObj.chainId == 11155420) {
		networkObj.name = 'optimisticSepolia';
		network = 'optimisticSepolia';
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + network);

	const ChainedSpeedMarketMastercopy = await ethers.getContractFactory(
		'ChainedSpeedMarketMastercopy'
	);
	const ChainedSpeedMarketMastercopyDeployed = await ChainedSpeedMarketMastercopy.deploy();
	await ChainedSpeedMarketMastercopyDeployed.deployed();

	console.log(
		'ChainedSpeedMarketMastercopy deployed to:',
		ChainedSpeedMarketMastercopyDeployed.address
	);
	setTargetAddress(
		'ChainedSpeedMarketMastercopy',
		network,
		ChainedSpeedMarketMastercopyDeployed.address
	);

	await hre.run('verify:verify', {
		address: ChainedSpeedMarketMastercopyDeployed.address,
		constructorArguments: [],
		contract:
			'contracts/SpeedMarkets/ChainedSpeedMarketMastercopy.sol:ChainedSpeedMarketMastercopy',
	});

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

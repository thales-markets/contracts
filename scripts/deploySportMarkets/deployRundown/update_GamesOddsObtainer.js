const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const { getTargetAddress, setTargetAddress } = require('../../helpers');

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
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	const oddsObtainerAddress = getTargetAddress('GamesOddsObtainer', network);
	console.log('Found GamesOddsObtainer at:', oddsObtainerAddress);

	const GamesOddsObtainer = await ethers.getContractFactory('GamesOddsObtainer');
	let implementation;
	if (networkObj.chainId == 10 || networkObj.chainId == 42161) {
		implementation = await upgrades.prepareUpgrade(oddsObtainerAddress, GamesOddsObtainer);
	}

	// upgrade if test networks
	if (
		networkObj.chainId == 69 ||
		networkObj.chainId == 42 ||
		networkObj.chainId == 420 ||
		networkObj.chainId == 5
	) {
		await upgrades.upgradeProxy(oddsObtainerAddress, GamesOddsObtainer);

		implementation = await getImplementationAddress(ethers.provider, oddsObtainerAddress);
	}

	console.log('GamesOddsObtainer upgraded');

	console.log('GamesOddsObtainerImplementation: ', implementation);
	setTargetAddress('GamesOddsObtainerImplementation', network, implementation);

	await hre.run('verify:verify', {
		address: implementation,
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

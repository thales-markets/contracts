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

	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	const playerPropsAddress = getTargetAddress('GamesPlayerProps', network);
	console.log('Found GamesPlayerProps at:', playerPropsAddress);

	const GamesPlayerProps = await ethers.getContractFactory('GamesPlayerProps');
	let implementation;
	if (networkObj.chainId == 10 || networkObj.chainId == 42161 || networkObj.chainId == 8453) {
		implementation = await upgrades.prepareUpgrade(playerPropsAddress, GamesPlayerProps);
	}

	// upgrade if test networks
	if (
		networkObj.chainId == 69 ||
		networkObj.chainId == 42 ||
		networkObj.chainId == 420 ||
		networkObj.chainId == 5
	) {
		await upgrades.upgradeProxy(playerPropsAddress, GamesPlayerProps);

		implementation = await getImplementationAddress(ethers.provider, playerPropsAddress);
	}

	console.log('GamesPlayerProps upgraded');

	console.log('GamesPlayerPropsImplementation: ', implementation);
	setTargetAddress('GamesPlayerPropsImplementation', network, implementation);

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

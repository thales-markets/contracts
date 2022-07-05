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

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	const therundownConsumerAddress = getTargetAddress('TherundownConsumer', network);
	console.log('Found TherundownConsumer at:', therundownConsumerAddress);

	const TherundownConsumer = await ethers.getContractFactory('TherundownConsumer');
	let implementation;
	if (networkObj.chainId == 10) {
		implementation = await upgrades.prepareUpgrade(therundownConsumerAddress, TherundownConsumer);
	}

	// upgrade if test networks
	if (networkObj.chainId == 69 || networkObj.chainId == 42) {
		await upgrades.upgradeProxy(therundownConsumerAddress, TherundownConsumer);

		implementation = await getImplementationAddress(ethers.provider, therundownConsumerAddress);
	}

	console.log('TherundownConsumer upgraded');

	console.log('TherundownConsumerImplementation: ', implementation);
	setTargetAddress('TherundownConsumerImplementation', network, implementation);

	await hre.run('verify:verify', {
		address: implementation,
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

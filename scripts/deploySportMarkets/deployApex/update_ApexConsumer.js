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

	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	const apexConsumerAddress = getTargetAddress('ApexConsumer', network);
	console.log('Found ApexConsumer at:', apexConsumerAddress);

	const ApexConsumer = await ethers.getContractFactory('ApexConsumer');
	let implementation;
	if (networkObj.chainId == 10) {
		implementation = await upgrades.prepareUpgrade(apexConsumerAddress, ApexConsumer);
	}

	// upgrade if test networks
	if (networkObj.chainId == 5 || networkObj.chainId == 42) {
		await upgrades.upgradeProxy(apexConsumerAddress, ApexConsumer);

		implementation = await getImplementationAddress(ethers.provider, apexConsumerAddress);
	}

	console.log('apexConsumer upgraded');

	console.log('apexConsumerImplementation: ', implementation);
	setTargetAddress('apexConsumerImplementation', network, implementation);

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

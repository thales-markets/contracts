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

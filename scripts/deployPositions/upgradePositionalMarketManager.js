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

	const positionalMarketManagerAddress = getTargetAddress('PositionalMarketManager', network);
	console.log('Found PositionalMarketManager at:', positionalMarketManagerAddress);

	const PositionalMarketManager = await ethers.getContractFactory('PositionalMarketManager');
	await upgrades.upgradeProxy(positionalMarketManagerAddress, PositionalMarketManager);

	console.log('PositionalMarketManager upgraded');

	const positionalMarketManagerImplementation = await getImplementationAddress(ethers.provider, positionalMarketManagerAddress);
	setTargetAddress('PositionalMarketManagerImplementation', network, positionalMarketManagerImplementation);

	try {
		await hre.run('verify:verify', {
			address: positionalMarketManagerImplementation,
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

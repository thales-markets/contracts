const { ethers } = require('hardhat');

async function main() {
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	if (network === 'unknown') {
		network = 'localhost';
	}

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	await hre.run('verify:verify', {
		address: '0xC6e9c95823D7CC98A92D73de89D69548E2774cd8',
		constructorArguments: [],
		contract: 'contracts/Positions/PositionMastercopy.sol:PositionMastercopy',
	});

	await hre.run('verify:verify', {
		address: '0xEcA7A1b229BB6Ad5c96FeeCdBF095750A71889ac',
		constructorArguments: [],
		contract: 'contracts/Positions/PositionalMarketMastercopy.sol:PositionalMarketMastercopy',
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

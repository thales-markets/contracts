const { ethers, upgrades } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	let proxySUSD;

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
		proxySUSD = getTargetAddress('ProxysUSD', network);
	}

	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
		proxySUSD = getTargetAddress('ExoticUSD', network);
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
		proxySUSD = getTargetAddress('ProxyUSDC', network);
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	const thalesAMMLiquidityPoolAddress = getTargetAddress('ThalesAMMLiquidityPool', network);
	console.log('Found thalesAMMLiquidityPool at:', thalesAMMLiquidityPoolAddress);

	const ThalesAMMLiquidityPool = await ethers.getContractFactory('ThalesAMMLiquidityPool');
	const implementation = await upgrades.prepareUpgrade(
		thalesAMMLiquidityPoolAddress,
		ThalesAMMLiquidityPool
	);

	if (networkObj.chainId == 420) {
		await upgrades.upgradeProxy(thalesAMMLiquidityPoolAddress, ThalesAMMLiquidityPool);
		console.log('ThalesAMMLiquidityPool upgraded');
	}

	console.log('ThalesAMMLiquidityPoolImplementation: ', implementation);
	setTargetAddress('ThalesAMMLiquidityPoolImplementation', network, implementation);

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

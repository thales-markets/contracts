const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const { toBytes32 } = require('../../../index');
const { setTargetAddress } = require('../../helpers');

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
	console.log('Network id:' + networkObj.chainId);

	const IUniswapV3Pool = await ethers.getContractAt('IUniswapV3Pool', '0xf334f6104a179207ddacfb41fa3567feea8595c2');

	let secondsAgo = [];
	secondsAgo.push(300); // from (before)
	secondsAgo.push[0]; // to (now)

	let result = await IUniswapV3Pool.observe(secondsAgo);
	console.log('Result is ' + result);
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

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

	const IUniswapV3Pool = await ethers.getContractAt('IUniswapV3Pool', '0x5e8b0fc35065a5d980c11f96cb52381de390b13f');
	const PriceFeed = await ethers.getContractAt('PriceFeed', '0x671f9654a594f8966b19c0b466f306E1dFe912a6');


	let secondsAgo = [];
	secondsAgo.push(1200); // from (before)
	secondsAgo.push(0); // to (now)

	let result;
	result = await IUniswapV3Pool.observe(secondsAgo);
	console.log('Result is ' + result[0]);
	let tick = (result[0][1] - result[0][0])/1200;
	console.log(tick, 'tick');
	const expectedRatio = Math.pow(1.0001, tick);
	console.log('expected ratio', expectedRatio);

	console.log("AELIN", await PriceFeed.rateForCurrency(toBytes32("AELIN")))
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

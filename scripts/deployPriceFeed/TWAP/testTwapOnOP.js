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

	const IUniswapV3Pool = await ethers.getContractAt('IUniswapV3Pool', '0x535541f1aa08416e69dc4d610131099fa2ae7222');
	const PriceFeed = await ethers.getContractAt('PriceFeed', '0xf4aef21d906992aFAdde7A9676e1dB4feb6390DD');


	let secondsAgo = [];
	secondsAgo.push(300); // from (before)
	secondsAgo.push(0); // to (now)

	let result;
	result = await IUniswapV3Pool.observe(secondsAgo);
	console.log('Result is ' + result[0]);
	let tick = (result[0][1] - result[0][0])/300;
	console.log(tick, 'tick');
	const expectedRatio = Math.pow(1.0001, tick);
	console.log('expected ratio', expectedRatio);

	result = await IUniswapV3Pool.slot0();
	console.log('Result slot0', result[0].toString());

	console.log("PERP", (await PriceFeed.rateForCurrency(toBytes32("PERP"))).toString());
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix');
const { artifacts, contract, web3 } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (network == 'homestead') {
		network = 'mainnet';
	}

	if(networkObj.chainId == 69) {
		networkObj.name = "optimisticKovan";
		network = 'optimisticKovan'
	}
	if(networkObj.chainId == 10) {
		networkObj.name = "optimistic";
		network = 'optimistic'		
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + networkObj.name);

	const addressResolverAddress = getTargetAddress('AddressResolver', network);
	console.log('Found address resolver at:' + addressResolverAddress);
	const safeDecimalMathAddress = getTargetAddress('SafeDecimalMath', network);
	console.log('Found safeDecimalMath at:' + safeDecimalMathAddress);
	
	const proxysUSDAddress = getTargetAddress('ProxysUSD', network);
	console.log('Found proxysUSD at:' + proxysUSDAddress);



	const priceFeedAddress = getTargetAddress('PriceFeed', network);
	console.log('Found PriceFeed at:' + priceFeedAddress);
	
	const BinaryOptionMastercopyAddress = getTargetAddress('BinaryOptionMastercopy', network);
	console.log('Found BinaryOptionMastercopy at:' + BinaryOptionMastercopyAddress);
	
	const BinaryOptionMarketMastercopyAddress = getTargetAddress('BinaryOptionMarketMastercopy', network);
	console.log('Found BinaryOptionMarketMastercopy at:' + BinaryOptionMarketMastercopyAddress);
	
	const BinaryOptionMarketFactoryAddress = getTargetAddress('BinaryOptionMarketFactory', network);
	console.log('Found BinaryOptionMarketFactory at:' + BinaryOptionMarketFactoryAddress);
	
	const BinaryOptionMarketManagerAddress = getTargetAddress('BinaryOptionMarketManager', network);
	console.log('Found BinaryOptionMarketManager at:' + BinaryOptionMarketManagerAddress);
	
	const BinaryOptionMarketDataAddress = getTargetAddress('BinaryOptionMarketData', network);
	console.log('Found BinaryOptionMarketData at:' + BinaryOptionMarketDataAddress);
	

	const ThalesRoyaleAddress = getTargetAddress('ThalesRoyale', network);
	console.log('Found ThalesRoyale at:' + ThalesRoyaleAddress);




	const day = 24 * 60 * 60;
	const maxOraclePriceAge = 120 * 60; // Price updates are accepted from up to two hours before maturity to allow for delayed chainlink heartbeats.
	const expiryDuration = 26 * 7 * day; // Six months to exercise options before the market is destructible.
	const maxTimeToMaturity = 730 * day; // Markets may not be deployed more than two years in the future.
	let creatorCapitalRequirement = w3utils.toWei('1'); // 1 sUSD is required to create a new market for testnet, 1000 for mainnet.
	if (network == 'mainnet') {
		creatorCapitalRequirement = w3utils.toWei('1000');
	}
	const poolFee = w3utils.toWei('0.005'); // 0.5% of the market's value goes to the pool in the end.
	const creatorFee = w3utils.toWei('0.005'); // 0.5% of the market's value goes to the creator.
	const feeAddress = '0xfeefeefeefeefeefeefeefeefeefeefeefeefeef';

	await hre.run('verify:verify', {
		address: priceFeedAddress,
		constructorArguments: [owner.address],
	});

	await hre.run('verify:verify', {
		address: BinaryOptionMarketFactoryAddress,
		constructorArguments: [owner.address],
	});

	await hre.run('verify:verify', {
		address: BinaryOptionMastercopyAddress,
		constructorArguments: [],
		contract: "contracts/BinaryOptions/BinaryOptionMastercopy.sol:BinaryOptionMastercopy"
	});

	await hre.run('verify:verify', {
		address: BinaryOptionMarketMastercopyAddress,
		constructorArguments: [],
		contract: "contracts/BinaryOptions/BinaryOptionMarketMastercopy.sol:BinaryOptionMarketMastercopy",
	});

	await hre.run('verify:verify', {
		address: BinaryOptionMarketDataAddress,
		constructorArguments: [],
	});

	await hre.run('verify:verify', {
		address: BinaryOptionMarketManagerAddress,
		constructorArguments: [
			owner.address,
			addressResolverAddress,
			priceFeedAddress,
			expiryDuration,
			maxTimeToMaturity,
			creatorCapitalRequirement,
			poolFee,
			creatorFee,
			feeAddress,
		],
	});

	await hre.run('verify:verify', {
		address: ThalesRoyaleAddress,
		constructorArguments: [
			owner.address,
			snx.toBytes32("ETH"),
			priceFeedAddress,
			w3utils.toWei('10000'),
			priceFeedAddress,
			7,
		],
	});


	
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

function delay(time) {
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}

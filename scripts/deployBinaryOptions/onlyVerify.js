const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
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

	console.log('Account is:' + owner.address);
	console.log('Network name:' + networkObj.name);

	const safeDecimalMath = snx.getTarget({ network, contract: 'SafeDecimalMath' });
	console.log('Found safeDecimalMath at:' + safeDecimalMath.address);

	const priceFeedAddress = getTargetAddress('PriceFeed', network);
	console.log('Found PriceFeed at:' + priceFeedAddress);
	
	const MockPriceFeedAddress = getTargetAddress('MockPriceFeed', network);
	console.log('Found MockPriceFeed at:' + MockPriceFeedAddress);
	
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
	
	const day = 24 * 60 * 60;
	const maxOraclePriceAge = 120 * 60; // Price updates are accepted from up to two hours before maturity to allow for delayed chainlink heartbeats.
	const expiryDuration = 26 * 7 * day; // Six months to exercise options before the market is destructible.
	const maxTimeToMaturity = 730 * day; // Markets may not be deployed more than two years in the future.
	let creatorCapitalRequirement = w3utils.toWei('1'); // 1 sUSD is required to create a new market for testnet, 1000 for mainnet.
	if (network == 'mainnet') {
		creatorCapitalRequirement = w3utils.toWei('1000');
	}


	await hre.run('verify:verify', {
		address: MockPriceFeedAddress,
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
			addressResolver.address,
			priceFeedAddress,
			expiryDuration,
			maxTimeToMaturity,
			creatorCapitalRequirement
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

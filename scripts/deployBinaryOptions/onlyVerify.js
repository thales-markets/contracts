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

	console.log('Account is:' + owner.address);
	console.log('Network name:' + networkObj.name);

	const addressResolver = snx.getTarget({ network, contract: 'ReadProxyAddressResolver' });
	console.log('Found address resolver at:' + addressResolver.address);

	const safeDecimalMath = snx.getTarget({ network, contract: 'SafeDecimalMath' });
	console.log('Found safeDecimalMath at:' + safeDecimalMath.address);

	const priceFeedAddress = getTargetAddress('PriceFeed', network);
	console.log('Found PriceFeed at:' + priceFeedAddress);

	// We get the contract to deploy
	const BinaryOptionMastercopy = await ethers.getContractFactory('BinaryOptionMastercopy');

	const BinaryOptionMarketMastercopy = await ethers.getContractFactory(
		'BinaryOptionMarketMastercopy',
		{
			libraries: {
				SafeDecimalMath: safeDecimalMath.address,
			},
		}
	);

	const BinaryOptionMarketFactory = await ethers.getContractFactory('BinaryOptionMarketFactory');

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

	const BinaryOptionMarketManager = await ethers.getContractFactory('BinaryOptionMarketManager', {
		libraries: {
			SafeDecimalMath: safeDecimalMath.address,
		},
	});

	const BinaryOptionMarketData = await ethers.getContractFactory('BinaryOptionMarketData');

	// await hre.run('verify:verify', {
	// 	address: binaryOptionMarketFactoryDeployed.address,
	// 	constructorArguments: [owner.address],
	// });

	// await hre.run('verify:verify', {
	// 	address: '0x10C3cdB9616E246E48b6012F58B40Cc2B3254063',
	// 	constructorArguments: [],
	// 	contract: "contracts/BinaryOptions/BinaryOptionMastercopy.sol:BinaryOptionMastercopy"
	// });

	await hre.run('verify:verify', {
		address: '0xd051b22871f23d12eEdF54d695420F43C9d3C268',
		constructorArguments: [],
		contract: "contracts/BinaryOptions/BinaryOptionMarketMastercopy.sol:BinaryOptionMarketMastercopy",
	});

	await hre.run('verify:verify', {
		address: '0x43F0408cA92970EA198dAF6F41E024EF866178cD',
		constructorArguments: [],
	});

	await hre.run('verify:verify', {
		address: '0xF0c573f825b9efE4Da8DDd161ff1ebb756233ecA',
		constructorArguments: [
			owner.address,
			addressResolver.address,
			priceFeedAddress,
			expiryDuration,
			maxTimeToMaturity,
			creatorCapitalRequirement,
			poolFee,
			creatorFee,
			feeAddress,
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

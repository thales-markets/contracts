const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');

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

	await hre.run('verify:verify', {
		address: '0x3e4e650f61c7a747a4badcff5c3b3e2baf37aec3',
		constructorArguments: [
			owner.address,
			addressResolver.address,
			expiryDuration,
			maxTimeToMaturity,
			creatorCapitalRequirement,
			poolFee,
			creatorFee,
			feeAddress,
		],
	});

	await hre.run('verify:verify', {
		address: '0x46d9db2830c005e38878b241199bb09d9d355994',
		constructorArguments: [owner.address],
	});

	await hre.run('verify:verify', {
		address: '0x782a8aa798ee31c4c248bc2a209c96d625de04f6',
		constructorArguments: [],
		contract: 'contracts/BinaryOptionMastercopy.sol:BinaryOptionMastercopy',
	});

	await hre.run('verify:verify', {
		address: '0xf73e5353ea2e50976afe763ce6a483f4124347f3',
		constructorArguments: [],
		contract: 'contracts/BinaryOptionMarketMastercopy.sol:BinaryOptionMarketMastercopy',
	});

	await hre.run('verify:verify', {
		address: '0xd308ff11a3d06b184c68af0b9a003468a4a3c1a5',
		constructorArguments: [],
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

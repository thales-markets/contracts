const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix');
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
	const binaryOptionMastercopyDeployed = await BinaryOptionMastercopy.deploy();
	await binaryOptionMastercopyDeployed.deployed();

	console.log('BinaryOptionMastercopy deployed to:', binaryOptionMastercopyDeployed.address);

	const BinaryOptionMarketMastercopy = await ethers.getContractFactory(
		'BinaryOptionMarketMastercopy',
		{
			libraries: {
				SafeDecimalMath: safeDecimalMath.address,
			},
		}
	);
	const binaryOptionMarketMastercopyDeployed = await BinaryOptionMarketMastercopy.deploy();
	await binaryOptionMarketMastercopyDeployed.deployed();

	console.log(
		'binaryOptionMarketMastercopy deployed to:',
		binaryOptionMarketMastercopyDeployed.address
	);

	const BinaryOptionMarketFactory = await ethers.getContractFactory('BinaryOptionMarketFactory');
	const binaryOptionMarketFactoryDeployed = await BinaryOptionMarketFactory.deploy(owner.address);
	await binaryOptionMarketFactoryDeployed.deployed();

	console.log('BinaryOptionMarketFactory deployed to:', binaryOptionMarketFactoryDeployed.address);

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
	const binaryOptionMarketManagerDeployed = await BinaryOptionMarketManager.deploy(
		owner.address,
		addressResolver.address,
		maxOraclePriceAge,
		expiryDuration,
		maxTimeToMaturity,
		creatorCapitalRequirement,
		poolFee,
		creatorFee,
		feeAddress
	);
	await binaryOptionMarketManagerDeployed.deployed();

	console.log('binaryOptionMarketManager deployed to:', binaryOptionMarketManagerDeployed.address);

	const BinaryOptionMarketData = await ethers.getContractFactory('BinaryOptionMarketData');
	const binaryOptionMarketData = await BinaryOptionMarketData.deploy();
	await binaryOptionMarketData.deployed();

	console.log('binaryOptionMarketData deployed to:', binaryOptionMarketData.address);

	await binaryOptionMarketFactoryDeployed.setBinaryOptionMarketManager(
		binaryOptionMarketManagerDeployed.address
	);
	await binaryOptionMarketFactoryDeployed.setBinaryOptionMarketMastercopy(
		binaryOptionMarketMastercopyDeployed.address
	);
	await binaryOptionMarketFactoryDeployed.setBinaryOptionMastercopy(
		binaryOptionMastercopyDeployed.address
	);

	await binaryOptionMarketManagerDeployed.setBinaryOptionsMarketFactory(
		binaryOptionMarketFactoryDeployed.address
	);

	await hre.run('verify:verify', {
		address: binaryOptionMarketManagerDeployed.address,
		constructorArguments: [
			owner.address,
			addressResolver.address,
			maxOraclePriceAge,
			expiryDuration,
			maxTimeToMaturity,
			creatorCapitalRequirement,
			poolFee,
			creatorFee,
			feeAddress,
		],
	});

	await hre.run('verify:verify', {
		address: binaryOptionMarketFactoryDeployed.address,
		constructorArguments: [owner.address],
	});

	await hre.run('verify:verify', {
		address: binaryOptionMastercopyDeployed.address,
		constructorArguments: [],
		contract: 'contracts/BinaryOptionMastercopy.sol:BinaryOptionMastercopy',
	});

	await hre.run('verify:verify', {
		address: binaryOptionMarketMastercopyDeployed.address,
		constructorArguments: [],
		contract: 'contracts/BinaryOptionMarketMastercopy.sol:BinaryOptionMarketMastercopy',
	});

	await hre.run('verify:verify', {
		address: binaryOptionMarketData.address,
		constructorArguments: [],
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

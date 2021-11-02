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

	const ProxyERC20sUSD = snx.getTarget({ network, contract: 'ProxyERC20sUSD' });
	console.log('Found ProxyERC20sUSD at:' + ProxyERC20sUSD.address);

	const safeDecimalMath = snx.getTarget({ network, contract: 'SafeDecimalMath' });
	console.log('Found safeDecimalMath at:' + safeDecimalMath.address);

	const priceFeedAddress = getTargetAddress('PriceFeed', network);
	console.log('Found PriceFeed at:' + priceFeedAddress);

	// We get the contract to deploy
	const BinaryOptionMastercopy = await ethers.getContractFactory('BinaryOptionMastercopy');
	const binaryOptionMastercopyDeployed = await BinaryOptionMastercopy.deploy();
	await binaryOptionMastercopyDeployed.deployed();

	console.log('BinaryOptionMastercopy deployed to:', binaryOptionMastercopyDeployed.address);
	setTargetAddress('BinaryOptionMastercopy', network, binaryOptionMastercopyDeployed.address);

	const BinaryOptionMarketMastercopy = await ethers.getContractFactory(
		'BinaryOptionMarketMastercopy'
	);
	const binaryOptionMarketMastercopyDeployed = await BinaryOptionMarketMastercopy.deploy();
	await binaryOptionMarketMastercopyDeployed.deployed();

	console.log(
		'binaryOptionMarketMastercopy deployed to:',
		binaryOptionMarketMastercopyDeployed.address
	);
	setTargetAddress('BinaryOptionMarketMastercopy', network, binaryOptionMarketMastercopyDeployed.address);

	const BinaryOptionMarketFactory = await ethers.getContractFactory('BinaryOptionMarketFactory');
	const binaryOptionMarketFactoryDeployed = await BinaryOptionMarketFactory.deploy(owner.address);
	await binaryOptionMarketFactoryDeployed.deployed();

	console.log('BinaryOptionMarketFactory deployed to:', binaryOptionMarketFactoryDeployed.address);
	setTargetAddress('BinaryOptionMarketFactory', network, binaryOptionMarketFactoryDeployed.address);

	const day = 24 * 60 * 60;
	const expiryDuration = 26 * 7 * day; // Six months to exercise options before the market is destructible.
	const maxTimeToMaturity = 730 * day; // Markets may not be deployed more than two years in the future.
	let creatorCapitalRequirement = w3utils.toWei('1'); // 1 sUSD is required to create a new market for testnet, 1000 for mainnet.
	if (network == 'mainnet') {
		creatorCapitalRequirement = w3utils.toWei('1000');
	}

	const BinaryOptionMarketManager = await ethers.getContractFactory('BinaryOptionMarketManager');
	const binaryOptionMarketManagerDeployed = await BinaryOptionMarketManager.deploy(
		owner.address,
		ProxyERC20sUSD.address,
		priceFeedAddress,
		expiryDuration,
		maxTimeToMaturity,
		creatorCapitalRequirement
	);
	await binaryOptionMarketManagerDeployed.deployed();

	console.log('binaryOptionMarketManager deployed to:', binaryOptionMarketManagerDeployed.address);

	setTargetAddress('BinaryOptionMarketManager', network, binaryOptionMarketManagerDeployed.address);

	const BinaryOptionMarketData = await ethers.getContractFactory('BinaryOptionMarketData');
	const binaryOptionMarketData = await BinaryOptionMarketData.deploy();
	await binaryOptionMarketData.deployed();

	console.log('binaryOptionMarketData deployed to:', binaryOptionMarketData.address);

	setTargetAddress('BinaryOptionMarketData', network, binaryOptionMarketData.address);

	let tx = await binaryOptionMarketFactoryDeployed.setBinaryOptionMarketManager(
		binaryOptionMarketManagerDeployed.address
	);
	await tx.wait().then(e => {
		console.log('BinaryOptionMarketFactory: setBinaryOptionMarketManager');
	});
	tx = await binaryOptionMarketFactoryDeployed.setBinaryOptionMarketMastercopy(
		binaryOptionMarketMastercopyDeployed.address
	);
	await tx.wait().then(e => {
		console.log('BinaryOptionMarketFactory: setBinaryOptionMarketMastercopy');
	});
	tx = await binaryOptionMarketFactoryDeployed.setBinaryOptionMastercopy(
		binaryOptionMastercopyDeployed.address
	);
	await tx.wait().then(e => {
		console.log('BinaryOptionMarketFactory: setBinaryOptionMastercopy');
	});
	tx = await binaryOptionMarketManagerDeployed.setBinaryOptionsMarketFactory(
		binaryOptionMarketFactoryDeployed.address
	);
	await tx.wait().then(e => {
		console.log('BinaryOptionMarketManager: setBinaryOptionsMarketFactory');
	});

	await hre.run('verify:verify', {
		address: binaryOptionMarketFactoryDeployed.address,
		constructorArguments: [owner.address],
	});

	await hre.run('verify:verify', {
		address: binaryOptionMastercopyDeployed.address,
		constructorArguments: [],
		contract: "contracts/BinaryOptions/BinaryOptionMastercopy.sol:BinaryOptionMastercopy"
	});

	await hre.run('verify:verify', {
		address: binaryOptionMarketMastercopyDeployed.address,
		constructorArguments: [],
		contract: "contracts/BinaryOptions/BinaryOptionMarketMastercopy.sol:BinaryOptionMarketMastercopy",
	});

	await hre.run('verify:verify', {
		address: binaryOptionMarketData.address,
		constructorArguments: [],
	});

	await hre.run('verify:verify', {
		address: binaryOptionMarketManagerDeployed.address,
		constructorArguments: [
			owner.address,
			ProxyERC20sUSD.address,
			priceFeedAddress,
			expiryDuration,
			maxTimeToMaturity,
			creatorCapitalRequirement,
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
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}

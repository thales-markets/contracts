const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let priceFeedAddress, ProxyERC20sUSDaddress;

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimistic';
		network = 'optimistic';
	}

	if (networkObj.chainId == 10) {
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	} else if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	} else {
		const ProxyERC20sUSD = snx.getTarget({ network, contract: 'ProxyERC20sUSD' });
		ProxyERC20sUSDaddress = ProxyERC20sUSD.address;
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + network);

	console.log('Found ProxyERC20sUSD at:' + ProxyERC20sUSDaddress);

	if (network == 'ropsten') {
		const ropstenPriceFeed = await ethers.getContractFactory('MockPriceFeed');
		PriceFeedDeployed = await ropstenPriceFeed.deploy(owner.address);
		await PriceFeedDeployed.deployed();
		setTargetAddress('PriceFeed', network, PriceFeedDeployed.address);
		setTargetAddress('MockPriceFeed', network, PriceFeedDeployed.address);
		console.log('MockPriceFeed deployed to:', PriceFeedDeployed.address);
		await PriceFeedDeployed.setPricetoReturn(w3utils.toWei('1000'));
		priceFeedAddress = PriceFeedDeployed.address;
		console.log('Adding aggregator', snx.toBytes32('ETH'), owner.address);
		await PriceFeedDeployed.addAggregator(snx.toBytes32('ETH'), owner.address);
	} else {
		priceFeedAddress = getTargetAddress('PriceFeed', network);
		console.log('Found PriceFeed at:' + priceFeedAddress);
	}

	// // We get the contract to deploy
	const PositionMastercopy = await ethers.getContractFactory('PositionMastercopy');
	const PositionMastercopyDeployed = await PositionMastercopy.deploy();
	await PositionMastercopyDeployed.deployed();

	console.log('PositionMastercopy deployed to:', PositionMastercopyDeployed.address);
	setTargetAddress('PositionMastercopy', network, PositionMastercopyDeployed.address);

	const PositionalMarketMastercopy = await ethers.getContractFactory(
		'PositionalMarketMastercopy'
	);
	const PositionalMarketMastercopyDeployed = await PositionalMarketMastercopy.deploy();
	await PositionalMarketMastercopyDeployed.deployed();

	console.log(
		'PositionalMarketMastercopy deployed to:',
		PositionalMarketMastercopyDeployed.address
	);
	setTargetAddress(
		'PositionalMarketMastercopy',
		network,
		PositionalMarketMastercopyDeployed.address
	);

	const PositionalMarketFactory = await ethers.getContractFactory('PositionalMarketFactory');

	const PositionalMarketFactoryAddress = getTargetAddress('PositionalMarketFactory', network);
	const PositionalMarketFactoryDeployed = await PositionalMarketFactory.attach(
		PositionalMarketFactoryAddress
	);

	const day = 24 * 60 * 60;
	const expiryDuration = 26 * 7 * day; // Six months to exercise options before the market is destructible.
	const maxTimeToMaturity = 730 * day; // Markets may not be deployed more than two years in the future.
	let creatorCapitalRequirement = w3utils.toWei('1'); // 1 sUSD is required to create a new market for testnet, 1000 for mainnet.
	if (network == 'mainnet') {
		creatorCapitalRequirement = w3utils.toWei('1000');
	}

	const PositionalMarketManager = await ethers.getContractFactory('PositionalMarketManager');
	const PositionalMarketManagerDeployed = await PositionalMarketManager.deploy(
		owner.address,
		ProxyERC20sUSDaddress,
		priceFeedAddress,
		expiryDuration,
		maxTimeToMaturity,
		creatorCapitalRequirement
	);
	await PositionalMarketManagerDeployed.deployed();

	console.log('PositionalMarketManager deployed to:', PositionalMarketManagerDeployed.address);

	setTargetAddress('PositionalMarketManager', network, PositionalMarketManagerDeployed.address);

	let tx = await PositionalMarketFactoryDeployed.setPositionalMarketMastercopy(
		PositionalMarketMastercopyDeployed.address
	);
	await tx.wait().then(e => {
		console.log('PositionalMarketFactory: setPositionalMarketMastercopy');
	});

	 tx = await PositionalMarketFactoryDeployed.setPositionalMarketManager(
		PositionalMarketManagerDeployed.address
	);
	await tx.wait().then(e => {
		console.log('PositionalMarketFactory: setPositionalMarketManager');
	});
	tx = await PositionalMarketManagerDeployed.setPositionalMarketFactory(
		PositionalMarketFactoryDeployed.address
	);
	await tx.wait().then(e => {
		console.log('PositionalMarketManager: setPositionalMarketFactory');
	});

	tx = await PositionalMarketFactoryDeployed.setPositionMastercopy(
		PositionMastercopyDeployed.address
	);
	await tx.wait().then(e => {
		console.log('PositionalMarketFactory: setPositionMastercopy');
	});

	await hre.run('verify:verify', {
		address: PositionMastercopyDeployed.address,
		constructorArguments: [],
		contract: 'contracts/Positions/PositionMastercopy.sol:PositionMastercopy',
	});

	await hre.run('verify:verify', {
		address: PositionalMarketMastercopyDeployed.address,
		constructorArguments: [],
		contract:
			'contracts/Positions/PositionalMarketMastercopy.sol:PositionalMarketMastercopy',
	});

	await hre.run('verify:verify', {
		address: PositionalMarketManagerDeployed.address,
		constructorArguments: [
			owner.address,
			ProxyERC20sUSDaddress,
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
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}

const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix');

const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../test/utils')();

const { toBN } = web3.utils;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const { toBytes32 } = require('../../index');
const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	console.log('Account is:' + owner.address);
	console.log('Network name:' + networkObj.name);

	const addressResolver = snx.getTarget({ network, contract: 'ReadProxyAddressResolver' });
	console.log('Found address resolver at:' + addressResolver.address);

	const safeDecimalMath = snx.getTarget({ network, contract: 'SafeDecimalMath' });
	console.log('Found safeDecimalMath at:' + safeDecimalMath.address);

	const ProxyERC20sUSD = snx.getTarget({ network, contract: 'ProxyERC20sUSD' });
	console.log('Found ProxyERC20sUSD at:' + ProxyERC20sUSD.address);

	const priceFeedAddress = getTargetAddress('PriceFeed', network);
	console.log('Found PriceFeed at:' + priceFeedAddress);

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
		'binaryOptionMarketMastercopyDeployed deployed to:',
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
	const creatorCapitalRequirement = w3utils.toWei('1'); // 1000 sUSD is required to create a new market.
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
		priceFeedAddress,
		expiryDuration,
		maxTimeToMaturity,
		creatorCapitalRequirement,
		poolFee,
		creatorFee,
		feeAddress
	);
	await binaryOptionMarketManagerDeployed.deployed();

	console.log(
		'binaryOptionMarketManagerDeployed deployed to:',
		binaryOptionMarketManagerDeployed.address
	);

	setTargetAddress('BinaryOptionMarketManager', network, binaryOptionMarketManagerDeployed.address);

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

	console.log('All params set');

	const JPYkey = toBytes32('JPY');
	const initialStrikePrice = w3utils.toWei('1');
	const now = await currentTime();

	let abi = ["function approve(address _spender, uint256 _value) public returns (bool success)"]
	let contract = new ethers.Contract(ProxyERC20sUSD.address, abi, owner);
	tx = await contract.approve(binaryOptionMarketManagerDeployed.address, initialStrikePrice, {
		from: owner.address,
	});
	await tx.wait().then(e => {
		console.log('Done approving');
	});
	
	tx = await binaryOptionMarketManagerDeployed.createMarket(
		JPYkey,
		initialStrikePrice,
		now + 360,
		initialStrikePrice,
		false,
		ZERO_ADDRESS,
		{ gasLimit: 5500000 }
	);
	await tx.wait().then(e => {
		console.log('Market created');
	});
	
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

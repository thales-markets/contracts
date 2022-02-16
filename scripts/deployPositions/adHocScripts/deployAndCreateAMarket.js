const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');

const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../../test/utils')();

const { toBN } = web3.utils;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const { toBytes32 } = require('../../../index');
const { getTargetAddress, setTargetAddress } = require('../../helpers');

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
	const PositionMastercopy = await ethers.getContractFactory('PositionMastercopy');
	const PositionMastercopyDeployed = await PositionMastercopy.deploy();
	await PositionMastercopyDeployed.deployed();

	console.log('PositionMastercopy deployed to:', PositionMastercopyDeployed.address);

	const PositionalMarketMastercopy = await ethers.getContractFactory(
		'PositionalMarketMastercopy',
		{
			libraries: {
				SafeDecimalMath: safeDecimalMath.address,
			},
		}
	);
	const PositionalMarketMastercopyDeployed = await PositionalMarketMastercopy.deploy();
	await PositionalMarketMastercopyDeployed.deployed();

	console.log(
		'PositionalMarketMastercopyDeployed deployed to:',
		PositionalMarketMastercopyDeployed.address
	);

	const PositionalMarketFactory = await ethers.getContractFactory('PositionalMarketFactory');
	const PositionalMarketFactoryDeployed = await PositionalMarketFactory.deploy(owner.address);
	await PositionalMarketFactoryDeployed.deployed();

	console.log('PositionalMarketFactory deployed to:', PositionalMarketFactoryDeployed.address);

	const day = 24 * 60 * 60;
	const maxOraclePriceAge = 120 * 60; // Price updates are accepted from up to two hours before maturity to allow for delayed chainlink heartbeats.
	const expiryDuration = 26 * 7 * day; // Six months to exercise options before the market is destructible.
	const maxTimeToMaturity = 730 * day; // Markets may not be deployed more than two years in the future.
	const creatorCapitalRequirement = w3utils.toWei('1'); // 1000 sUSD is required to create a new market.
	const poolFee = w3utils.toWei('0.005'); // 0.5% of the market's value goes to the pool in the end.
	const creatorFee = w3utils.toWei('0.005'); // 0.5% of the market's value goes to the creator.
	const feeAddress = '0xfeefeefeefeefeefeefeefeefeefeefeefeefeef';

	const PositionalMarketManager = await ethers.getContractFactory('PositionalMarketManager', {
		libraries: {
			SafeDecimalMath: safeDecimalMath.address,
		},
	});

	const PositionalMarketManagerDeployed = await PositionalMarketManager.deploy(
		owner.address,
		addressResolver.address,
		priceFeedAddress,
		expiryDuration,
		maxTimeToMaturity,
		creatorCapitalRequirement
	);
	await PositionalMarketManagerDeployed.deployed();

	console.log(
		'PositionalMarketManagerDeployed deployed to:',
		PositionalMarketManagerDeployed.address
	);

	setTargetAddress('PositionalMarketManager', network, PositionalMarketManagerDeployed.address);

	let tx = await PositionalMarketFactoryDeployed.setPositionalMarketManager(
		PositionalMarketManagerDeployed.address
	);
	await tx.wait().then(e => {
		console.log('PositionalMarketFactory: setPositionalMarketManager');
	});
	tx = await PositionalMarketFactoryDeployed.setPositionalMarketMastercopy(
		PositionalMarketMastercopyDeployed.address
	);
	await tx.wait().then(e => {
		console.log('PositionalMarketFactory: setPositionalMarketMastercopy');
	});
	tx = await PositionalMarketFactoryDeployed.setPositionMastercopy(
		PositionMastercopyDeployed.address
	);
	await tx.wait().then(e => {
		console.log('PositionalMarketFactory: setPositionMastercopy');
	});
	tx = await PositionalMarketManagerDeployed.setPositionalMarketFactory(
		PositionalMarketFactoryDeployed.address
	);
	await tx.wait().then(e => {
		console.log('PositionalMarketManager: setPositionalMarketFactory');
	});

	console.log('All params set');

	const JPYkey = toBytes32('JPY');
	const initialStrikePrice = w3utils.toWei('1');
	const now = await currentTime();

	let abi = ["function approve(address _spender, uint256 _value) public returns (bool success)"]
	let contract = new ethers.Contract(ProxyERC20sUSD.address, abi, owner);
	tx = await contract.approve(PositionalMarketManagerDeployed.address, initialStrikePrice, {
		from: owner.address,
	});
	await tx.wait().then(e => {
		console.log('Done approving');
	});
	
	tx = await PositionalMarketManagerDeployed.createMarket(
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

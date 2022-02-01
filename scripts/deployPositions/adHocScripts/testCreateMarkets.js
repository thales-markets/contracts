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


	if(networkObj.chainId === 69) {
		network = "optimisticKovan";
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + network);

	// const safeDecimalMath = snx.getTarget({ network, contract: 'SafeDecimalMath' });
	// console.log('Found safeDecimalMath at:' + safeDecimalMath.address);

	// const ProxyERC20sUSD = snx.getTarget({ network, contract: 'ProxysUSD' });
	// console.log('Found ProxyERC20sUSD at:' + ProxyERC20sUSD.address);
	const ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);

	const priceFeedAddress = getTargetAddress('PriceFeed', network);
	console.log('Found PriceFeed at:' + priceFeedAddress);

	const PositionalMarketManager = await ethers.getContractFactory('PositionalMarketManager');

	const PositionalMarketManagerAddress = getTargetAddress('PositionalMarketManager', network);
	const PositionalMarketManagerDeployed = await PositionalMarketManager.attach(
		PositionalMarketManagerAddress
	);

	console.log(
		'PositionalMarketManagerDeployed deployed to:',
		PositionalMarketManagerDeployed.address
	);

	const LINKkey = toBytes32('LINK');
	const initialStrikePrice = w3utils.toWei('1');
	const now = await currentTime();

	let abi = ['function approve(address _spender, uint256 _value) public returns (bool success)'];
	let contract = new ethers.Contract(ProxyERC20sUSDaddress, abi, owner);
	tx = await contract.approve(PositionalMarketManagerDeployed.address, initialStrikePrice, {
		from: owner.address,
	});
	await tx.wait().then(e => {
		console.log('Done approving');
	});

	tx = await PositionalMarketManagerDeployed.createMarket(
		LINKkey,
		initialStrikePrice,
		now + 3600,
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

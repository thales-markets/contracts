const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const { artifacts, contract, web3 } = require('hardhat');
const snx = require('synthetix');

const { toBN } = web3.utils;

const { toBytes32 } = require('..');

const util = require('util');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let fundingAmount = w3utils.toWei('1');
	if (network == 'homestead') {
		network = 'mainnet';
		fundingAmount = w3utils.toWei('1000');
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + networkObj.name);

	const addressResolver = snx.getTarget({ network, contract: 'ReadProxyAddressResolver' });
	console.log('Found address resolver at:' + addressResolver.address);

	const safeDecimalMath = snx.getTarget({ network, contract: 'SafeDecimalMath' });
	console.log('Found safeDecimalMath at:' + safeDecimalMath.address);

	const BinaryOptionMarketManager = await ethers.getContractFactory('BinaryOptionMarketManager', {
		libraries: {
			SafeDecimalMath: safeDecimalMath.address,
		},
	});
	let manager = await BinaryOptionMarketManager.attach(
		'0x16a8c0dC77e11BCB25389e6d95eeBB2Fd9c2FdF2'
	);

	console.log('found manager at:' + manager.address);

	let IntegersContract = await ethers.getContractFactory('Integers');
	const integersDeployed = await IntegersContract.deploy();
	await integersDeployed.deployed();

	console.log('integersDeployed deployed to:', integersDeployed.address);

	let SportFeedContract = await ethers.getContractFactory('SportFeed');
	const sportFeedContractDeployed = await SportFeedContract.deploy(
		owner.address,
		'0x56dd6586db0d08c6ce7b2f2805af28616e082455',
		toBytes32('aa34467c0b074fb0888c9f42c449547f'),
		w3utils.toWei('1')
	);
	await sportFeedContractDeployed.deployed();

	console.log('sportFeedContractDeployed deployed to:', sportFeedContractDeployed.address);

	let SportFeedOracleInstanceContract = await ethers.getContractFactory('SportFeedOracleInstance', {
		libraries: {
			Integers: integersDeployed.address,
		},
	});

	let maturityDate = Math.round(Date.parse('09 AUG 2021 00:00:00 GMT') / 1000);

	const ProxyERC20sUSD = snx.getTarget({ network, contract: 'ProxyERC20sUSD' });
	console.log('Found ProxyERC20sUSD at:' + ProxyERC20sUSD.address);
	let abi = ['function approve(address _spender, uint256 _value) public returns (bool success)'];
	let contract = new ethers.Contract(ProxyERC20sUSD.address, abi, owner);
	await contract.approve(manager.address, w3utils.toWei('10000'), {
		from: owner.address,
	});
	console.log('Done approving');

	let oracleAddress = createOracleInstance(
		SportFeedOracleInstanceContract,
		owner.address,
		sportFeedContractDeployed.address,
		'USA',
		'1',
		'Olympics Medal Count'
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleAddress);

	oracleAddress = createOracleInstance(
		SportFeedOracleInstanceContract,
		owner.address,
		sportFeedContractDeployed.address,
		'CHN',
		'1',
		'Olympics Medal Count'
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleAddress);

	oracleAddress = createOracleInstance(
		SportFeedOracleInstanceContract,
		owner.address,
		sportFeedContractDeployed.address,
		'GBR',
		'1',
		'Olympics Medal Count'
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleAddress);

	await hre.run('verify:verify', {
		address: integersDeployed.address,
	});

	await hre.run('verify:verify', {
		address: sportFeedContractDeployed.address,
		constructorArguments: [
			owner.address,
			'0x56dd6586db0d08c6ce7b2f2805af28616e082455',
			toBytes32('aa34467c0b074fb0888c9f42c449547f'),
			w3utils.toWei('1'),
		],
		contract: 'contracts/SportFeed.sol:SportFeed',
	});

	await hre.run('verify:verify', {
		address: sportFeedOracleInstanceContractDeployed.address,
		constructorArguments: [
			owner.address,
			sportFeedContractDeployed.address,
			'USA',
			'1',
			'Olympics Medal Count',
		],
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

async function createMarket(
	manager,
	maturityDate,
	fundingAmount,
	sportFeedOracleInstanceContractDeployedAddress
) {
	const result = await manager.createMarket(
		toBytes32(''),
		0,
		maturityDate,
		fundingAmount,
		true,
		sportFeedOracleInstanceContractDeployedAddress,
		{ gasLimit: 5500000 }
	);

	console.log(util.inspect(result, false, null, true /* enable colors */));

	result.wait().then(function(receipt) {
		console.log('receipt is:');
		console.log(util.inspect(receipt, false, null, true /* enable colors */));
		//console.log('Market created at ' + result.address);
	});


}

async function createOracleInstance(
	SportFeedOracleInstanceContract,
	ownerAddress,
	sportFeedContractDeployedAddress,
	country,
	place,
	eventName
) {
	const sportFeedOracleInstanceContractDeployed = await SportFeedOracleInstanceContract.deploy(
		ownerAddress,
		sportFeedContractDeployedAddress,
		country,
		place,
		eventName
	);
	await sportFeedOracleInstanceContractDeployed.deployed();

	console.log(
		'sportFeedOracleInstanceContractDeployed deployed to:',
		sportFeedOracleInstanceContractDeployed.address
	);
	console.log('with params country ' + country + ' place ' + place + ' event ' + eventName);

	return sportFeedOracleInstanceContractDeployed.address;
}

function getEventByName({ tx, name }) {
	return tx.logs.find(({ event }) => event === name);
}

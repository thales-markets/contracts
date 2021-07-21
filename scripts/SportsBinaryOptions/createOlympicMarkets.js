const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const { artifacts, contract, web3 } = require('hardhat');
const snx = require('synthetix');

const { toBN } = web3.utils;

const { toBytes32 } = require('../../index');

const util = require('util');

//let managerAddress = '0x30C1d1BE9E33696F8dd9FDf3430c36FCd73436cB'; //kovan
let managerAddress = '0x3e4E650f61C7A747A4baDCfF5C3b3e2BaF37AEc3'; //ropsten

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
	let manager = await BinaryOptionMarketManager.attach(managerAddress);

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

	let oracleAddress = await createOracleInstance(
		SportFeedOracleInstanceContract,
		owner.address,
		sportFeedContractDeployed.address,
		'USA',
		'1',
		'Olympics Medal Count'
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleAddress);

	oracleAddress = await createOracleInstance(
		SportFeedOracleInstanceContract,
		owner.address,
		sportFeedContractDeployed.address,
		'CHN',
		'1',
		'Olympics Medal Count'
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleAddress);

	oracleAddress = await createOracleInstance(
		SportFeedOracleInstanceContract,
		owner.address,
		sportFeedContractDeployed.address,
		'JPN',
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

	console.log('tryng to verify contract SportFeedOracleInstance at address ' + oracleAddress);
	await hre.run('verify:verify', {
		address: oracleAddress,
		constructorArguments: [
			owner.address,
			sportFeedContractDeployed.address,
			'JPN',
			'1',
			'Olympics Medal Count',
		],
		contract: 'contracts/SportFeedOracleInstance.sol:SportFeedOracleInstance',
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

	await result.wait().then(function(receipt) {
		let marketCreationArgs = receipt.events[receipt.events.length - 1].args;
		for (var key in marketCreationArgs) {
			if (marketCreationArgs.hasOwnProperty(key)) {
				if (key == 'market') {
					console.log('Market created at ' + marketCreationArgs[key]);
				}
			}
		}
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

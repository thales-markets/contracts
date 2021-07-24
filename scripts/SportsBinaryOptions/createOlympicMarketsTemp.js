const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const { artifacts, contract, web3 } = require('hardhat');
const snx = require('synthetix');

const { toBN } = web3.utils;

const { toBytes32 } = require('../../index');

const util = require('util');

//let managerAddress = '0x30C1d1BE9E33696F8dd9FDf3430c36FCd73436cB'; //kovan
let managerAddress = '0x46d9DB2830C005e38878b241199bb09d9d355994'; //ropsten

//kovan
let oracleContract = '0x56dd6586db0d08c6ce7b2f2805af28616e082455';
let sportsJobId = '8c542e93a2504cfb9d140115d12e5173';
let medalJobId = 'aa34467c0b074fb0888c9f42c449547f';

//mainnet
//let oracleContract = '0x240BaE5A27233Fd3aC5440B5a598467725F7D1cd';
//let sportsJobId = '91f1c37fc39e4c839afc3c1615c6fcab';
//let medalJobId = 'f3f4feaae7814acfb01f05ce3092b0bd';

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

	let SportFeedContract = await ethers.getContractFactory('SportFeed');

	const sportFeedContractDeployedVolleyball = await SportFeedContract.deploy(
		owner.address,
		'0x56dd6586db0d08c6ce7b2f2805af28616e082455',
		toBytes32('aa34467c0b074fb0888c9f42c449547f'),
		w3utils.toWei('1'),
		'sports',
		'2020',
		'VVO',
		'M'
	);
	await sportFeedContractDeployedVolleyball.deployed();
	console.log(
		'sportFeedContractDeployedVolleyball deployed to:',
		sportFeedContractDeployedVolleyball.address
	);

	let oracleAddress2 = await createOracleInstance(
		SportFeedOracleInstanceContract,
		owner.address,
		sportFeedContractDeployedVolleyball.address,
		'RUS',
		'1',
		'Olympics Volleyball Rankings (m)'
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleAddress2);
	await hre.run('verify:verify', {
		address: oracleAddress2,
		constructorArguments: [
			owner.address,
			sportFeedContractDeployedVolleyball.address,
			'RUS',
			'1',
			'Olympics Volleyball Rankings (m)'
		],
		contract: 'contracts/SportFeedOracleInstance.sol:SportFeedOracleInstance',
	});



	//-----verifications

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
			'medals',
			'2020',
			'',
			'',
		],
		contract: 'contracts/SportFeed.sol:SportFeed',
	});

	await hre.run('verify:verify', {
		address: '0x686634E6bc6D6BFBF9C3e90f13B2adC0A68B762F',
		constructorArguments: [
			owner.address,
			'0x56dd6586db0d08c6ce7b2f2805af28616e082455',
			toBytes32('aa34467c0b074fb0888c9f42c449547f'),
			w3utils.toWei('1'),
			'sports',
			'2020',
			'BK',
			'M',
		],
		contract: 'contracts/SportFeed.sol:SportFeed',
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

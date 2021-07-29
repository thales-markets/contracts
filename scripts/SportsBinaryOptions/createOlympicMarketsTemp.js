const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const { artifacts, contract, web3 } = require('hardhat');
const snx = require('synthetix');

const { toBN } = web3.utils;

const { toBytes32 } = require('../../index');

const util = require('util');

//let managerAddress = '0x30C1d1BE9E33696F8dd9FDf3430c36FCd73436cB'; //kovan
let managerAddress = '0x5ed98Ebb66A929758C7Fe5Ac60c979aDF0F4040a'; //ropsten

//kovan
// let oracleContract = '0x56dd6586db0d08c6ce7b2f2805af28616e082455';
// let sportsJobId = '8c542e93a2504cfb9d140115d12e5173';
// let medalJobId = 'aa34467c0b074fb0888c9f42c449547f';

//mainnet
let oracleContract = '0x240bae5a27233fd3ac5440b5a598467725f7d1cd';
let sportsJobId = '91f1c37fc39e4c839afc3c1615c6fcab';
let medalJobId = 'f3f4feaae7814acfb01f05ce3092b0bd';

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
	const integersDeployed = await IntegersContract.attach(
		'0x6c0dFEeb57e126d2a66a71A44678Ab51b8a5B1B5'
	);

	console.log('integersDeployed deployed to:', integersDeployed.address);

	let SportFeedContract = await ethers.getContractFactory('SportFeed');
	const sportFeedContractDeployed = await SportFeedContract.attach(
		'0xEEC8109730111fE1f17D55a814e831A1a211E3a7'
	);

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

	let oracleAddress1 = '0xf0D684586F347A6Be3487f3ec4Dc1C7BC1617304';
	await createMarket(
		manager,
		maturityDate,
		fundingAmount,
		'0xf0D684586F347A6Be3487f3ec4Dc1C7BC1617304'
	);

	let oracleAddress2 = await createOracleInstance(
		SportFeedOracleInstanceContract,
		owner.address,
		sportFeedContractDeployed.address,
		'CHN',
		'1',
		'Olympics Gold Medals Ranking'
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleAddress2);

	let oracleAddress3 = await createOracleInstance(
		SportFeedOracleInstanceContract,
		owner.address,
		sportFeedContractDeployed.address,
		'JPN',
		'1',
		'Olympics Gold Medals Ranking'
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleAddress3);

	const sportFeedContractDeployedBasketball = await SportFeedContract.deploy(
		owner.address,
		oracleContract,
		toBytes32(sportsJobId),
		w3utils.toWei('1'),
		'sports',
		'2020',
		'BKB',
		'M'
	);
	await sportFeedContractDeployedBasketball.deployed();
	console.log(
		'sportFeedContractDeployedBasketball deployed to:',
		sportFeedContractDeployedBasketball.address
	);

	let oracleAddress4 = await createOracleInstance(
		SportFeedOracleInstanceContract,
		owner.address,
		sportFeedContractDeployedBasketball.address,
		'USA',
		'1',
		'Olympics Basketball Rankings (m)'
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleAddress4);

	let oracleAddress5 = await createOracleInstance(
		SportFeedOracleInstanceContract,
		owner.address,
		sportFeedContractDeployedBasketball.address,
		'AUS',
		'1',
		'Olympics Basketball Rankings (m)'
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleAddress5);

	let oracleAddress6 = await createOracleInstance(
		SportFeedOracleInstanceContract,
		owner.address,
		sportFeedContractDeployedBasketball.address,
		'SLO',
		'1',
		'Olympics Basketball Rankings (m)'
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleAddress6);

	let oracleAddress7 = await createOracleInstance(
		SportFeedOracleInstanceContract,
		owner.address,
		sportFeedContractDeployedBasketball.address,
		'ESP',
		'1',
		'Olympics Basketball Rankings (m)'
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleAddress7);

	const sportFeedContractDeployedVolleyball = await SportFeedContract.deploy(
		owner.address,
		oracleContract,
		toBytes32(sportsJobId),
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

	let oracleAddress8 = await createOracleInstance(
		SportFeedOracleInstanceContract,
		owner.address,
		sportFeedContractDeployedVolleyball.address,
		'ROC',
		'1',
		'Olympics Volleyball Rankings (m)'
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleAddress8);

	let oracleAddress9 = await createOracleInstance(
		SportFeedOracleInstanceContract,
		owner.address,
		sportFeedContractDeployedVolleyball.address,
		'POL',
		'1',
		'Olympics Volleyball Rankings (m)'
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleAddress9);

	let oracleAddress10 = await createOracleInstance(
		SportFeedOracleInstanceContract,
		owner.address,
		sportFeedContractDeployedVolleyball.address,
		'USA',
		'1',
		'Olympics Volleyball Rankings (m)'
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleAddress10);

	//-----verifications

	await hre.run('verify:verify', {
		address: integersDeployed.address,
	});

	await hre.run('verify:verify', {
		address: sportFeedContractDeployed.address,
		constructorArguments: [
			owner.address,
			oracleContract,
			toBytes32(medalJobId),
			w3utils.toWei('1'),
			'medals',
			'2020',
			'',
			'',
		],
		contract: 'contracts/SportFeed.sol:SportFeed',
	});

	await hre.run('verify:verify', {
		address: oracleAddress1,
		constructorArguments: [
			owner.address,
			sportFeedContractDeployed.address,
			'USA',
			'1',
			'Olympics Gold Medals Ranking',
		],
		contract: 'contracts/SportFeedOracleInstance.sol:SportFeedOracleInstance',
	});

	await hre.run('verify:verify', {
		address: oracleAddress2,
		constructorArguments: [
			owner.address,
			sportFeedContractDeployed.address,
			'CHN',
			'1',
			'Olympics Gold Medals Ranking',
		],
		contract: 'contracts/SportFeedOracleInstance.sol:SportFeedOracleInstance',
	});

	await hre.run('verify:verify', {
		address: oracleAddress3,
		constructorArguments: [
			owner.address,
			sportFeedContractDeployed.address,
			'JPN',
			'1',
			'Olympics Gold Medals Ranking',
		],
		contract: 'contracts/SportFeedOracleInstance.sol:SportFeedOracleInstance',
	});

	await hre.run('verify:verify', {
		address: sportFeedContractDeployedBasketball.address,
		constructorArguments: [
			owner.address,
			'0x56dd6586db0d08c6ce7b2f2805af28616e082455',
			toBytes32('aa34467c0b074fb0888c9f42c449547f'),
			w3utils.toWei('1'),
			'sports',
			'2020',
			'BKB',
			'M',
		],
		contract: 'contracts/SportFeed.sol:SportFeed',
	});

	await hre.run('verify:verify', {
		address: oracleAddress4,
		constructorArguments: [
			owner.address,
			sportFeedContractDeployedBasketball.address,
			'USA',
			'1',
			'Olympics Basketball Rankings (m)',
		],
		contract: 'contracts/SportFeedOracleInstance.sol:SportFeedOracleInstance',
	});

	await hre.run('verify:verify', {
		address: oracleAddress5,
		constructorArguments: [
			owner.address,
			sportFeedContractDeployedBasketball.address,
			'AUS',
			'1',
			'Olympics Basketball Rankings (m)',
		],
		contract: 'contracts/SportFeedOracleInstance.sol:SportFeedOracleInstance',
	});

	await hre.run('verify:verify', {
		address: oracleAddress6,
		constructorArguments: [
			owner.address,
			sportFeedContractDeployedBasketball.address,
			'SLO',
			'1',
			'Olympics Basketball Rankings (m)',
		],
		contract: 'contracts/SportFeedOracleInstance.sol:SportFeedOracleInstance',
	});

	await hre.run('verify:verify', {
		address: oracleAddress7,
		constructorArguments: [
			owner.address,
			sportFeedContractDeployedBasketball.address,
			'ESP',
			'1',
			'Olympics Basketball Rankings (m)',
		],
		contract: 'contracts/SportFeedOracleInstance.sol:SportFeedOracleInstance',
	});

	await hre.run('verify:verify', {
		address: sportFeedContractDeployedVolleyball.address,
		constructorArguments: [
			owner.address,
			'0x56dd6586db0d08c6ce7b2f2805af28616e082455',
			toBytes32('aa34467c0b074fb0888c9f42c449547f'),
			w3utils.toWei('1'),
			'sports',
			'2020',
			'VVO',
			'M',
		],
		contract: 'contracts/SportFeed.sol:SportFeed',
	});

	await hre.run('verify:verify', {
		address: oracleAddress8,
		constructorArguments: [
			owner.address,
			sportFeedContractDeployedVolleyball.address,
			'ROC',
			'1',
			'Olympics Volleyball Rankings (m)',
		],
		contract: 'contracts/SportFeedOracleInstance.sol:SportFeedOracleInstance',
	});

	await hre.run('verify:verify', {
		address: oracleAddress9,
		constructorArguments: [
			owner.address,
			sportFeedContractDeployedVolleyball.address,
			'POL',
			'1',
			'Olympics Volleyball Rankings (m)',
		],
		contract: 'contracts/SportFeedOracleInstance.sol:SportFeedOracleInstance',
	});

	await hre.run('verify:verify', {
		address: oracleAddress10,
		constructorArguments: [
			owner.address,
			sportFeedContractDeployedVolleyball.address,
			'USA',
			'1',
			'Olympics Volleyball Rankings (m)',
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

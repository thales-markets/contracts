const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix');
const { artifacts, contract, web3 } = require('hardhat');

const { toBN } = web3.utils;

const { toBytes32 } = require('../../index');

// let managerAddress = '0x46d9DB2830C005e38878b241199bb09d9d355994'; //kovan
// let managerAddress = '0x4E48FA3638939D2B8e0acE9ceed724c606FEf608'; //ropsten
let managerAddress = '0x5ed98Ebb66A929758C7Fe5Ac60c979aDF0F4040a'; //real

//kovan
// let oracleContract = '0xff07c97631ff3bab5e5e5660cdf47aded8d4d4fd';
// let sportsJobId = 'fcca08dd168a4bfd9ddc48ebfa142ed7';

//mainnet
let oracleContract = '0xE5f72FaE8BFc4140CcAd16AEc92215a0a8A75EC1';
let sportsJobId = '89a498aab7ed40b5961ddeffd97bcf80';

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (network == 'homestead') {
		network = 'mainnet';
	}
	let fundingAmount = w3utils.toWei('1');
	if (network == 'mainnet') {
		network = 'mainnet';
		fundingAmount = w3utils.toWei('1000');
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + networkObj.name);

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

	let EthBurnedFeedContract = await ethers.getContractFactory('EthBurnedFeed');
	const EthBurnedFeedContractDeployed = await EthBurnedFeedContract.attach(
		'0xa4134Dec1842AFBe8e381681eA31e6EbF47865ed'
	);

	console.log('EthBurnedFeedContractDeployed deployed to:', EthBurnedFeedContractDeployed.address);
	let maturityDate = Math.round(Date.parse('1 NOV 2021 00:00:00 GMT') / 1000);

	let EthBurnedOracleInstanceContract = await ethers.getContractFactory('EthBurnedOracleInstance');
	let EthBurnedOracleInstanceDeployed = await EthBurnedOracleInstanceContract.deploy(
		owner.address,
		EthBurnedFeedContractDeployed.address,
		'ETH burned count',
		640000,
		'ETH burned count'
	);
	await EthBurnedOracleInstanceDeployed.deployed();

	await createMarket(manager, maturityDate, fundingAmount, EthBurnedOracleInstanceDeployed.address);

	EthBurnedOracleInstanceDeployed = await EthBurnedOracleInstanceContract.deploy(
		owner.address,
		EthBurnedFeedContractDeployed.address,
		'ETH burned count',
		690000,
		'ETH burned count'
	);
	await EthBurnedOracleInstanceDeployed.deployed();

	await createMarket(manager, maturityDate, fundingAmount, EthBurnedOracleInstanceDeployed.address);

	EthBurnedOracleInstanceDeployed = await EthBurnedOracleInstanceContract.deploy(
		owner.address,
		EthBurnedFeedContractDeployed.address,
		'ETH burned count',
		740000,
		'ETH burned count'
	);
	await EthBurnedOracleInstanceDeployed.deployed();

	await createMarket(manager, maturityDate, fundingAmount, EthBurnedOracleInstanceDeployed.address);

	await hre.run('verify:verify', {
		address: EthBurnedFeedContractDeployed.address,
		constructorArguments: [
			owner.address,
			oracleContract,
			toBytes32(sportsJobId),
			w3utils.toWei('1'),
			'burned-eth',
			false,
		],
		contract: 'contracts/customOracle/EthBurnedFeed.sol:EthBurnedFeed',
	});

	await hre.run('verify:verify', {
		address: EthBurnedOracleInstanceDeployed.address,
		constructorArguments: [
			owner.address,
			EthBurnedFeedContractDeployed.address,
			'ETH burned count',
			1000000,
			'ETH burned count',
		],
		contract: 'contracts/customOracle/EthBurnedOracleInstance.sol:EthBurnedOracleInstance',
	});
}

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

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

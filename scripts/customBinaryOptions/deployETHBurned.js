const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix');
const { artifacts, contract, web3 } = require('hardhat');

const { toBN } = web3.utils;

const { toBytes32 } = require('../../index');

//let managerAddress = '0x30C1d1BE9E33696F8dd9FDf3430c36FCd73436cB'; //kovan
let managerAddress = '0x5ed98Ebb66A929758C7Fe5Ac60c979aDF0F4040a'; //ropsten

//kovan
let oracleContract = '0xff07c97631ff3bab5e5e5660cdf47aded8d4d4fd';
let sportsJobId = 'fcca08dd168a4bfd9ddc48ebfa142ed7';

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
	if (network == 'homestead') {
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
	const EthBurnedFeedContractDeployed = await EthBurnedFeedContract.deploy(
		owner.address,
		oracleContract,
		toBytes32(sportsJobId),
		w3utils.toWei('0.1'),
		'burned-eth',
		false
	);
	await EthBurnedFeedContractDeployed.deployed();

	let EthBurnedOracleInstanceContract = await ethers.getContractFactory('EthBurnedOracleInstance');
	const EthBurnedOracleInstanceDeployed = await EthBurnedOracleInstanceContract.deploy(
		owner.address,
		EthBurnedFeedContractDeployed.address,
		'ETH burned count',
		1000000,
		'ETH burned count'
	);
	await EthBurnedOracleInstanceDeployed.deployed();

	console.log(
		'EthBurnedOracleInstanceDeployed deployed to:',
		EthBurnedOracleInstanceDeployed.address
	);

	let maturityDate = Math.round(Date.parse('09 AUG 2021 00:00:00 GMT') / 1000);

	const ProxyERC20sUSD = snx.getTarget({ network, contract: 'ProxyERC20sUSD' });
	console.log('Found ProxyERC20sUSD at:' + ProxyERC20sUSD.address);
	let abi = ['function approve(address _spender, uint256 _value) public returns (bool success)'];
	let contract = new ethers.Contract(ProxyERC20sUSD.address, abi, owner);
	await contract.approve(manager.address, w3utils.toWei('10000'), {
		from: owner.address,
	});
	console.log('Done approving');

	await createMarket(manager, maturityDate, fundingAmount, EthBurnedOracleInstanceDeployed.address);

	await hre.run('verify:verify', {
		address: EthBurnedFeedContractDeployed.address,
		constructorArguments: [
			owner.address,
			'0xff07c97631ff3bab5e5e5660cdf47aded8d4d4fd',
			toBytes32('fcca08dd168a4bfd9ddc48ebfa142ed7'),
			w3utils.toWei('0.1'),
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

const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const { artifacts, contract, web3 } = require('hardhat');
const snx = require('synthetix-2.50.4-ovm');

const { toBN } = web3.utils;

const { toBytes32 } = require('../../index');

const util = require('util');

//let managerAddress = '0x46d9DB2830C005e38878b241199bb09d9d355994'; //kovan
let managerAddress = '0x5ed98Ebb66A929758C7Fe5Ac60c979aDF0F4040a'; //ropsten

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

	let XYZFeed = await ethers.getContractFactory('XYZFeedInstance');

	let maturityDate = Math.round(Date.parse('31 DEC 2021 00:00:00 GMT') / 1000);

	// const ProxyERC20sUSD = snx.getTarget({ network, contract: 'ProxyERC20sUSD' });
	// console.log('Found ProxyERC20sUSD at:' + ProxyERC20sUSD.address);
	// let abi = ['function approve(address _spender, uint256 _value) public returns (bool success)'];
	// let contract = new ethers.Contract(ProxyERC20sUSD.address, abi, owner);
	// await contract.approve(manager.address, w3utils.toWei('10000'), {
	// 	from: owner.address,
	// });
	// console.log('Done approving');

	let xyzInstance = await XYZFeed.attach('0xb69c203C0E632553Bb6c1c09342F62Ad18eA293D').address;
	// await createMarket(manager, maturityDate, fundingAmount, xyzInstance);
	//
	//
	// maturityDate = Math.round(Date.parse('31 DEC 2022 00:00:00 GMT') / 1000);
	// let xyzInstance2 = await createXyzInstance(
	// 	XYZFeed,
	// 	owner.address,
	// 	'0x2400bf0a2b50882505480a41Be3c21e878cb9c45',
	// 	1000,
	// 	'XYZ airdrop claims',
	// 	'1000',
	// 	'XYZ airdrop claims'
	// );
	// await createMarket(manager, maturityDate, fundingAmount, xyzInstance2);

	//-----verifications

	await hre.run('verify:verify', {
		address: xyzInstance,
		constructorArguments: [
			owner.address,
			'0x2400bf0a2b50882505480a41Be3c21e878cb9c45',
			100,
			'XYZ airdrop claims',
			'100',
			'XYZ airdrop claims',
		],
		contract: 'contracts/customOracle/XYZFeedInstance.sol:XYZFeedInstance',
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

async function createXyzInstance(
	xyzContract,
	ownerAddress,
	xyzContractAddress,
	competitor,
	country,
	place,
	eventName
) {
	const xyzContractDeployed = await xyzContract.deploy(
		ownerAddress,
		xyzContractAddress,
		competitor,
		country,
		place,
		eventName
	);
	await xyzContractDeployed.deployed();

	console.log('xyzContractDeployed deployed to:', xyzContractDeployed.address);
	console.log(
		'with params country ' + country + ' place ' + place + ' event ' + eventName,
		+' competitor ' + competitor
	);

	return xyzContractDeployed.address;
}

function getEventByName({ tx, name }) {
	return tx.logs.find(({ event }) => event === name);
}

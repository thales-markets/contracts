const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const { artifacts, contract, web3 } = require('hardhat');
const snx = require('synthetix');

const { toBN } = web3.utils;

const { toBytes32 } = require('../../index');

const util = require('util');

//let managerAddress = '0x46d9DB2830C005e38878b241199bb09d9d355994'; //kovan
let managerAddress = '0x5ed98Ebb66A929758C7Fe5Ac60c979aDF0F4040a'; //ropsten

//mainnet
let oracleContract = '0x240bae5a27233fd3ac5440b5a598467725f7d1cd';
let sportsJobId = 'acf70463387c465d96d20987dfb752fa';

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

	//-----verifications

	await hre.run('verify:verify', {
		address: '0xcbb917a76FCE89575b3fCf7E51D6666ee0F5D2c8',
		constructorArguments: [
			owner.address,
			oracleContract,
			toBytes32(sportsJobId),
			w3utils.toWei('1'),
			'2020',
		],
		contract: 'contracts/SportOracles/USOpenFeed.sol:USOpenFeed',
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
	USFeedOracleContract,
	ownerAddress,
	sportFeedContractDeployedAddress,
	competitor,
	country,
	place,
	eventName
) {
	const USFeedOracleContractDeployed = await USFeedOracleContract.deploy(
		ownerAddress,
		sportFeedContractDeployedAddress,
		competitor,
		country,
		place,
		eventName
	);
	await USFeedOracleContractDeployed.deployed();

	console.log('USFeedOracleContractDeployed deployed to:', USFeedOracleContractDeployed.address);
	console.log(
		'with params country ' + country + ' place ' + place + ' event ' + eventName,
		+' competitor ' + competitor
	);

	return USFeedOracleContractDeployed.address;
}

function getEventByName({ tx, name }) {
	return tx.logs.find(({ event }) => event === name);
}

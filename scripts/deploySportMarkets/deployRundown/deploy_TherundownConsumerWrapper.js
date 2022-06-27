const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');
const { setTargetAddress, getTargetAddress } = require('../../helpers');

const { toBN } = web3.utils;

const { toBytes32 } = require('../../../index');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (network == 'homestead') {
		network = 'mainnet';
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + networkObj.name);

	if (network === 'unknown') {
		network = 'localhost';
	}

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}

	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	const payment = w3utils.toWei('0.3');

	const consumer = await ethers.getContractFactory('TherundownConsumer');
	let consumerAddress = getTargetAddress('TherundownConsumer', network);

	console.log('TherundownConsumer address: ', consumerAddress);

	const chainlink = require(`./chainlink/${network}.json`);

	console.log('LINK address: ', chainlink['LINK']);
	console.log('ORACLE address: ', chainlink['ORACLE']);

	// We get the contract to deploy
	let TherundownConsumerWrapper = await ethers.getContractFactory('TherundownConsumerWrapper');
	const TherundownConsumerWrapperDeployed = await TherundownConsumerWrapper.deploy(
		chainlink['LINK'],
		chainlink['ORACLE'],
		consumerAddress,
		payment
	);
	await TherundownConsumerWrapperDeployed.deployed();

	setTargetAddress('TherundownConsumerWrapper', network, TherundownConsumerWrapperDeployed.address);

	console.log('TherundownConsumerWrapper deployed to:', TherundownConsumerWrapperDeployed.address);

	try {
		await hre.run('verify:verify', {
			address: TherundownConsumerWrapperDeployed.address,
			constructorArguments: [chainlink['LINK'], chainlink['ORACLE'], consumerAddress],
		});
	} catch (e) {
		console.log(e);
	}
}

function delay(time) {
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

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
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}

	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	const paymentCreate = w3utils.toWei('0.01');
	const paymentResolve = w3utils.toWei('0.01');
	const paymentOdds = w3utils.toWei('0.01');

	const consumer = await ethers.getContractFactory('TherundownConsumer');
	let consumerAddress = getTargetAddress('TherundownConsumer', network);

	console.log('TherundownConsumer address: ', consumerAddress);

	const sportsAMM = await ethers.getContractFactory('SportsAMM');
	let sportsAMMAddress = getTargetAddress('SportsAMM', network);

	console.log('SportsAMM address: ', sportsAMMAddress);

	const verifier = await ethers.getContractFactory('TherundownConsumerVerifier');
	let verifierAddress = getTargetAddress('TherundownConsumerVerifier', network);

	console.log('TherundownConsumerVerifier address: ', verifierAddress);

	let oddsSpecId = '0x3230646438613738373265343436303862386438323239636566333666623638';
	console.log('oddsSpecId: ', oddsSpecId);

	const chainlink = require(`./chainlink/${network}.json`);

	console.log('LINK address: ', chainlink['LINK']);
	console.log('ORACLE address: ', chainlink['ORACLE']);

	// We get the contract to deploy
	let TherundownConsumerWrapper = await ethers.getContractFactory('TherundownConsumerWrapper');
	const TherundownConsumerWrapperDeployed = await TherundownConsumerWrapper.deploy(
		chainlink['LINK'],
		chainlink['ORACLE'],
		consumerAddress,
		paymentCreate,
		paymentResolve,
		paymentOdds,
		oddsSpecId,
		sportsAMMAddress,
		verifierAddress
	);
	await TherundownConsumerWrapperDeployed.deployed();

	setTargetAddress('TherundownConsumerWrapper', network, TherundownConsumerWrapperDeployed.address);

	console.log('TherundownConsumerWrapper deployed to:', TherundownConsumerWrapperDeployed.address);

	try {
		await hre.run('verify:verify', {
			address: TherundownConsumerWrapperDeployed.address,
			constructorArguments: [
				chainlink['LINK'],
				chainlink['ORACLE'],
				consumerAddress,
				paymentCreate,
				paymentResolve,
				paymentOdds,
				oddsSpecId,
				sportsAMMAddress,
				verifierAddress,
			],
		});
	} catch (e) {
		console.log(e);
	}
}

function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

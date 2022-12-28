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
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}

	const consumer = await ethers.getContractFactory('TherundownConsumer');
	let consumerAddress = getTargetAddress('TherundownConsumer', network);
	const sportsAMM = await ethers.getContractFactory('SportsAMM');
	let sportsAMMAddress = getTargetAddress('SportsAMM', network);
	const verifier = await ethers.getContractFactory('TherundownConsumerVerifier');
	let verifierAddress = getTargetAddress('TherundownConsumerVerifier', network);

	console.log('TherundownConsumer address: ', consumerAddress);

	const chainlink = require(`./chainlink/${network}.json`);

	console.log('LINK address: ', chainlink['LINK']);
	console.log('ORACLE address: ', chainlink['ORACLE']);
	const paymentCreate = w3utils.toWei('0.01');
	const paymentResolve = w3utils.toWei('0.01');
	const paymentOdds = w3utils.toWei('0.01');
	let oddsSpecId = '0x3230646438613738373265343436303862386438323239636566333666623638';

	const TherundownConsumerWrapper = getTargetAddress('TherundownConsumerWrapper', network);
	console.log('TherundownConsumerWrapper: ', TherundownConsumerWrapper);

	try {
		await hre.run('verify:verify', {
			address: TherundownConsumerWrapper,
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

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

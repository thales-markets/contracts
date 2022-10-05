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

	const paymentMetadata = w3utils.toWei('0.1');
	const paymentMatchup = w3utils.toWei('0.1');
	const paymentResults = w3utils.toWei('0.1');

	const consumer = await ethers.getContractFactory('ApexConsumer');
	let consumerAddress = getTargetAddress('ApexConsumer', network);

	console.log('ApexConsumer address: ', consumerAddress);

	const chainlink = require(`./chainlink/${network}.json`);

	console.log('LINK address: ', chainlink['LINK']);
	console.log('ORACLE address: ', chainlink['ORACLE']);

	const allowedBetTypes = ['outright_head_to_head', 'top3', 'top5', 'top10'];

	// We get the contract to deploy
	let ApexConsumerWrapper = await ethers.getContractFactory('ApexConsumerWrapper');
	const ApexConsumerWrapperDeployed = await ApexConsumerWrapper.deploy(
		chainlink['LINK'],
		chainlink['ORACLE'],
		consumerAddress,
		paymentMetadata,
		paymentMatchup,
		paymentResults,
		chainlink['REQUEST_METADATA_JOB_ID'],
		chainlink['REQUEST_MATCHUP_JOB_ID'],
		chainlink['REQUEST_RESULTS_JOB_ID'],
		allowedBetTypes
	);
	await ApexConsumerWrapperDeployed.deployed();

	setTargetAddress('ApexConsumerWrapper', network, ApexConsumerWrapperDeployed.address);

	console.log('ApexConsumerWrapper deployed to:', ApexConsumerWrapperDeployed.address);

	try {
		await hre.run('verify:verify', {
			address: ApexConsumerWrapperDeployed.address,
			constructorArguments: [
				chainlink['LINK'],
				chainlink['ORACLE'],
				consumerAddress,
				paymentMetadata,
				paymentMatchup,
				paymentResults,
				chainlink['REQUEST_METADATA_JOB_ID'],
				chainlink['REQUEST_MATCHUP_JOB_ID'],
				chainlink['REQUEST_RESULTS_JOB_ID'],
				allowedBetTypes,
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

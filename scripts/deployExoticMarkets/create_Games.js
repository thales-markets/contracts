const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');
const { setTargetAddress, getTargetAddress, txLog } = require('../helpers');

const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { toBN } = web3.utils;

const { toBytes32 } = require('../../index');

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

	/* ========== PROPERTIES FOR INITIALIZE ========== */

	const chainlink = require(`./chainlink/${network}.json`);

	console.log('LINK address:', chainlink['LINK']);
	console.log('JOB_ID:', chainlink['JOB_ID']);

	// NBA: 4
	// UEFA Champions League: 16
	const sports = [4, 16];

	const market = 'create';
	const linkAmountPerRequest = w3utils.toWei('0.1'); // amount per request
	const linkAmount = w3utils.toWei('0.2'); // sports.length * linkAmountPerRequest

	const jobId = toBytes32(chainlink['JOB_ID']);
	console.log('jobId bytes32: ', jobId);

	let numberOfdays = 7; // number of days from today
	let date = await getSecondsToDate(numberOfdays); // CHANGE THIS PROP FOR DATE!!! (UINT)

	console.log('Games on a date: ', date);

	/* ========== CREATE GAMES ========== */

	const TherundownConsumerWrapper = await ethers.getContractFactory('TherundownConsumerWrapper');
	const therundownConsumerWrapperAddress = getTargetAddress('TherundownConsumerWrapper', network);
	console.log('Found TherundownConsumerWrapper at:', therundownConsumerWrapperAddress);

	const wrapper = await TherundownConsumerWrapper.attach(therundownConsumerWrapperAddress);

	// approve LINK from wrapper
	let abi = ['function approve(address _spender, uint256 _value) public returns (bool success)'];
	let contract = new ethers.Contract(chainlink['LINK'], abi, owner);

	await contract.approve(wrapper.address, linkAmount, {
		from: owner.address,
	});

	await delay(5000); // need some time to  finish approval
	console.log('Done approving');

	// transfer LINK to wrapper
	abi = ['function transfer(address _spender, uint256 _value) public returns (bool success)'];
	contract = new ethers.Contract(chainlink['LINK'], abi, owner);

	let tx = await contract.transfer(wrapper.address, linkAmount, {
		from: owner.address,
	});

	await delay(5000); // need some time to  finish transfer
	console.log('Done sending');

	// request to create games for date
	for (let i = 0; i < sports.length; ) {
		console.log('Create games for: ' + sports[i], ', which is ' + i);
		try {
			tx = await wrapper.requestGames(
				jobId,
				linkAmountPerRequest,
				market,
				sports[i],
				date
			);

			await tx.wait().then(e => {
				txLog(tx, 'Requested for: ' + sports[i]);
			});
			i++;
		} catch (e) {
			console.log('Retry');
			await delay(5000);
		}
	}

	console.log('Done!');
}

function delay(time) {
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}

function getSecondsToDate(dateFrom) {
	const date = new Date(Date.now() + dateFrom * 3600 * 1000 * 24);
	date.setHours(0);
	date.setMinutes(0);
	date.setMilliseconds(0);
	date.setSeconds(0);
	return Math.floor(date.getTime() / 1000);
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

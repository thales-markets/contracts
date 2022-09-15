const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');

const { getTargetAddress, setTargetAddress } = require('../helpers');

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

	const consumer = await ethers.getContractFactory('ApexConsumer');
	let consumerAddress = getTargetAddress('ApexConsumer', network);

	console.log('ApexConsumer address: ', consumerAddress);

	const chainlink = require(`./chainlink/${network}.json`);

	console.log('LINK address: ', chainlink['LINK']);
	console.log('ORACLE address: ', chainlink['ORACLE']);

	const ApexConsumerWrapper = getTargetAddress('ApexConsumerWrapper', network);
	console.log('ApexConsumerWrapper: ', ApexConsumerWrapper);

	try {
		await hre.run('verify:verify', {
			address: ApexConsumerWrapper,
			constructorArguments: [chainlink['LINK'], chainlink['ORACLE'], consumerAddress],
		});
	} catch (e) {
		console.log(e);
	}
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

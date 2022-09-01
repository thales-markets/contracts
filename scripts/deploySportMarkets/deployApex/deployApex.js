const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');

const { toBN } = web3.utils;

const { toBytes32 } = require('../../../index');

const { getTargetAddress, setTargetAddress } = require('../../helpers');

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

	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	} else if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
	}

	// We get the contract to deploy
	let ApexConsumer = await ethers.getContractFactory('ApexConsumer');
	const apexConsumerContractDeployed = await ApexConsumer.deploy();
	await apexConsumerContractDeployed.deployed();

	console.log('apexConsumerContractDeployed deployed to:', apexConsumerContractDeployed.address);
	setTargetAddress('ApexConsumer', network, apexConsumerContractDeployed.address);

	await hre.run('verify:verify', {
		address: apexConsumerContractDeployed.address,
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

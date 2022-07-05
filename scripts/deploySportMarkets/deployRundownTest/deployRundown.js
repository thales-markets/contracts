const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');

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

	if (networkObj.chainId == 10) {
		network = 'optimistic';
	} else if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
	}

	// We get the contract to deploy
	let TherundownConsumerContract = await ethers.getContractFactory('TherundownConsumerTest');
	const therundownConsumerContractDeployed = await TherundownConsumerContract.deploy(
		'0xa36085F69e2889c224210F603D836748e7dC0088',
		'0xfF07C97631Ff3bAb5e5e5660Cdf47AdEd8D4d4Fd'
	);
	await therundownConsumerContractDeployed.deployed();

	console.log(
		'therundownConsumerContractDeployed deployed to:',
		therundownConsumerContractDeployed.address
	);

	await hre.run('verify:verify', {
		address: therundownConsumerContractDeployed.address,
		constructorArguments: [
			'0xa36085F69e2889c224210F603D836748e7dC0088',
			'0xfF07C97631Ff3bAb5e5e5660Cdf47AdEd8D4d4Fd',
		],
		contract:
			'contracts/test-helpers/RundownTest/TherundownConsumerTest.sol:TherundownConsumerTest',
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

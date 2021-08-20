const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix');
const { artifacts, contract, web3 } = require('hardhat');

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

	// We get the contract to deploy
	let SportFeedContract = await ethers.getContractFactory('SportFeed');
	const sportFeedContractDeployed = await SportFeedContract.deploy(
		owner.address,
		'0x56dd6586db0d08c6ce7b2f2805af28616e082455',
		toBytes32('aa34467c0b074fb0888c9f42c449547f'),
		w3utils.toWei('1'),
		'medals',
		'2016',
		'',
		''
	);
	await sportFeedContractDeployed.deployed();

	console.log('sportFeedContractDeployed deployed to:', sportFeedContractDeployed.address);

	await hre.run('verify:verify', {
		address: sportFeedContractDeployed.address,
		constructorArguments: [
			owner.address,
			'0x56dd6586db0d08c6ce7b2f2805af28616e082455',
			toBytes32('aa34467c0b074fb0888c9f42c449547f'),
			w3utils.toWei('1'),
			'medals',
			'2016',
			'',
			'',
		],
		contract: 'contracts/SportFeed.sol:SportFeed',
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

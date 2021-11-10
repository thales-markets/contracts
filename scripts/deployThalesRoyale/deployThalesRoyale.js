const { ethers } = require('hardhat');

const w3utils = require('web3-utils');

const { toBytes32 } = require('../../index');

const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
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
		networkObj.name = 'optimistic';
		network = 'optimistic';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	const priceFeed = await ethers.getContractFactory('PriceFeed');
	let priceFeedAddress = getTargetAddress('PriceFeed', network);

	const min = 60;
	const hour = 60 * 60;
	const day = 24 * 60 * 60;

	// Dev env - deploy Thales.sol; Live env - use Thales.sol contract address
	const ThalesRoyale = await ethers.getContractFactory('ThalesRoyale');
	const ThalesRoyaleDeployed = await ThalesRoyale.deploy(
		owner.address,
		toBytes32('ETH'),
		priceFeedAddress,
		w3utils.toWei('10000'),
		priceFeedAddress,
		7,
		min * 20,
		min * 10,
		min * 12
	);
	await ThalesRoyaleDeployed.deployed();
	// update deployments.json file
	setTargetAddress('ThalesRoyale', network, ThalesRoyaleDeployed.address);

	console.log('ThalesRoyale deployed to:', ThalesRoyaleDeployed.address);

	await hre.run('verify:verify', {
		address: ThalesRoyaleDeployed.address,
		constructorArguments: [
			owner.address,
			toBytes32('ETH'),
			priceFeedAddress,
			w3utils.toWei('10000'),
			priceFeedAddress,
			7,
			min * 20,
			min * 10,
			min * 12,
		],
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

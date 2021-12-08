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
	// TODO change reward token address
	let rewardTokenAddress = getTargetAddress('PriceFeed', network);

	const min = 60;
	const hour = 60 * 60;
	const day = 24 * 60 * 60;
	const week = 7 * 24 * 60 * 60;

	const asset = toBytes32('ETH');

	const signUpPeriod = day * 3;
	const roundChoosingLength = hour * 8;
	const roundLength = day;
	const claimTime = week;
	const pauseBetweenSeasonsTime = hour * 24;

	const season = 1;
	const zeroAmount = 0;
	const rounds = 6;
	const buyIn = w3utils.toWei('10');

	// Dev env - deploy Thales.sol; Live env - use Thales.sol contract address
	const ThalesRoyale = await ethers.getContractFactory('ThalesRoyale');
	const ThalesRoyaleDeployed = await ThalesRoyale.deploy(
		owner.address,
		asset,
		priceFeedAddress,
		zeroAmount,
		rewardTokenAddress,
		rounds,
		signUpPeriod,
		roundChoosingLength,
		roundLength,
		claimTime,
		season, 
		buyIn,
		false,
		pauseBetweenSeasonsTime
	);
	await ThalesRoyaleDeployed.deployed();
	// update deployments.json file
	setTargetAddress('ThalesRoyale', network, ThalesRoyaleDeployed.address);

	console.log('ThalesRoyale deployed to:', ThalesRoyaleDeployed.address);

	await hre.run('verify:verify', {
		address: ThalesRoyaleDeployed.address,
		constructorArguments: [
			owner.address,
			asset,
			priceFeedAddress,
			zeroAmount,
			rewardTokenAddress,
			rounds,
			signUpPeriod,
			roundChoosingLength,
			roundLength,
			claimTime,
			season, 
			buyIn,
			false,
			pauseBetweenSeasonsTime
		],
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

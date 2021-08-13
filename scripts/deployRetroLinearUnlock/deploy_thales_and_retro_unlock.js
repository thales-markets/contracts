const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const Big = require('big.js');
const fs = require('fs');
const { numberExponentToLarge, txLog } = require('../helpers.js');

const TOTAL_AMOUNT = w3utils.toWei('1000');
const VESTING_PERIOD = 86400 * 365; //one year
const INPUT_SIZE = 100;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// TODO - put correct addresses here
const fundingAdmins = [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS];

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Total amount', TOTAL_AMOUNT);

	// Dev env - deploy Thales.sol; Live env - use Thales.sol contract address
	const Thales = await ethers.getContractFactory('Thales');
	const ThalesDeployed = await Thales.deploy();
	await ThalesDeployed.deployed();

	console.log('Thales deployed to:', ThalesDeployed.address);

	const startTime = (await ethers.provider.getBlock()).timestamp + 1000; // hardcoded

	const VestingEscrow = await ethers.getContractFactory('VestingEscrow');
	const VestingEscrowDeployed = await VestingEscrow.deploy(
		owner.address,
		ThalesDeployed.address,
		startTime,
		startTime + VESTING_PERIOD
	);
	await VestingEscrowDeployed.deployed();
	console.log('VestingEscrowDeploy deployed to:', VestingEscrowDeployed.address);

	tx = await ThalesDeployed.approve(VestingEscrowDeployed.address, TOTAL_AMOUNT);
	txLog(tx, 'Thales.sol: Approve tokens');

	tx = await VestingEscrowDeployed.addTokens(TOTAL_AMOUNT);
	txLog(tx, 'VestingEscrow.sol: Add tokens');

	const recipients = [
		'0x461783A831E6dB52D68Ba2f3194F6fd1E0087E04',
		'0x169379d950ceffa34f5d92e33e40B7F3787F0f71',
	];
	let amounts = new Array(2).fill(w3utils.toWei('365'));

	await VestingEscrowDeployed.fund(recipients, amounts);

	await hre.run('verify:verify', {
		address: ThalesDeployed.address,
	});

	await hre.run('verify:verify', {
		address: VestingEscrowDeployed.address,
		constructorArguments: [
			owner.address,
			ThalesDeployed.address,
			startTime,
			startTime + VESTING_PERIOD,
		],
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

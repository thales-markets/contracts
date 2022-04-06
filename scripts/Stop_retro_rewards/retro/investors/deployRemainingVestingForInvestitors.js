const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const w3utils = require('web3-utils');
const Big = require('big.js');
const fs = require('fs');
const {
	numberExponentToLarge,
	txLog,
	getTargetAddress,
	setTargetAddress,
} = require('../../../helpers.js');

const INPUT_SIZE = 100;

let thalesAddress;

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (network === 'homestead') {
		network = 'mainnet';
	} else if (network === 'unknown') {
		network = 'localhost';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	thalesAddress = getTargetAddress('OpThales_L1', network);
	console.log('thales address:', thalesAddress);

	await vestTokens(owner, [], 1, network);
}

async function vestTokens(owner, fundingAdmins, confs, network) {
	const startTime = (await ethers.provider.getBlock()).timestamp + 60 * 60; // start in 2 days
	const VESTING_PERIOD = 86400 * 7 * 75; //80 weeks

	const VestingEscrow = await ethers.getContractFactory('VestingEscrowProxy');
	const VestingEscrowDeployed = await upgrades.deployProxy(VestingEscrow, [
		owner.address,
		thalesAddress,
		startTime,
		startTime + VESTING_PERIOD,
	]);
	await VestingEscrowDeployed.deployed();

	console.log('VestingEscrowDeployed deployed to:', VestingEscrowDeployed.address);
	setTargetAddress('VestingEscrowInvestors', network, VestingEscrowDeployed.address);

	const implementation = await getImplementationAddress(
		ethers.provider,
		VestingEscrowDeployed.address
	);
	console.log('VestingEscrowInvestorsImplementation: ', implementation);
	setTargetAddress('VestingEscrowInvestorsImplementation', network, implementation);

	try {
		await hre.run('verify:verify', {
			address: implementation,
		});
	} catch (e) {
		console.log(e);
	}

	let vestedAmounts = require('./investitorsSnapshot.json');
	// write fixed amounts to a file

	let accounts = [],
		values = [];
	vestedAmounts.forEach(va => {
		accounts.push(va.address);
		values.push(va.lockedOf);
	});

	const fundArguments = [];
	for (let i = 0; i < accounts.length; i += INPUT_SIZE) {
		let accountsArgument = accounts.slice(i, i + INPUT_SIZE);
		let valuesArgument = values.slice(i, i + INPUT_SIZE);
		fundArguments.push([accountsArgument, valuesArgument]);
	}

	console.log('started funding');

	await _fundAccounts(owner, VestingEscrowDeployed, fundArguments, 1);
}

async function _fundAccounts(account, vestingEscrowContract, fundArguments, confs) {
	for (let i = 0; i < fundArguments.length; i++) {
		const [recipients, amounts] = fundArguments[i];
		let tx = await vestingEscrowContract.fund(recipients, amounts);
		await tx.wait().then(e => {
			txLog(tx, 'VestingEscrow.sol: Fund accounts');
		});
	}
}

function sortAmounts(amounts) {
	const accountsValues = [];
	for (let [key, value] of Object.entries(amounts)) {
		accountsValues.push({ address: key, amount: value });
	}

	accountsValues.sort(function(a, b) {
		return a['amount'].minus(b['amount']);
	});

	amounts = {};
	for (let key of Object.keys(accountsValues)) {
		amounts[accountsValues[key]['address']] = accountsValues[key]['amount'];
	}

	return amounts;
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

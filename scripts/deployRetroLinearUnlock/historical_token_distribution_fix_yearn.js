const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const fs = require('fs');
const {
	numberExponentToLarge,
	txLog,
	getTargetAddress,
} = require('../helpers.js');

// only one fund admin
const BLACKLIST = [
	'0x000000000000000000000000000000000000dead',
	'0x7Cd5E2d0056a7A7F09CBb86e540Ef4f6dCcc97dd', // XSNX PROXY ADMIN ADDRESS
];

const INPUT_SIZE = 100;

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

	const THALES = getTargetAddress('Thales', network);

	const Thales = await ethers.getContractFactory('Thales');
	const ThalesDeployed = await Thales.attach(THALES);

	console.log('Thales address:', ThalesDeployed.address);

	await vestTokens(owner, [], ThalesDeployed, 1, network);
}

async function vestTokens(admin, fundingAdmins, token, confs, network) {
	const startTime = (await ethers.provider.getBlock()).timestamp + 60 * 60 * 24 * 4; // start in 3 days

	const VestingEscrow = await ethers.getContractFactory('VestingEscrow');
	const VestingEscrowDeployed = await VestingEscrow.attach(
		'0xbaE14FAf280FB293e6f3D6c0b5E80eD5D477b161'
	);
	console.log('VestingEscrow deployed to:', VestingEscrowDeployed.address);

	let vestedAmounts = require('../snx-data/sorted_historical_stakers_after_floor_fixed_yearn.json');
	// write fixed amounts to a file
	fs.writeFileSync(
		'scripts/snx-data/sorted_historical_stakers_below_floor_sanity_yearn.json',
		JSON.stringify(vestedAmounts),
		function(err) {
			if (err) return console.log(err);
		}
	);

	// redistribution after flooring
	//
	const TOTAL_AMOUNT = w3utils.toWei('300000');
	tx = await token.approve(VestingEscrowDeployed.address, TOTAL_AMOUNT);
	await tx.wait().then(e => {
		txLog(tx, 'Thales.sol: Approve tokens');
	});

	tx = await VestingEscrowDeployed.addTokens(TOTAL_AMOUNT);
	await tx.wait().then(e => {
		txLog(tx, 'VestingEscrow.sol: Add tokens');
	});

	let accounts = [],
		values = [];
	for (let [key, value] of Object.entries(vestedAmounts)) {
		accounts.push(key);
		values.push(numberExponentToLarge(value));
	}

	const fundArguments = [];
	for (let i = 0; i < accounts.length; i += INPUT_SIZE) {
		let accountsArgument = accounts.slice(i, i + INPUT_SIZE);
		let valuesArgument = values.slice(i, i + INPUT_SIZE);
		fundArguments.push([accountsArgument, valuesArgument]);
	}

	console.log('started funding');

	await _fundAccounts(admin, VestingEscrowDeployed, fundArguments, 1);
}

async function _fundAccounts(account, vestingEscrowContract, fundArguments, confs) {
	for (let i = 0; i < fundArguments.length; i++) {
		const [recipients, amounts] = fundArguments[i];
		tx = await vestingEscrowContract.fund(recipients, amounts);
		await tx.wait().then(e => {
			txLog(tx, 'VestingEscrow.sol: Fund accounts');
		});
	}
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

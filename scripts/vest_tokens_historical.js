const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const Big = require('big.js');
const fs = require('fs');
const { numberExponentToLarge, txLog } = require('./helpers.js');

const TOTAL_AMOUNT = w3utils.toWei('15000000');
const VESTING_PERIOD = 86400 * 365;
const INPUT_SIZE = 100;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const historicalData = require('./snx-data/historical_snx.json');

// TODO - put correct addresses here
const fundingAdmins = [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS];

const BLACKLIST = [
	'0x000000000000000000000000000000000000dead',
	'0x7Cd5E2d0056a7A7F09CBb86e540Ef4f6dCcc97dd', // XSNX PROXY ADMIN ADDRESS
];

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

	await vestTokens(owner, fundingAdmins, ThalesDeployed, 1);
}

async function vestTokens(admin, fundingAdmins, token, confs) {
	const startTime = (await ethers.provider.getBlock()).timestamp + 1000; // hardcoded

	const VestingEscrow = await ethers.getContractFactory('VestingEscrow');
	const VestingEscrowDeployed = await VestingEscrow.deploy(
		token.address,
		startTime,
		startTime + VESTING_PERIOD,
		false,
		fundingAdmins
	);
	await VestingEscrowDeployed.deployed();
	console.log('VestingEscrowDeploy deployed to:', VestingEscrowDeployed.address);

	let vestedPercent = [];
	let totalScore = Big(0);
	for (let [key, value] of Object.entries(historicalData)) {
		if (vestedPercent[key.toLowerCase()]) {
			vestedPercent[key.toLowerCase()] = vestedPercent[key.toLowerCase()].add(value);
		} else {
			vestedPercent[key.toLowerCase()] = Big(value);
		}
		totalScore = totalScore.add(value);
	}

	console.log('totalScore', totalScore.toString());

	for (addr in BLACKLIST) {
		if (vestedPercent.includes(addr)) {
			const index = vestedPercent.indexOf(addr);
			vestedPercent = vestedPercent.splice(index, 1);
		}
	}

	let vestedAmounts = [];
	let finalTotal = Big(0);
	for (let [key, value] of Object.entries(vestedPercent)) {
		if (value.gt(0)) {
			const newValue = value
				.times(TOTAL_AMOUNT)
				.div(totalScore)
				.round();
			vestedAmounts[key.toLowerCase()] = newValue;

			finalTotal = finalTotal.plus(newValue);
		}
	}

	console.log('finalTotal', finalTotal.toString());
	const diff = finalTotal.sub(TOTAL_AMOUNT);
	console.log('diff', diff.toString());

	console.log(Object.keys(vestedAmounts).length);
	if (diff.abs() > Object.keys(vestedAmounts).length) {
		throw new Error('Imprecision!!! Distribution amounts are too far off!');
	}

	// sort vested amounts
	let accountsValues = [];
	for (let [key, value] of Object.entries(vestedAmounts)) {
		accountsValues.push({ address: key, amount: value });
	}

	accountsValues.sort(function(a, b) {
		return a['amount'].minus(b['amount']);
	});

	vestedAmounts = {};
	for (let key of Object.keys(accountsValues)) {
		vestedAmounts[accountsValues[key]['address']] = accountsValues[key]['amount'];
	}

	// fix imprecision
	let diffCount = 0;
	for (let key of Object.keys(vestedAmounts)) {
		if (diffCount++ >= diff.abs()) break;
		vestedAmounts[key] = diff > 0 ? vestedAmounts[key].sub(1) : vestedAmounts[key].add(1);
	}

	// write fixed amounts to a file
	fs.writeFileSync(
		'scripts/snx-data/sorted_historical_stakers.json',
		JSON.stringify(vestedAmounts),
		function(err) {
			if (err) return console.log(err);
		}
	);

	tx = await token.approve(VestingEscrowDeployed.address, TOTAL_AMOUNT);
	txLog(tx, 'Thales.sol: Approve tokens');

	tx = await VestingEscrowDeployed.addTokens(TOTAL_AMOUNT);
	txLog(tx, 'VestingEscrow.sol: Add tokens');

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

		if (i + INPUT_SIZE > accounts.length) {
			zeroArray = new Array(INPUT_SIZE - accountsArgument.length);
			accountsArgument = [...accountsArgument, ...zeroArray.fill(ZERO_ADDRESS)];
			valuesArgument = [...valuesArgument, ...zeroArray.fill('0')];
		}
		fundArguments.push([accountsArgument, valuesArgument]);
	}

	await _fundAccounts(admin, VestingEscrowDeployed, fundArguments, 1);
}

async function _fundAccounts(account, vestingEscrowContract, fundArguments, confs) {
	for (let i = 0; i < fundArguments.length; i++) {
		const [recipients, amounts] = fundArguments[i];
		tx = await vestingEscrowContract.fund(recipients, amounts);
		txLog(tx, 'VestingEscrow.sol: Fund accounts');
	}
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

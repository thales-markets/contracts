const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const Big = require('big.js');
const fs = require('fs');
const {
	numberExponentToLarge,
	getTargetAddress,
} = require('../helpers.js');

const TOTAL_AMOUNT = w3utils.toWei('15000000'); //15m
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const FLOOR_VALUE = w3utils.toWei('24');

let historicalData = require('../snx-data/historical_snx_new.json');
let historicalDiff = require('../snx-data/historical_diff.json');
const investitors = require('../snx-data/investitors.json');

// only one fund admin
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
	if (network === 'homestead') {
		network = 'mainnet';
	} else if (network === 'unknown') {
		network = 'localhost';
	}

	if (network !== 'mainnet') {
		historicalData = require('../snx-data/historical_snx_test.json');
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Total amount', TOTAL_AMOUNT);

	const THALES = getTargetAddress('Thales', network);

	const Thales = await ethers.getContractFactory('Thales');
	const ThalesDeployed = await Thales.attach(THALES);

	console.log('Thales address:', ThalesDeployed.address);

	await vestTokens(owner, fundingAdmins, ThalesDeployed, 1, network);
}

async function vestTokens(admin, fundingAdmins, token, confs, network) {
	const startTime = (await ethers.provider.getBlock()).timestamp + 60 * 60 * 24 * 4; // start in 3 days

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

	// sort vested amounts;
	vestedAmounts = sortAmounts(vestedAmounts);

	// fix imprecision
	let diffCount = 0;
	for (let key of Object.keys(vestedAmounts)) {
		if (vestedAmounts[key] < 1) continue;
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

	let sumAfterFloor = Big(0);
	for (let [key, value] of Object.entries(vestedAmounts)) {
		if (value.lt(FLOOR_VALUE)) {
			delete vestedAmounts[key];
		} else {
			sumAfterFloor = sumAfterFloor.add(value);
		}
	}

	console.log('sumAfterFloor', sumAfterFloor.toString());

	// redistribution after flooring
	let totalAfterRedistribution = Big(0);
	for (let [key, value] of Object.entries(vestedAmounts)) {
		vestedAmounts[key] = value
			.times(TOTAL_AMOUNT)
			.div(sumAfterFloor)
			.round();

		totalAfterRedistribution = totalAfterRedistribution.plus(vestedAmounts[key]);
	}

	console.log('totalAfterRedistribution', totalAfterRedistribution.toString());
	const diffAfterRedistribution = totalAfterRedistribution.sub(TOTAL_AMOUNT);
	console.log('diffAfterRedistribution', diffAfterRedistribution.toString());

	console.log(Object.keys(vestedAmounts).length);
	if (diffAfterRedistribution.abs() > Object.keys(vestedAmounts).length) {
		throw new Error('Imprecision!!! Distribution amounts are too far off!');
	}

	// fix imprecision (again)
	diffCount = 0;
	for (let key of Object.keys(vestedAmounts)) {
		if (diffCount++ >= diffAfterRedistribution.abs()) break;
		vestedAmounts[key] =
			diffAfterRedistribution > 0 ? vestedAmounts[key].sub(1) : vestedAmounts[key].add(1);
	}

	let investitorsTotalAmount = Big(0);
	for (let [key, value] of Object.entries(investitors)) {
		if (vestedAmounts[key]) {
			vestedAmounts[key] = vestedAmounts[key].add(web3.utils.toWei(value + ''));
		} else {
			vestedAmounts[key] = Big(web3.utils.toWei(value + ''));
		}

		investitorsTotalAmount = investitorsTotalAmount.add(web3.utils.toWei(value + ''));
	}

	console.log('investitors total amount', investitorsTotalAmount.toString());

	// sort vested amounts;
	vestedAmounts = sortAmounts(vestedAmounts);

	let fixedVestedAmount = [];
	for (let key of Object.keys(vestedAmounts)) {
		if (historicalDiff.hasOwnProperty(key)) {
			let value = vestedAmounts[key];
			console.log(key + ': ' + numberExponentToLarge(value));
		}
	}

	console.log('fixedVestedAmounts' + JSON.stringify(fixedVestedAmount));

	// write FINAL fixed amounts to a file including investitors
	fs.writeFileSync(
		'scripts/snx-data/sorted_historical_stakers_after_floor_fixed.json',
		JSON.stringify(fixedVestedAmount),
		function(err) {
			if (err) return console.log(err);
		}
	);

	// total amount to be transferred to VestingEscrow contract
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

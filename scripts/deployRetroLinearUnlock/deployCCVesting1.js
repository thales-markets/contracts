const { ethers } = require('hardhat');
const fs = require('fs');
const { txLog, getTargetAddress } = require('../helpers.js');

const VESTING_PERIOD = 86400 * 7 * 156; //156 weeks

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
	const startTime = (await ethers.provider.getBlock()).timestamp + 60 * 60 * 24 * 200; // start in 200 days

	const VestingEscrow = await ethers.getContractFactory('VestingEscrow');
	const VestingEscrowDeployed = await VestingEscrow.deploy(
		admin.address,
		token.address,
		startTime,
		startTime + VESTING_PERIOD
	);
	await VestingEscrowDeployed.deployed();
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
	await hre.run('verify:verify', {
		address: VestingEscrowDeployed.address,
		constructorArguments: [admin.address, token.address, startTime, startTime + VESTING_PERIOD],
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

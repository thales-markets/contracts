const { ethers, upgrades } = require('hardhat');
const {
	txLog,
	getTargetAddress,
	setTargetAddress,
} = require('../../helpers.js');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { recipients, amounts, startTimes, TOTAL_AMOUNT } = require('./recipients');
const VESTING_PERIOD = 86400 * 365 * 3; // three years

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let thalesAddress, Thales;

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
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}

	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	if (networkObj.chainId == 10 || networkObj.chainId == 69) {
		thalesAddress = getTargetAddress('OpThales_L2', network);
		Thales = await ethers.getContractFactory('OpThales');
	} else {
		thalesAddress = getTargetAddress('Thales', network);
		Thales = await ethers.getContractFactory('Thales');
	}

	const ThalesDeployed = await Thales.attach(thalesAddress);

	console.log('Thales address:', ThalesDeployed.address);

	const VestingEscrow = await ethers.getContractFactory('VestingEscrowCC');
	const vestingEscrow = await upgrades.deployProxy(VestingEscrow, [
		owner.address,
		ThalesDeployed.address,
		VESTING_PERIOD,
	]);
	await vestingEscrow.deployed();
	await delay(3000);

	console.log('VestingEscrowCC deployed to:', vestingEscrow.address);

	setTargetAddress('VestingEscrowCC', network, vestingEscrow.address);

	const implementation = await getImplementationAddress(ethers.provider, vestingEscrow.address);
	console.log('VestingEscrowCCImplementation: ', implementation);
	setTargetAddress('VestingEscrowCCImplementation', network, implementation);

	let tx = await ThalesDeployed.transfer(vestingEscrow.address, TOTAL_AMOUNT);
	await tx.wait().then(e => {
		txLog(tx, 'Thales: Transfer tokens');
	});
	tx = await ThalesDeployed.approve(vestingEscrow.address, TOTAL_AMOUNT);
	await tx.wait().then(e => {
		txLog(tx, 'Thales: Approve tokens');
	});

	console.log('started funding');

	for(let i = 0; i < recipients.length; i++) {
		tx = await vestingEscrow.fund(recipients[i], amounts[i], startTimes[i]);
		await tx.wait().then(e => {
			txLog(tx, 'Fund account: ' + recipients[i]);
		});
	}

	try {
		await hre.run('verify:verify', {
			address: implementation,
		});
	} catch (e) {
		console.log(e);
	}
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

function delay(time) {
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}
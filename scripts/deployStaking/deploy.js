const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');

const THALES_AMOUNT = web3.utils.toWei('200');
const SECOND = 1000;
const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;
const YEAR = 31556926;

const fs = require('fs');
const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let durationPeriod, unstakeDurationPeriod;
	if (network == 'homestead') {
		console.log('Setting duration to WEEK');
		network = 'mainnet';
		durationPeriod = WEEK;
		unstakeDurationPeriod = WEEK;
	} else {
		console.log('Setting duration to MINUTE');
		durationPeriod = MINUTE;
		unstakeDurationPeriod = MINUTE;
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + network);

	const thalesAddress = getTargetAddress('Thales', network);
	const EscrowThalesAddress = getTargetAddress('EscrowThales', network);

	const EscrowThales = await ethers.getContractFactory('EscrowThales');
	let EscrowThalesAttached = await EscrowThales.attach(EscrowThalesAddress);

	console.log('Thales address: ', thalesAddress);

	console.log('EscrowThales address: ', EscrowThalesAddress);

	const ProxyERC20sUSD = snx.getTarget({ network, contract: 'ProxyERC20sUSD' });
	// console.log('Found ProxyERC20sUSD at:' + ProxyERC20sUSD.address);
	// const ProxyERC20sUSD = '0x578C6B406D3C40fa2417CB810513B1E4822B4614';
	console.log('ProxyERC20sUSD address: ', ProxyERC20sUSD.address);

	const StakingThales = await ethers.getContractFactory('StakingThales');
	const StakingThalesDeployed = await StakingThales.deploy(
		owner.address,
		EscrowThalesAddress,
		thalesAddress,
		ProxyERC20sUSD.address,
		durationPeriod,
		unstakeDurationPeriod
	);
	await StakingThalesDeployed.deployed();

	await EscrowThalesAttached.setStakingThalesContract(StakingThalesDeployed.address);

	console.log('StakingThales deployed to: ', StakingThalesDeployed.address);
	// update deployments.json file
	setTargetAddress('StakingThales', network, StakingThalesDeployed.address);

	await hre.run('verify:verify', {
		address: StakingThalesDeployed.address,
		constructorArguments: [
			owner.address,
			EscrowThalesAddress,
			thalesAddress,
			ProxyERC20sUSD.address,
			durationPeriod,
			unstakeDurationPeriod,
		],
	});

	await StakingThalesDeployed.startStakingPeriod({ from: owner.address });
	console.log('Staking has been started');
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

const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
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
const { getTargetAddress, setTargetAddress, encodeCall } = require('../helpers');

const user_key1 = process.env.PRIVATE_KEY;

async function main() {
	let accounts = await ethers.getSigners();
	// let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (networkObj.chainId == 10) {
		network = 'optimistic';
	}
	if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
	}
	let durationPeriod, unstakeDurationPeriod;
	if (network == 'optimistic') {
		console.log('Setting duration to WEEK');
		durationPeriod = WEEK;
		unstakeDurationPeriod = WEEK;
	}
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

	const owner = new ethers.Wallet(user_key1, ethers.provider);

	console.log('Owner is:' + owner.address);
	console.log('Network name:' + network);

	let thalesAddress, ProxyERC20sUSD_address;

	if (networkObj.chainId == 10) {
		thalesAddress = getTargetAddress('OpThales_L2', network);
		ProxyERC20sUSD_address = getTargetAddress('ProxysUSD', network);
	}
	if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
		thalesAddress = getTargetAddress('OpThales_L2', network);
		ProxyERC20sUSD_address = getTargetAddress('ProxysUSD', network);
	} else {
		thalesAddress = getTargetAddress('Thales', network);
		ProxyERC20sUSD_address = getTargetAddress('ProxysUSD', network);
	}
	// const thalesAddress = getTargetAddress('OpThales_L2', network);
	console.log('Thales address: ', thalesAddress);

	// const ProxyERC20sUSD_address = getTargetAddress('ProxysUSD', network);
	console.log('ProxyERC20sUSD address: ', ProxyERC20sUSD_address);
	// const ProxyEscrowThalesAddress = getTargetAddress('ProxyEscrowThales', network);
	const ProxyStaking = getTargetAddress('StakingThales', network);
	const ProxyEscrow = getTargetAddress('EscrowThales', network);

	const NewEscrow = await ethers.getContractFactory('EscrowThales');
	console.log('Escrow upgraded');
	const NewStaking = await ethers.getContractFactory('StakingThales');
	console.log('Staking upgraded');

	await upgrades.upgradeProxy(ProxyStaking, NewStaking);
	await upgrades.upgradeProxy(ProxyEscrow, NewEscrow);

	const StakingImplementation = await getImplementationAddress(ethers.provider, ProxyStaking);
	console.log('Implementation Staking: ', StakingImplementation);
	setTargetAddress('StakingThalesImplementation', network, StakingImplementation);

	const EscrowImplementation = await getImplementationAddress(ethers.provider, ProxyEscrow);
	console.log('Implementation Escrow: ', EscrowImplementation);
	setTargetAddress('EscrowThalesImplementation', network, EscrowImplementation);

	try {
		await hre.run('verify:verify', {
			address: EscrowImplementation,
		});
	} catch (e) {
		console.log(e);
	}
	try {
		await hre.run('verify:verify', {
			address: StakingImplementation,
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

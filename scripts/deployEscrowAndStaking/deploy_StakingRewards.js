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
	let IssuerAddress;
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
	}
	if (networkObj.chainId == 42) {
		network = 'kovan';
	}
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

	SNXIssuerAddress = getTargetAddress('SNXIssuer', network);
	const owner = new ethers.Wallet(user_key1, ethers.provider);

	console.log('Owner is:' + owner.address);
	console.log('Network name:' + network);
	console.log('SNXIssuer address: ' + SNXIssuerAddress);

	let thalesAddress, ProxyERC20sUSD_address;

	if (networkObj.chainId == 10) {
		thalesAddress = getTargetAddress('OpThales_L2', network);
		ProxyERC20sUSD_address = getTargetAddress('ProxysUSD', network);
	} else {
		if (networkObj.chainId == 69) {
			network = 'optimisticKovan';
			thalesAddress = getTargetAddress('OpThales_L2', network);
			ProxyERC20sUSD_address = getTargetAddress('ProxysUSD', network);
		} else {
			thalesAddress = getTargetAddress('Thales', network);
			ProxyERC20sUSD_address = getTargetAddress('ProxysUSD', network);
		}
	}
	console.log('Thales address: ', thalesAddress);
	console.log('ProxyERC20sUSD address: ', ProxyERC20sUSD_address);

	const ThalesStakingRewardsPool = await ethers.getContractFactory('ThalesStakingRewardsPool');
	const StakingAddress = getTargetAddress('StakingThales', network);
	const EscrowAddress = getTargetAddress('EscrowThales', network);

	let ThalesStakingRewardsPoolDeployed = await upgrades.deployProxy(ThalesStakingRewardsPool, [
		owner.address,
		StakingAddress,
		thalesAddress,
		EscrowAddress,
	]);
	await ThalesStakingRewardsPoolDeployed.deployed();

	console.log('ThalesStakingRewardsPool proxy:', ThalesStakingRewardsPoolDeployed.address);

	const ThalesStakingRewardsPoolImplementation = await getImplementationAddress(
		ethers.provider,
		ThalesStakingRewardsPoolDeployed.address
	);

	console.log('Implementation ThalesStakingRewardsPool: ', ThalesStakingRewardsPoolImplementation);

	setTargetAddress('ThalesStakingRewardsPool', network, ThalesStakingRewardsPoolDeployed.address);
	setTargetAddress(
		'ThalesStakingRewardsPoolImplementation',
		network,
		ThalesStakingRewardsPoolImplementation
	);

	try {
		await hre.run('verify:verify', {
			address: ThalesStakingRewardsPoolImplementation,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: ThalesStakingRewardsPoolDeployed.address,
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

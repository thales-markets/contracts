const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');

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
	if (network == 'homestead') {
		network = 'mainnet';
	}

	const owner = new ethers.Wallet(user_key1, ethers.provider);

	console.log('Owner is:' + owner.address);
	console.log('Network name:' + network);

	let thalesAddress;

	if (networkObj.chainId == 10) {
		thalesAddress = getTargetAddress('OpThales_L2', network);
	} else if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
		thalesAddress = getTargetAddress('OpThales_L2', network);
	} else {
		thalesAddress = getTargetAddress('Thales', network);
	}

	// const thalesAddress = getTargetAddress('OpThales_L2', network);
	console.log('Thales address: ', thalesAddress);

	const ProxyStaking = await ethers.getContractFactory('LPStakingRewards');
	const gUNIPoolAddress = getTargetAddress('GUniLPToken', network);

	let ProxyStaking_deployed = await upgrades.deployProxy(ProxyStaking, [
		owner.address,
		thalesAddress,
		gUNIPoolAddress,
		WEEK * 10,
	]);
	let tx = await ProxyStaking_deployed.deployed();

	console.log('Staking proxy:', ProxyStaking_deployed.address);
	await delay(5000);

	const StakingImplementation = await getImplementationAddress(
		ethers.provider,
		ProxyStaking_deployed.address
	);

	console.log('Implementation Staking: ', StakingImplementation);

	setTargetAddress('LPStakingRewards', network, ProxyStaking_deployed.address);
	setTargetAddress('LPStakingRewardsImplementation', network, StakingImplementation);

	// TODO: call notifyReward after transfering the reward to the contract

	try {
		await hre.run('verify:verify', {
			address: StakingImplementation,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: ProxyStaking_deployed.address,
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

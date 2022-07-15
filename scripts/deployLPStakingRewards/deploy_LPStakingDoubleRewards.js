const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const WEEK = 604800;

const fs = require('fs');
const { getTargetAddress, setTargetAddress } = require('../helpers');

const user_key1 = process.env.PRIVATE_KEY;

async function main() {
	let accounts = await ethers.getSigners();
	// let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

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

	const ProxyStaking = await ethers.getContractFactory('LPStakingDoubleRewards');
	const gUNIPoolAddress = getTargetAddress('GUniLPToken', network);
	const opTokenAddress = getTargetAddress('OpToken', network);

	let ProxyStaking_deployed = await upgrades.deployProxy(ProxyStaking, [
		owner.address,
		thalesAddress,
		opTokenAddress,
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

	setTargetAddress('LPStakingDoubleRewards', network, ProxyStaking_deployed.address);
	setTargetAddress('LPStakingDoubleRewardsImplementation', network, StakingImplementation);

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

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
const ISSUER_ADDR = '0x42d9ac3ebebb9479f24360847350b4F7EADECE50';

async function main() {
	let accounts = await ethers.getSigners();
	// let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
	}
	let durationPeriod, unstakeDurationPeriod;
	if (network == 'homestead') {
		network = 'mainnet';
	}
	if(networkObj.chainId == 10) {
		network = 'optimisticEthereum'		
	}


	const owner = new ethers.Wallet(user_key1, ethers.provider);

	console.log('Owner is:' + owner.address);
	console.log('Network name:' + network);
	
	const StakingImplementation = getTargetAddress('StakingThalesImplementation', network);
	const EscrowImplementation = getTargetAddress('EscrowThalesImplementation', network);
	const ThalesStakingRewardsImplementation = getTargetAddress('ThalesStakingRewardsPoolImplementation', network);
	const ProxyStaking = getTargetAddress('StakingThales', network);
	const ProxyEscrow = getTargetAddress('EscrowThales', network);
	const ThalesStakingRewardsPool = getTargetAddress('ThalesStakingRewardsPool', network);
	
	console.log('Implementation Escrow: ', EscrowImplementation);
	console.log('Implementation Staking: ', StakingImplementation);
	console.log('Escrow proxy:', ProxyEscrow);
	console.log('Staking proxy:', ProxyStaking);

	try {
		await hre.run('verify:verify', {
			address: StakingImplementation,
		});
	} catch (e) {
		console.log(e);
	}
	try {
		await hre.run('verify:verify', {
			address: EscrowImplementation,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: ProxyEscrow,
		});
	} catch (e) {
		console.log(e);
	}
	try {
		await hre.run('verify:verify', {
			address: ProxyStaking,
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

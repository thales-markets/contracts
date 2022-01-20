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
		networkObj.name = 'optimistic';
		network = 'optimistic';
		
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


	const ProxyStaking = await ethers.getContractFactory('StakingThales');
	let StakingThalesAddress =  getTargetAddress('StakingThales', network);

	const StakingThales = await ProxyStaking.attach(StakingThalesAddress);
    console.log("StakingThales attached on: ", StakingThales.address);

	let ThalesAMMAddress =  getTargetAddress('ThalesAMM', network);
	let ThalesRoyaleAddress =  getTargetAddress('ThalesRoyaleDeployed', network);
	let PriceFeedAddress =  getTargetAddress('PriceFeed', network);

	tx = await StakingThales.setThalesAMM(ThalesAMMAddress, {from:owner.address});
	await tx.wait().then(e => {
		console.log('Staking Thales: setThalesAMM ', ThalesAMMAddress);
	});
	tx = await StakingThales.setThalesRoyale(ThalesRoyaleAddress, {from:owner.address});
	await tx.wait().then(e => {
		console.log('Staking Thales: setThalesRoyale ', ThalesRoyaleAddress);
	});
	tx = await StakingThales.setPriceFeed(PriceFeedAddress, {from:owner.address});
	await tx.wait().then(e => {
		console.log('Staking Thales: setPriceFeed ',ThalesRoyaleAddress);
	});

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

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
	console.log('Thales address: ', thalesAddress);
	console.log('ProxyERC20sUSD address: ', ProxyERC20sUSD_address);

	const ProxyEscrow = await ethers.getContractFactory('EscrowThales');
	const ProxyStaking = await ethers.getContractFactory('StakingThales');

	let ProxyEscrow_deployed = await upgrades.deployProxy(ProxyEscrow, [
		owner.address,
		thalesAddress,
	]);
	await ProxyEscrow_deployed.deployed();

	let ProxyStaking_deployed = await upgrades.deployProxy(ProxyStaking, [
		owner.address,
		ProxyEscrow_deployed.address,
		thalesAddress,
		ProxyERC20sUSD_address,
		durationPeriod,
		unstakeDurationPeriod,
		SNXIssuerAddress
	]);
	let tx = await ProxyStaking_deployed.deployed();

	console.log('Escrow proxy:', ProxyEscrow_deployed.address);
	console.log('Staking proxy:', ProxyStaking_deployed.address);

	const EscrowImplementation = await getImplementationAddress(
		ethers.provider,
		ProxyEscrow_deployed.address
	);
	const StakingImplementation = await getImplementationAddress(
		ethers.provider,
		ProxyStaking_deployed.address
	);

	console.log('Implementation Escrow: ', EscrowImplementation);
	console.log('Implementation Staking: ', StakingImplementation);

	setTargetAddress('StakingThales', network, ProxyStaking_deployed.address);
	setTargetAddress('EscrowThales', network, ProxyEscrow_deployed.address);
	setTargetAddress('StakingThalesImplementation', network, StakingImplementation);
	setTargetAddress('EscrowThalesImplementation', network, EscrowImplementation);
	

	let ThalesAMMAddress =  getTargetAddress('ThalesAMM', network);
	let ThalesRoyaleAddress =  getTargetAddress('ThalesRoyaleDeployed', network);
	let PriceFeedAddress =  getTargetAddress('PriceFeed', network);

	tx = await ProxyStaking_deployed.setThalesAMM(ThalesAMMAddress, {from:owner.address});
	await tx.wait().then(e => {
		console.log('Staking Thales: setThalesAMM ', ThalesAMMAddress);
	});
	tx = await ProxyStaking_deployed.setThalesRoyale(ThalesRoyaleAddress, {from:owner.address});
	await tx.wait().then(e => {
		console.log('Staking Thales: setThalesRoyale ', ThalesRoyaleAddress);
	});
	tx = await ProxyStaking_deployed.setPriceFeed(PriceFeedAddress, {from:owner.address});
	await tx.wait().then(e => {
		console.log('Staking Thales: setPriceFeed ',ThalesRoyaleAddress);
	});

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

	try {
		await hre.run('verify:verify', {
			address: ProxyEscrow_deployed.address,
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

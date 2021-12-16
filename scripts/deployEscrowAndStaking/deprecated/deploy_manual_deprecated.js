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
const { getTargetAddress, setTargetAddress } = require('../../helpers');

const user_key1 = process.env.PRIVATE_KEY;
const user_key2 = process.env.PRIVATE_KEY_2;

async function main() {
	let accounts = await ethers.getSigners();
	// let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if(networkObj.chainId == 69) {
        network = "optimisticKovan";
		
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
	
	const owner = new ethers.Wallet(user_key1, ethers.provider);
	const proxyOwner = new ethers.Wallet(user_key2, ethers.provider);
	
	console.log('Owner is:' + owner.address);
	console.log('ProxyOwner is:' + proxyOwner.address);
	console.log('Network name:' + network);
	
	let thalesAddress, ProxyERC20sUSD_address;
	
	if(networkObj.chainId == 69) {
        network = "optimisticKovan";
		thalesAddress = getTargetAddress('OpThales_L2', network);
		ProxyERC20sUSD_address = getTargetAddress('ProxysUSD', network);
    }
	const thalesAddress = getTargetAddress('OpThales_L2', network);
	console.log('Thales address: ', thalesAddress);
	
	const ProxyERC20sUSD_address = getTargetAddress('ProxysUSD', network);
	console.log('ProxyERC20sUSD address: ', ProxyERC20sUSD_address);
	// const ProxyEscrowThalesAddress = getTargetAddress('ProxyEscrowThales', network);

	const ProxyEscrow = await ethers.getContractFactory('ProxyEscrowThales');
	const ProxyStaking = await ethers.getContractFactory('ProxyStakingThales');
	
	const OwnedProxyEscrow = await ethers.getContractFactory('OwnedUpgradeabilityProxy');
	const OwnedProxyEscrow_deployed = await OwnedProxyEscrow.connect(proxyOwner).deploy();
	await OwnedProxyEscrow_deployed.deployed();
	
	const OwnedProxyStaking_deployed = await OwnedProxyEscrow.connect(proxyOwner).deploy();
	await OwnedProxyStaking_deployed.deployed();

	const ProxyStaking_implementation = await ProxyStaking.connect(owner).deploy();
	await ProxyStaking_implementation.deployed();
	console.log("Staking implementation:", ProxyStaking_implementation.address);
	
	const ProxyEscrow_implementation = await ProxyEscrow.connect(owner).deploy();
	await ProxyEscrow_implementation.deployed();
	console.log("Escrow implementation:", ProxyEscrow_implementation.address);
	
	let tx = await OwnedProxyStaking_deployed.upgradeTo(ProxyStaking_implementation.address);
	await tx.wait();
	
	tx = await OwnedProxyEscrow_deployed.upgradeTo(ProxyEscrow_implementation.address);
	await tx.wait();

	const ProxyEscrow_deployed = ProxyEscrow.connect(owner).attach(OwnedProxyEscrow_deployed.address);

	tx = await ProxyEscrow_deployed.initialize(
		owner.address,
		thalesAddress
		);
		
	await tx.wait();
		
	console.log("Escrow proxy:", ProxyEscrow_deployed.address);
	
	const ProxyStaking_deployed = ProxyStaking.connect(owner).attach(OwnedProxyStaking_deployed.address);	
	tx = await ProxyStaking_deployed.initialize(
		owner.address, 
		ProxyEscrow_deployed.address,
		thalesAddress,
		ProxyERC20sUSD_address,
		durationPeriod,
		unstakeDurationPeriod
		);
	await tx.wait();
		
	console.log("Staking proxy:", ProxyStaking_deployed.address);
	
	setTargetAddress('ProxyStakingThales', network, ProxyStaking_deployed.address);
	setTargetAddress('ProxyEscrowThales', network, ProxyEscrow_deployed.address);
		
	await hre.run('verify:verify', {
			address: ProxyStaking_deployed.address,
			constructorArguments: [],
		});
	await hre.run('verify:verify', {
		address: ProxyEscrow_deployed.address,
		constructorArguments: [],
	});


	await ProxyStaking_deployed.startStakingPeriod({ from: owner.address });
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
